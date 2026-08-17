/* ============================================
   Handy Tools — storage-registry.js (AD-6 + AD-11)
   Single source of truth for every localStorage
   key the site reads or writes. The /privacy page
   (Story 5.6) and the export/import + clear-data
   paths consume HT.storage.list() / .clear() so
   future additions land without code changes.

   The registry exposes:
     HT.storage.register(key, meta) — register a key
     HT.storage.get(key, fallback)  — read with legacy fallback
     HT.storage.set(key, value)     — write with shape validation
     HT.storage.remove(key)         — remove a single key
     HT.storage.list()              — frozen array of entries (sorted)
     HT.storage.keys()              — just the key strings
     HT.storage.clear()             — remove every registered key
     HT.storage.registerHistoryKeys(tools) — bulk-register per-tool keys
     HT.storage.version             — '1.0.0'

   Namespace rule (AD-6):
     ht.*          — runtime/legacy (ht.theme grandfathered)
     handy-tools.* — user data (history, pins, recent, ...)
     Anything else is rejected at register-time.

   Shape rule (FOUC IIFE compatibility):
     ht.* keys MUST be plain strings — the FOUC IIFE in
     index.html:9 reads localStorage.getItem('ht.theme')
     without JSON.parse, so the registry stores plain
     strings. handy-tools.* keys are JSON-serializable.

   ES2018 — see ARCHITECTURE-SPINE line 222. Boots before
   utils.js so HT.storage.get/set/remove can delegate.
   ============================================ */

(function () {
  'use strict';

  window.HT = window.HT || {};
  const HT = window.HT;

  // The registry itself. Keys → frozen entry objects.
  const registry = Object.create(null);

  // Static map of legacy keys → new names. The migration reads from the
  // legacy key on first access (after this story ships), copies the value
  // to the new key, and deletes the legacy key. After migration runs once
  // for a given user, the legacy key is gone and the fallback no-ops.
  // Data-driven so the CI gate can cross-check every legacy key against
  // a registered new key.
  const LEGACY_KEY_MAP = Object.freeze({
    'handy-tools.gpa-calculator.state': 'gpa_calc_v1',
    'handy-tools.bd-tax-calculator.state': 'bd_tax_calculator_v1',
    'handy-tools.bd-tax-calculator.lang': 'bd_tax_lang',
    'handy-tools.bd-tax-calculator.rules': 'bd_tax_rules',
    'handy-tools.decision-wheel.state': 'decision_wheel_v1',
    'handy-tools.eisenhower-matrix.state': 'eisenhower_v1',
    'handy-tools.world-clock.state': 'world_clock_v1',
    'handy-tools.grade-calculator.state': 'grade_calc_v1',
    'handy-tools.pomodoro-timer.state': 'pomodoro_state_v1',
    'handy-tools.countdown-to-date.state': 'countdown_to_date_v1',
    'handy-tools.pros-cons.state': 'pros_cons_v1',
    'handy-tools.habit-tracker.state': 'habit_tracker_v1',
  });

  // Reverse map for the gate's cross-check: every legacy key must point
  // to a registered new key. Frozen so the gate can't see a stale copy.
  const LEGACY_KEYS = Object.freeze(
    Object.values(LEGACY_KEY_MAP).slice().sort()
  );

  // Detect CI mode. The gate's harness page sets window.HT.__ci = true
  // before running the manifest cross-check; the gate also flips this
  // flag when invoked via ?ci=1 in the URL.
  function isCiMode() {
    try {
      if (window.HT && window.HT.__ci === true) return true;
      const params = new URLSearchParams(window.location.search);
      return params.get('ci') === '1';
    } catch (_) {
      return false;
    }
  }

  // isDebugMode toggles verbose registry logs. Default off in production;
  // the dev agent can flip it via ?debug=1 or window.HT.__debug.
  function isDebugMode() {
    try {
      if (window.HT && window.HT.__debug === true) return true;
      const params = new URLSearchParams(window.location.search);
      return params.get('debug') === '1';
    } catch (_) {
      return false;
    }
  }

  // Namespace predicate. AD-6 grandfather rule: ht.theme is grandfathered
  // under ht.* but the registry still accepts ht.* prefixes for any
  // runtime key. handy-tools.* is the user-data namespace.
  //
  // Review finding: reject empty-body prefixes like 'ht.' and
  // 'handy-tools.' (was previously accepted because startsWith matches
  // the literal prefix regardless of what — if anything — follows).
  // The 'ht.' form is for runtime/legacy preferences (ht.theme, ht.locale,
  // ht.reducedMotion, ht.units, ht.currency, ht.fontScale — single-segment
  // is correct here). The 'handy-tools.' form covers both single-segment
  // reserved keys (handy-tools.recent, handy-tools.pins, handy-tools.favorites,
  // handy-tools.dashboard — Story 3.12 + Epic 6 own these) and per-tool
  // keys (handy-tools.history.<slug>, handy-tools.<slug>.state — multi-segment).
  // The trust-surface check is the prefix itself + a non-empty body, not a
  // segment-count floor; the privacy export enumerates by prefix.
  function isValidNamespace(key) {
    if (typeof key !== 'string') return false;
    if (key === 'ht.' || key === 'handy-tools.') return false;
    // Reject any key with two adjacent dots anywhere — empty segments
    // are not meaningful (e.g. 'ht..foo', 'handy-tools..foo', 'handy-
    // tools.x..bar'). The check must span the whole key, not just the
    // rest-after-prefix, because a malformed key like 'handy-tools..foo'
    // splits the '..' across the prefix boundary.
    if (key.indexOf('..') !== -1) return false;
    if (key.startsWith('ht.')) {
      const rest = key.slice('ht.'.length);
      // Accept any number of non-empty segments (ht.theme has 1; future
      // ht.foo.bar could have more).
      return rest.length > 0;
    }
    if (key.startsWith('handy-tools.')) {
      const rest = key.slice('handy-tools.'.length);
      // Accept ≥1 non-empty segment so single-segment reserved keys
      // (handy-tools.recent, handy-tools.pins, handy-tools.favorites,
      // handy-tools.dashboard) AND multi-segment per-tool keys
      // (handy-tools.history.<slug>) both pass.
      return rest.length > 0;
    }
    return false;
  }

  function validateMeta(meta) {
    if (!meta || typeof meta !== 'object') {
      throw new TypeError('HT.storage.register: meta must be an object');
    }
    const required = ['purpose', 'lifetime', 'schema', 'owner'];
    for (let i = 0; i < required.length; i += 1) {
      const field = required[i];
      if (typeof meta[field] !== 'string' || meta[field].length === 0) {
        throw new TypeError(
          `HT.storage.register: meta.${field} must be a non-empty string`
        );
      }
    }
  }

  function isPlainString(value) {
    return typeof value === 'string';
  }

  function isJsonSerializable(value) {
    // Reject undefined, functions, symbols, and circular refs. The
    // JSON.stringify test catches functions/symbols (they stringify as
    // undefined and disappear) and throws on circular refs. The typeof
    // guard catches undefined outright.
    if (value === undefined) return false;
    const t = typeof value;
    if (t === 'function' || t === 'symbol') return false;
    try {
      JSON.stringify(value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function readRaw(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function writeRaw(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function removeRaw(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {
      /* ignore */
    }
  }

  function applyLegacyFallback(key) {
    // If the registry entry exists AND localStorage has no value at
    // `key`, AND a legacy key is mapped to `key`, AND the legacy key
    // holds a value → migrate: copy, delete legacy, return the value.
    // The caller is responsible for parsing the returned raw string
    // (we return the raw shape so ht.* plain strings stay plain).
    //
    // Migration hardening (review finding): if the write to the new
    // key fails (quota, serialization), surface the failure and DO NOT
    // delete the legacy key — losing the legacy value without a
    // successful replacement would silently destroy user data. Also
    // validate the parsed shape against the registered schema before
    // persisting; corrupt legacy data must not propagate to the new
    // namespace.
    if (!Object.prototype.hasOwnProperty.call(registry, key)) return null;
    const legacyKey = LEGACY_KEY_MAP[key];
    if (!legacyKey) return null;
    const legacyRaw = readRaw(legacyKey);
    if (legacyRaw === null) return null;

    // Validate shape against schema before persisting. ht.* keys are
    // plain strings; handy-tools.* keys are JSON-parseable. Anything
    // else is corrupt legacy data — surface and refuse migration.
    if (key.startsWith('ht.')) {
      // ht.* plain-string invariant: if the legacy value isn't a plain
      // string, refuse. The schema field carries the allowed enum hint
      // (e.g. 'string in {auto,light,dark}') but we only enforce plain-
      // stringness here; callers validate against the enum on read.
      if (!isPlainString(legacyRaw)) {
        console.warn(
          `[storage-registry] refusing to migrate non-string legacy value ` +
            `at ${JSON.stringify(legacyKey)} for ${JSON.stringify(key)}`
        );
        return null;
      }
    } else {
      // handy-tools.* JSON-shape invariant: parse must succeed AND
      // produce a non-null value. JSON.parse('null') → null, which is
      // not useful state to migrate.
      try {
        const parsed = JSON.parse(legacyRaw);
        if (parsed === null || typeof parsed !== 'object') {
          console.warn(
            `[storage-registry] refusing to migrate non-object legacy value ` +
              `at ${JSON.stringify(legacyKey)} for ${JSON.stringify(key)}`
          );
          return null;
        }
      } catch (_) {
        console.warn(
          `[storage-registry] refusing to migrate unparseable legacy value ` +
            `at ${JSON.stringify(legacyKey)} for ${JSON.stringify(key)}`
        );
        return null;
      }
    }

    const wrote = writeRaw(key, legacyRaw);
    if (wrote !== true) {
      console.warn(
        `[storage-registry] failed to persist migrated value from ` +
          `${JSON.stringify(legacyKey)} to ${JSON.stringify(key)}; ` +
          `legacy key preserved`
      );
      return null;
    }
    removeRaw(legacyKey);
    return legacyRaw;
  }

  // Public API ------------------------------------------------------------

  function register(key, meta) {
    if (!isValidNamespace(key)) {
      throw new Error(
        `HT.storage.register: invalid namespace for ${JSON.stringify(key)}; ` +
          "must start with 'ht.' or 'handy-tools.'"
      );
    }
    if (Object.prototype.hasOwnProperty.call(registry, key)) {
      throw new Error(
        `HT.storage.register: key ${JSON.stringify(key)} already registered ` +
          `with owner ${JSON.stringify(registry[key].owner)}`
      );
    }
    validateMeta(meta);
    registry[key] = Object.freeze({
      key,
      purpose: meta.purpose,
      lifetime: meta.lifetime,
      schema: meta.schema,
      owner: meta.owner,
    });
  }

  function get(key, fallback) {
    if (!Object.prototype.hasOwnProperty.call(registry, key)) {
      const msg = `HT.storage.get: unregistered key ${JSON.stringify(key)}`;
      if (isCiMode()) {
        throw new Error(msg);
      }
      console.warn(msg);
      return fallback;
    }
    const raw = readRaw(key);
    if (raw === null) {
      const migrated = applyLegacyFallback(key);
      if (migrated !== null) {
        // ht.* keys are plain strings — return as-is. handy-tools.* keys
        // are JSON-encoded — parse and return.
        if (key.startsWith('ht.')) return migrated;
        try { return JSON.parse(migrated); } catch (_) { return fallback; }
      }
      return fallback;
    }
    if (key.startsWith('ht.')) {
      // FOUC IIFE compatibility — ht.* values are plain strings, never
      // JSON-encoded. Return as-is. Callers that want a typed value
      // should not use ht.* for structured data.
      //
      // Review finding: an older ht.* value may have been written via a
      // non-registry path as JSON-encoded ('"light"' not 'light'). If we
      // see a JSON-encoded plain string in {auto,light,dark} we accept
      // the decoded form — the FOUC IIFE will write the plain-string
      // shape on next set.
      if (isPlainString(raw)) return raw;
      try {
        const decoded = JSON.parse(raw);
        if (isPlainString(decoded)) return decoded;
      } catch (_) { /* fall through */ }
      console.warn(
        `[storage-registry] ht.* key ${JSON.stringify(key)} holds a non-` +
          `plain-string value; returning fallback. The FOUC IIFE expects ` +
          `a plain string at localStorage.getItem('ht.theme').`
      );
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw);
      // Review finding: schema-mismatch parsing (e.g. an 'object' key
      // whose stored value parses to a primitive) crashes downstream
      // readers. Surface the mismatch as a warn + return fallback rather
      // than letting the corrupt shape propagate.
      const schema = registry[key].schema;
      if (schema === 'object' && (parsed === null || typeof parsed !== 'object')) {
        console.warn(
          `[storage-registry] schema mismatch for ${JSON.stringify(key)}: ` +
            `expected object, got ${parsed === null ? 'null' : typeof parsed}`
        );
        return fallback;
      }
      if (schema === 'array<string>' && !Array.isArray(parsed)) {
        console.warn(
          `[storage-registry] schema mismatch for ${JSON.stringify(key)}: ` +
            `expected array, got ${parsed === null ? 'null' : typeof parsed}`
        );
        return fallback;
      }
      return parsed;
    } catch (_) {
      // Review finding: previously the silent swallow meant corrupt data
      // was indistinguishable from absent data. Surface the corruption
      // so the dev agent (or /privacy page) can investigate.
      console.warn(
        `[storage-registry] corrupt JSON value at ${JSON.stringify(key)}; ` +
          `returning fallback`
      );
      return fallback;
    }
  }

  function set(key, value) {
    // Review finding: HT.storage.set(null, x) used to silently register
    // a 'null' key because the registry check accepts any string. Throw
    // TypeError on non-string key — buggy callers (a missing variable
    // evaluating to undefined) otherwise write to a wrong slot.
    if (typeof key !== 'string') {
      throw new TypeError(
        `HT.storage.set: key must be a string (got ${typeof key})`
      );
    }
    if (!Object.prototype.hasOwnProperty.call(registry, key)) {
      const msg = `HT.storage.set: unregistered key ${JSON.stringify(key)}`;
      if (isCiMode()) {
        throw new Error(msg);
      }
      console.warn(msg);
      return false;
    }
    // Review finding: set(key, undefined) used to store the literal
    // string 'undefined' into localStorage, polluting the namespace.
    // Treat undefined as a remove() — symmetrical with the get() contract
    // where a missing key returns the fallback.
    if (value === undefined) {
      return remove(key);
    }
    if (key.startsWith('ht.')) {
      if (!isPlainString(value)) {
        throw new TypeError(
          `HT.storage.set: ht.* keys require a plain string value ` +
            `(got ${typeof value}) for ${JSON.stringify(key)}; the FOUC IIFE ` +
            `reads this key via localStorage.getItem without JSON.parse`
        );
      }
      const wrote = writeRaw(key, value);
      if (wrote !== true) {
        // Quota exceeded or storage disabled — surface, don't stay silent.
        // The /privacy page and Settings UI both rely on set() returning
        // true to confirm persistence; a silent false hides data loss.
        console.warn(
          `[storage-registry] write failed for ${JSON.stringify(key)} ` +
            `(localStorage quota exceeded or disabled)`
        );
      }
      return wrote === true;
    }
    if (!isJsonSerializable(value)) {
      throw new TypeError(
        `HT.storage.set: value for ${JSON.stringify(key)} is not JSON-serializable`
      );
    }
    const wrote = writeRaw(key, JSON.stringify(value));
    if (wrote !== true) {
      console.warn(
        `[storage-registry] write failed for ${JSON.stringify(key)} ` +
          `(localStorage quota exceeded or disabled)`
      );
    }
    return wrote === true;
  }

  function remove(key) {
    if (!Object.prototype.hasOwnProperty.call(registry, key)) {
      const msg = `HT.storage.remove: unregistered key ${JSON.stringify(key)}`;
      if (isCiMode()) {
        throw new Error(msg);
      }
      console.warn(msg);
      return false;
    }
    const existed = readRaw(key) !== null;
    removeRaw(key);
    return existed;
  }

  function list() {
    const entries = Object.keys(registry)
      .sort()
      .map((k) => {
        // Deep clone so consumers can't mutate the frozen registry.
        return {
          key: registry[k].key,
          purpose: registry[k].purpose,
          lifetime: registry[k].lifetime,
          schema: registry[k].schema,
          owner: registry[k].owner,
        };
      });
    return Object.freeze(entries);
  }

  function keys() {
    return Object.keys(registry).sort();
  }

  function clear() {
    // AD-11 review fix: clear() must sweep BOTH the registered keys
    // AND the legacy key namespace. The legacy keys hold user data
    // that the user reasonably expects to be removed when they hit
    // "Clear all data" in the Settings modal — leaving them orphaned
    // contradicts the privacy invariant the registry is the source
    // of truth for. We sweep every LEGACY_KEY_MAP value (the legacy
    // side) plus every registered key (the new namespace).
    Object.keys(registry).forEach((k) => removeRaw(k));
    Object.values(LEGACY_KEY_MAP).forEach((legacyKey) => removeRaw(legacyKey));
  }

  // Bulk-register per-tool history keys. Called once at boot from shell.js
  // after HT.homeGrid.entries is available. Idempotent — re-registering
  // throws, so callers must check the registry first or rely on the
  // boot order (history keys are registered exactly once per session).
  function registerHistoryKeys(tools) {
    if (!Array.isArray(tools)) return 0;
    let added = 0;
    tools.forEach((tool) => {
      if (!tool || typeof tool.slug !== 'string') return;
      const slug = tool.slug;
      const historyKeys = Array.isArray(tool['history-keys']) ? tool['history-keys'] : [];
      if (historyKeys.length === 0) return;
      const fullKey = `handy-tools.history.${slug}`;
      if (Object.prototype.hasOwnProperty.call(registry, fullKey)) return;
      try {
        register(fullKey, {
          purpose: `History of inputs for the ${slug} tool`,
          lifetime: 'persistent',
          schema: 'array',
          owner: `${slug}.js`,
        });
        added += 1;
      } catch (_) {
        // Already registered — silently skip (idempotent boot path).
      }
    });
    return added;
  }

  // Static registrations (Task 3). The IIFE runs before utils.js so
  // HT.storage.get/set on ht.theme / ht.locale etc. can dispatch through
  // the registry by the time theme.js / shell.js boot.

  // ht.theme is grandfathered per AD-6 — see ARCHITECTURE-SPINE.md line
  // 109. The FOUC IIFE in index.html:9 reads localStorage.getItem('ht.theme')
  // as a plain string (not JSON-encoded); the registry stores plain
  // strings for ht.* keys so the write side is also a plain string.
  register('ht.theme', {
    purpose: 'Light/dark/auto theme selection (FOUC IIFE reads at boot)',
    lifetime: 'persistent',
    schema: 'string in {auto,light,dark}',
    owner: 'shell.js',
  });

  // ht.* runtime keys owned by shell.js (settings modal). All plain
  // strings — see shell.js:557-573 (SETTINGS_KEYS + SETTINGS_DEFAULTS).
  register('ht.locale', {
    purpose: 'UI locale code (BCP-47; e.g. "en", "bn", "hi")',
    lifetime: 'persistent',
    schema: 'string',
    owner: 'shell.js',
  });
  register('ht.reducedMotion', {
    purpose: 'Reduced-motion preference ("0" or "1")',
    lifetime: 'persistent',
    schema: 'string in {0,1}',
    owner: 'shell.js',
  });
  register('ht.units', {
    purpose: 'Preferred unit system ("metric" or "imperial")',
    lifetime: 'persistent',
    schema: 'string',
    owner: 'shell.js',
  });
  register('ht.currency', {
    purpose: 'Preferred display currency (ISO 4217)',
    lifetime: 'persistent',
    schema: 'string',
    owner: 'shell.js',
  });
  register('ht.fontScale', {
    purpose: 'Font scale percent ("100", "125", ...) — Story 3.5',
    lifetime: 'persistent',
    schema: 'string',
    owner: 'shell.js',
  });
  register('ht.exam-countdown.target', {
    purpose: 'Picked datetime-local target for the Exam Countdown tool — Story 9.8',
    lifetime: 'persistent',
    schema: 'string',
    owner: 'exam-countdown.js',
  });
  register('ht.quiz-preview.state', {
    purpose: 'Persisted quiz state (answers + current card) for the Quiz Pattern Preview — Story 9.12',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'quiz-preview.js',
  });
  register('handy-tools.budget-planner.budget', {
    purpose: 'Persisted monthly budget (income + categories) for the Budget Planner — Story 9.13',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'budget-planner.js',
  });
  register('handy-tools.savings-goal.inputs', {
    purpose: 'Persisted savings goal inputs (target / months / starting / rate) for the Savings Goal tool — Story 9.14',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'savings-goal.js',
  });

  // handy-tools.* user-data keys owned by shell.js. Story 3.12 will
  // populate recent/pins; Epic 6 favorites/dashboard. The registry
  // reserves the keys now so /privacy lists them and the clear-all
  // button removes them.
  register('handy-tools.recent', {
    purpose: 'Recently-used tool slugs (palette source)',
    lifetime: 'persistent',
    schema: 'array<string>',
    owner: 'shell.js',
  });
  register('handy-tools.pins', {
    purpose: 'Pinned tool slugs keyed by ISO 8601 timestamp (home grid ordering)',
    lifetime: 'persistent',
    schema: 'object<slug:iso8601>',
    owner: 'shell.js',
  });
  register('handy-tools.favorites', {
    purpose: 'Favorite tool slugs (Epic 6 pack composition)',
    lifetime: 'persistent',
    schema: 'array<string>',
    owner: 'shell.js',
  });
  register('handy-tools.dashboard', {
    purpose: 'Per-pack dashboard layout (Epic 6)',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'shell.js',
  });
  register('handy-tools.hints.seen', {
    purpose: 'Hint ids the user has dismissed (UX EXPERIENCE.md:662)',
    lifetime: 'persistent',
    schema: 'array<string>',
    owner: 'shell.js',
  });
  register('handy-tools.pwa.dismissals', {
    purpose: 'PWA install prompt dismissal counter (EXPERIENCE.md:83)',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'shell.js',
  });

  // Migrated legacy tool keys (Task 9). Each new key maps to a legacy
  // localStorage key per LEGACY_KEY_MAP above; HT.storage.get falls
  // through to the legacy key on first read after this story ships.
  register('handy-tools.gpa-calculator.state', {
    purpose: 'Persisted tool state for the GPA Calculator',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'gpa-calculator.js',
  });
  register('handy-tools.bd-tax-calculator.state', {
    purpose: 'Persisted tool state for the Bangladesh Tax Calculator',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'bd-tax-calculator.js',
  });
  register('handy-tools.bd-tax-calculator.lang', {
    purpose: 'Selected language for the Bangladesh Tax Calculator',
    lifetime: 'persistent',
    schema: 'string',
    owner: 'bd-tax-calculator.js',
  });
  register('handy-tools.bd-tax-calculator.rules', {
    purpose: 'Selected ruleset id for the Bangladesh Tax Calculator',
    lifetime: 'persistent',
    schema: 'string',
    owner: 'bd-tax-calculator.js',
  });
  register('handy-tools.decision-wheel.state', {
    purpose: 'Persisted tool state for the Decision Wheel',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'decision-wheel.js',
  });
  register('handy-tools.eisenhower-matrix.state', {
    purpose: 'Persisted tool state for the Eisenhower Matrix',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'eisenhower-matrix.js',
  });
  register('handy-tools.world-clock.state', {
    purpose: 'Persisted tool state for the World Clock',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'world-clock.js',
  });
  register('handy-tools.grade-calculator.state', {
    purpose: 'Persisted tool state for the Grade Calculator',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'grade-calculator.js',
  });
  register('handy-tools.pomodoro-timer.state', {
    purpose: 'Persisted tool state for the Pomodoro Timer',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'pomodoro-timer.js',
  });
  register('handy-tools.countdown-to-date.state', {
    purpose: 'Persisted tool state for the Countdown to Date',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'countdown-to-date.js',
  });
  register('handy-tools.pros-cons.state', {
    purpose: 'Persisted tool state for the Pros & Cons tool',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'pros-cons.js',
  });
  register('handy-tools.habit-tracker.state', {
    purpose: 'Persisted tool state for the Habit Tracker',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'habit-tracker.js',
  });
  register('handy-tools.inflation-calculator.inputs', {
    purpose: 'Persisted input history for the Inflation Calculator',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'inflation-calculator.js',
  });
  register('handy-tools.lifespan-simulator.plan', {
    purpose: 'Plan Your Changes targets (Story 1.16; WHO-cited delta planner)',
    lifetime: 'persistent',
    schema: 'object',
    owner: 'lifespan-simulator.js',
  });

  // Public surface — frozen per AD-14.
  HT.storageRegistry = Object.freeze({
    version: '1.0.0',
    register,
    get,
    set,
    remove,
    list,
    keys,
    clear,
    registerHistoryKeys,
    // Exposed for the CI gate's cross-check (and for tests). The map is
    // already frozen; Object.freeze is a no-op here but documents intent.
    legacyKeys: Object.freeze(LEGACY_KEYS),
  });

  // The dispatch layer (HT.storage.get/set/remove/clear/list/keys/register)
  // mirrors HT.storageRegistry with the same surface — utils.js delegates
  // to this object so callers don't have to change their HT.storage.* call
  // sites. Per AC #3 + AC #7 + AC #8.
  HT.storage = Object.freeze({
    version: '1.0.0',
    register,
    get,
    set,
    remove,
    list,
    keys,
    clear,
    registerHistoryKeys,
    legacyKeys: HT.storageRegistry.legacyKeys,
  });

  if (isDebugMode()) {
    // Verbose boot log per DoD #2.
    const entries = list();
    console.info(
      `[storage-registry] ${entries.length} keys registered:`,
      entries
    );
  }
})();
