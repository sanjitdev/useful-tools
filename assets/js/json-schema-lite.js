/* ============================================
   Handy Tools — json-schema-lite.js (Story 9.1)
   Hand-rolled Draft-07 subset validator. Pure
   functions, no DOM. Supports: type, required,
   properties, items, enum, minimum, maximum,
   minLength, maxLength, pattern. Out of scope:
   $ref, oneOf/anyOf/allOf, format, additional-
   Properties, multipleOf, dependencies. See
   docs/resolutions/ROQ-1 in the story spec.
   The validator never fetches external $ref.
   ES2018.
   ============================================ */

(function () {
  'use strict';

  // Node-side boot (smoke harness).
  const _hasWindow = typeof globalThis !== 'undefined' && typeof globalThis.window !== 'undefined';
  if (!_hasWindow) {
    globalThis.window = { HT: {} };
  }
  const window = globalThis.window;
  window.HT = window.HT || {};
  const HT = window.HT;

  // -------------------------------------------------------------
  // Type coercion table — given a JSON value, return the
  // permitted JSON-Schema "type" names it satisfies.
  // -------------------------------------------------------------

  function _typeOf(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'number') {
      // Distinguish integer vs number — schema spec separation.
      if (Number.isInteger(value)) return 'integer';
      return 'number';
    }
    return typeof value;
  }

  // -------------------------------------------------------------
  // Single validator functions. Each returns an array of
  // error strings (empty = pass). All accept (schema, value,
  // path) where path is the JSON-Pointer-style instance path.
  // -------------------------------------------------------------

  // The set of types our subset understands; anything else is treated
  // as "no constraint" and silently ignored (per ROQ-1 — Draft-07
  // is out of scope, so we don't reject unknown types).
  const KNOWN_TYPES = Object.freeze({
    string: 1, number: 1, integer: 1, boolean: 1, object: 1, array: 1, null: 1,
  });

  function _checkType(schema, value, path) {
    const errors = [];
    if (!Object.prototype.hasOwnProperty.call(schema, 'type')) return errors;
    const expected = schema.type;
    const actual = _typeOf(value);
    // Per JSON Schema: "integer" is a subtype of "number", so an
    // integer value passes a "number" constraint. (Draft-07 §4.2.1)
    function _matches(exp, act) {
      if (exp === 'number' && act === 'integer') return true;
      return exp === act;
    }
    if (Array.isArray(expected)) {
      const known = expected.filter((t) => KNOWN_TYPES[t]);
      if (known.length === 0) return errors;
      if (!known.some((t) => _matches(t, actual))) {
        errors.push({
          path: path,
          message: 'expected type to be one of [' + known.join(', ') +
            '], got ' + actual,
        });
      }
    } else {
      if (!KNOWN_TYPES[expected]) return errors;
      if (!_matches(expected, actual)) {
        errors.push({
          path: path,
          message: 'expected type "' + expected + '", got ' + actual,
        });
      }
    }
    return errors;
  }

  function _checkEnum(schema, value, path) {
    if (!Object.prototype.hasOwnProperty.call(schema, 'enum')) return [];
    const errors = [];
    const allowed = schema.enum;
    if (!Array.isArray(allowed)) {
      // Malformed schema — skip silently (spec says "ignore")
      return errors;
    }
    let match = false;
    for (let i = 0; i < allowed.length; i += 1) {
      if (_deepEqual(value, allowed[i])) { match = true; break; }
    }
    if (!match) {
      errors.push({
        path: path,
        message: 'expected value to be one of the enum entries',
      });
    }
    return errors;
  }

  function _checkNumber(schema, value, path) {
    const errors = [];
    if (typeof value !== 'number') return errors;
    if (Object.prototype.hasOwnProperty.call(schema, 'minimum')) {
      if (value < schema.minimum) {
        errors.push({
          path: path,
          message: 'expected ' + value + ' to be >= ' + schema.minimum,
        });
      }
    }
    if (Object.prototype.hasOwnProperty.call(schema, 'maximum')) {
      if (value > schema.maximum) {
        errors.push({
          path: path,
          message: 'expected ' + value + ' to be <= ' + schema.maximum,
        });
      }
    }
    return errors;
  }

  function _checkString(schema, value, path) {
    const errors = [];
    if (typeof value !== 'string') return errors;
    if (Object.prototype.hasOwnProperty.call(schema, 'minLength')) {
      if (value.length < schema.minLength) {
        errors.push({
          path: path,
          message: 'expected string length >= ' + schema.minLength +
            ' (got ' + value.length + ')',
        });
      }
    }
    if (Object.prototype.hasOwnProperty.call(schema, 'maxLength')) {
      if (value.length > schema.maxLength) {
        errors.push({
          path: path,
          message: 'expected string length <= ' + schema.maxLength +
            ' (got ' + value.length + ')',
        });
      }
    }
    if (Object.prototype.hasOwnProperty.call(schema, 'pattern')) {
      const re = schema.pattern;
      if (re instanceof RegExp) {
        if (!re.test(value)) {
          errors.push({
            path: path,
            message: 'expected string to match pattern ' + re.toString(),
          });
        }
      } else if (typeof re === 'string') {
        try {
          if (!new RegExp(re).test(value)) {
            errors.push({
              path: path,
              message: 'expected string to match pattern /' + re + '/',
            });
          }
        } catch (_) {
          // Bad pattern — skip silently per spec ("ignore unknown")
        }
      }
    }
    return errors;
  }

  function _checkRequired(schema, value, path) {
    const errors = [];
    if (!schema.required || !Array.isArray(schema.required)) return errors;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return errors;
    for (let i = 0; i < schema.required.length; i += 1) {
      const key = schema.required[i];
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push({
          path: path === '' ? '/' + key : path + '/' + _escapePointer(key),
          message: 'missing required property "' + key + '"',
        });
      }
    }
    return errors;
  }

  function _checkProperties(schema, value, path) {
    const errors = [];
    if (!schema.properties || typeof schema.properties !== 'object') return errors;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return errors;
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const subSchema = schema.properties[key];
      if (subSchema && typeof subSchema === 'object') {
        const subPath = path === '' ? '/' + _escapePointer(key) : path + '/' + _escapePointer(key);
        const sub = _validate(subSchema, value[key], subPath);
        for (let j = 0; j < sub.length; j += 1) errors.push(sub[j]);
      }
    }
    return errors;
  }

  function _checkItems(schema, value, path) {
    const errors = [];
    if (!schema.items || typeof schema.items !== 'object') return errors;
    if (!Array.isArray(value)) return errors;
    for (let i = 0; i < value.length; i += 1) {
      const subPath = path + '/' + i;
      const sub = _validate(schema.items, value[i], subPath);
      for (let j = 0; j < sub.length; j += 1) errors.push(sub[j]);
    }
    return errors;
  }

  function _escapePointer(seg) {
    // JSON Pointer (RFC 6901) — escape ~ and /.
    return String(seg).replace(/~/g, '~0').replace(/\//g, '~1');
  }

  function _deepEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i += 1) {
        if (!_deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    if (typeof a === 'object' && typeof b === 'object') {
      const ka = Object.keys(a);
      const kb = Object.keys(b);
      if (ka.length !== kb.length) return false;
      for (let i = 0; i < ka.length; i += 1) {
        if (!Object.prototype.hasOwnProperty.call(b, ka[i])) return false;
        if (!_deepEqual(a[ka[i]], b[ka[i]])) return false;
      }
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------
  // Recursive validator
  // -------------------------------------------------------------

  function _validate(schema, value, path) {
    const errors = [];
    if (schema === true || schema === undefined || schema === null) return errors;
    if (schema === false) {
      errors.push({ path: path, message: 'no value is allowed' });
      return errors;
    }
    if (typeof schema !== 'object') return errors;
    function _extend(arr) {
      for (let i = 0; i < arr.length; i += 1) errors.push(arr[i]);
    }
    _extend(_checkType(schema, value, path));
    _extend(_checkEnum(schema, value, path));
    _extend(_checkNumber(schema, value, path));
    _extend(_checkString(schema, value, path));
    _extend(_checkRequired(schema, value, path));
    _extend(_checkProperties(schema, value, path));
    _extend(_checkItems(schema, value, path));
    return errors;
  }

  /**
   * Validate `data` against `schema`. Returns
   *   { valid: bool, errors: [{ path, message }] }
   * where `path` is a JSON-Pointer-style instance path
   * (empty string for the root). On a malformed schema
   * the validator returns valid:true with empty errors.
   */
  function validate(schema, data) {
    if (schema === undefined || schema === null) {
      return { valid: true, errors: [] };
    }
    const errors = _validate(schema, data, '');
    return { valid: errors.length === 0, errors: errors };
  }

  // -------------------------------------------------------------
  // Self-test (runs only in Node).
  // ============================================================ */

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      validate: validate,
      _typeOf: _typeOf,
      _validate: _validate,
    };
  }

  // -------------------------------------------------------------
  // Browser export under `window.HT.jsonSchema`. Story 9.1 only
  // needs the public `validate` entry; the rest are internal.
  // -------------------------------------------------------------

  Object.defineProperty(HT, 'jsonSchema', {
    value: Object.freeze({
      validate: validate,
    }),
    writable: false,
    configurable: false,
    enumerable: true,
  });
})();
