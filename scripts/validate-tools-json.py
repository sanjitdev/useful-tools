#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validate-tools-json.py — Pure-stdlib JSON Schema validator for Handy Tools.

Purpose
-------
Validates tools.json against tools.schema.json with zero third-party
dependencies. Optionally uses the `jsonschema` package when installed
(pip install --user jsonschema) for the full draft-07 surface; otherwise
falls back to a hand-rolled walker that covers the constructs the
Handy Tools schema actually uses.

Usage
-----
  python scripts/validate-tools-json.py
  python scripts/validate-tools-json.py --schema-only
  python scripts/validate-tools-json.py --root /path/to/repo

Exit codes
----------
  0 — valid
  1 — tools.json is invalid against the schema
  2 — required file missing (tools.schema.json or tools.json)
  3 — tools.schema.json itself is invalid (draft-07 self-check failed)

Error format
------------
  tools.json: <field-path>: <message>

Author: Handy Tools (Story 1.1)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Schema constructs we support in the pure-stdlib fallback. The schema is
# authored to use only these — anything outside this set must either be
# avoided by the schema author or require the `jsonschema` package.
SUPPORTED_KEYWORDS = {
    "$schema",
    "$id",
    "$ref",
    "type",
    "properties",
    "required",
    "additionalProperties",
    "items",
    "pattern",
    "minLength",
    "maxLength",
    "minimum",
    "maximum",
    "minItems",
    "maxItems",
    "uniqueItems",
    "enum",
    "const",
    "definitions",
    "title",
    "description",
    "format",
    "default",
}

PRIMITIVE_TYPES = {"string", "number", "integer", "boolean", "null", "array", "object"}


# ---------------------------------------------------------------------------
# Path handling
# ---------------------------------------------------------------------------


def find_repo_root(start: Path) -> Path:
    """Walk up from `start` until we find a directory containing
    tools.schema.json. Raises SystemExit if no such directory exists —
    silent fallback would load the wrong tree and validate nothing."""
    current = start.resolve()
    for parent in [current, *current.parents]:
        if (parent / "tools.schema.json").exists():
            return parent
    raise SystemExit(
        f"tools.schema.json not found above {start}. "
        "Run from the repo root or pass --root."
    )


# ---------------------------------------------------------------------------
# Schema parsing
# ---------------------------------------------------------------------------


def load_json(path: Path) -> tuple[Any | None, str | None]:
    """Load and parse JSON. Returns (data, error_message).
    Uses utf-8-sig so a UTF-8 BOM (Notepad exports) is auto-stripped."""
    try:
        with path.open("r", encoding="utf-8-sig") as f:
            return json.load(f), None
    except FileNotFoundError:
        return None, "file not found"
    except json.JSONDecodeError as e:
        return None, f"invalid JSON: {e.msg} at line {e.lineno} column {e.colno}"
    except OSError as e:
        return None, f"could not read file: {e}"


def resolve_ref(ref: str, root: dict) -> dict:
    """Resolve a JSON pointer reference against the schema root."""
    if not ref.startswith("#/"):
        raise ValueError(f"unsupported $ref (only internal fragment refs allowed): {ref}")
    node: Any = root
    for part in ref[2:].split("/"):
        # JSON pointer escapes ~1 -> / and ~0 -> ~
        part = part.replace("~1", "/").replace("~0", "~")
        if not isinstance(node, dict) or part not in node:
            raise ValueError(f"unresolved $ref: {ref}")
        node = node[part]
    if not isinstance(node, dict):
        raise ValueError(f"$ref target is not a schema object: {ref}")
    return node


# ---------------------------------------------------------------------------
# Schema well-formedness check (draft-07 self-check)
# ---------------------------------------------------------------------------


def validate_schema_wellformed(schema: dict, root: dict) -> list[str]:
    """Lightweight check that the schema document itself is parseable JSON
    Schema draft-07. Returns a list of error strings (empty = healthy)."""
    errors: list[str] = []

    s = schema.get("$schema")
    if s is not None and s != "http://json-schema.org/draft-07/schema#":
        errors.append(
            f"unsupported $schema: {s!r} "
            "(expected 'http://json-schema.org/draft-07/schema#')"
        )

    if schema.get("type") != "object":
        errors.append("root schema must declare type: 'object'")

    # Reject any unknown top-level keywords (they would silently no-op)
    for key in schema.keys():
        if key not in SUPPORTED_KEYWORDS:
            errors.append(f"unsupported schema keyword at root: {key!r}")

    # Walk every nested schema and confirm structure. Cycle detection
    # uses node identity (id()), not the path string, because a `$ref`
    # aliasing the same node reads "different" content but is the same
    # schema object.
    def visit(node: Any, path: str, _seen: list | None = None) -> None:
        seen: list = _seen if _seen is not None else []
        if isinstance(node, list):
            for i, item in enumerate(node):
                visit(item, f"{path}[{i}]", seen)
            return
        if not isinstance(node, dict):
            return
        if any(n is node for n in seen):
            errors.append(f"{path}: cyclic $ref")
            return
        seen = seen + [node]
        for key in node.keys():
            if key not in SUPPORTED_KEYWORDS:
                errors.append(f"unsupported schema keyword at {path}: {key!r}")
        # Type-specific checks
        t = node.get("type")
        if t is not None:
            if isinstance(t, str):
                if t not in PRIMITIVE_TYPES:
                    errors.append(f"{path}: invalid type {t!r}")
            elif isinstance(t, list):
                for sub in t:
                    if sub not in PRIMITIVE_TYPES:
                        errors.append(f"{path}: invalid type {sub!r}")
        # Recurse
        if "properties" in node and isinstance(node["properties"], dict):
            for k, v in node["properties"].items():
                visit(v, f"{path}.properties.{k}", seen)
        if "items" in node:
            visit(node["items"], f"{path}.items", seen)
        if "definitions" in node and isinstance(node["definitions"], dict):
            for k, v in node["definitions"].items():
                visit(v, f"{path}.definitions.{k}", seen)
        if "$ref" in node:
            ref = node["$ref"]
            try:
                target = resolve_ref(ref, root)
            except ValueError as e:
                errors.append(f"{path}: {e}")
                return
            visit(target, f"{path} -> {ref}", seen)

    visit(schema, "#")

    return errors


# ---------------------------------------------------------------------------
# Hand-rolled validator (fallback)
# ---------------------------------------------------------------------------


def type_name(instance: Any) -> str:
    """Best-effort JSON-Schema-style type name for an instance, used in
    error messages. Returns 'null' for None, distinguishes int/bool, etc."""
    if instance is None:
        return "null"
    if isinstance(instance, bool):
        return "boolean"
    if isinstance(instance, int):
        return "integer"
    if isinstance(instance, float):
        return "number"
    if isinstance(instance, str):
        return "string"
    if isinstance(instance, list):
        return "array"
    if isinstance(instance, dict):
        return "object"
    return type(instance).__name__


# Strict ISO-8601 date-time check used by the fallback validator when
# the optional `jsonschema` package is not installed. Accepts
# `YYYY-MM-DDTHH:MM:SS[.fff](Z|±HH:MM)` — RFC 3339 / ISO-8601 subset
# the Handy Tools schema uses for `generated` and `last-updated`.
DATETIME_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$"
)


def check_format(name: str, instance: Any) -> str | None:
    """Return an error message if `instance` does not satisfy the named
    format, or None if it does (or the format is unknown). Currently
    supports 'date-time' only — the only format the Handy Tools schema
    uses. Unknown formats are accepted silently because the schema
    well-formedness check rejects unsupported keywords."""
    if not isinstance(instance, str):
        return None
    if name == "date-time":
        if not DATETIME_RE.match(instance):
            return f"value {instance!r} does not match format 'date-time' (ISO-8601 / RFC 3339)"
    return None


class ValidationError:
    __slots__ = ("path", "message")

    def __init__(self, path: str, message: str) -> None:
        self.path = path or "<root>"
        if not isinstance(message, str) or not message:
            message = "(no detail)"
        self.message = message

    def __str__(self) -> str:
        return f"tools.json: {self.path}: {self.message}"


# JSON-Schema meta-keywords that may accompany a `$ref` without changing
# the validation outcome. draft-07 explicitly allows `$ref` siblings;
# only validation-affecting keywords should be rejected.
REF_SIBLING_META = frozenset({"title", "description", "default"})


class FallbackValidator:
    """Hand-rolled validator covering the schema keywords the Handy Tools
    schema actually uses. Not a general-purpose JSON Schema implementation."""

    def __init__(self, schema_root: dict) -> None:
        self.root = schema_root

    def validate(self, instance: Any, schema: dict, path: str, errors: list[ValidationError]) -> None:
        # Resolve $ref first. draft-07 allows non-validation-affecting
        # siblings (title/description/default); reject only the
        # ones that would change semantics.
        if "$ref" in schema:
            for sibling in schema.keys():
                if sibling != "$ref" and sibling not in REF_SIBLING_META:
                    errors.append(
                        ValidationError(
                            path,
                            f"$ref cannot be combined with validation keyword {sibling!r}",
                        )
                    )
                    return
            try:
                target = resolve_ref(schema["$ref"], self.root)
            except ValueError as e:
                errors.append(ValidationError(path, str(e)))
                return
            self.validate(instance, target, path, errors)
            return

        # Type check (guard against TypeError in downstream branches
        # by recording the failure and returning before any branch
        # assumes the wrong type).
        if "type" in schema:
            if not self._check_type(instance, schema["type"]):
                errors.append(
                    ValidationError(
                        path,
                        f"expected type {schema['type']!r}, got {type_name(instance)}",
                    )
                )
                return

        # Format (best-effort; any error is recorded but other checks proceed)
        if "format" in schema:
            msg = check_format(schema["format"], instance)
            if msg is not None:
                errors.append(ValidationError(path, msg))

        # Enum
        if "enum" in schema and instance not in schema["enum"]:
            errors.append(ValidationError(path, f"value not in enum {schema['enum']!r}"))

        # Const
        if "const" in schema and instance != schema["const"]:
            errors.append(ValidationError(path, f"value must equal const {schema['const']!r}"))

        # String constraints (gated by isinstance so re.search never
        # raises TypeError on non-strings)
        if isinstance(instance, str):
            if "minLength" in schema and len(instance) < schema["minLength"]:
                errors.append(ValidationError(path, f"string shorter than minLength {schema['minLength']}"))
            if "maxLength" in schema and len(instance) > schema["maxLength"]:
                errors.append(ValidationError(path, f"string longer than maxLength {schema['maxLength']}"))
            if "pattern" in schema and not re.search(schema["pattern"], instance):
                errors.append(ValidationError(path, f"string does not match pattern {schema['pattern']!r}"))

        # Number constraints (excludes booleans; integer/float only)
        if isinstance(instance, (int, float)) and not isinstance(instance, bool):
            if "minimum" in schema and instance < schema["minimum"]:
                errors.append(ValidationError(path, f"value {instance} < minimum {schema['minimum']}"))
            if "maximum" in schema and instance > schema["maximum"]:
                errors.append(ValidationError(path, f"value {instance} > maximum {schema['maximum']}"))

        # Array constraints (gated by isinstance so item in seen and
        # instance.items() never crash on wrong-type instances)
        if isinstance(instance, list):
            if "minItems" in schema and len(instance) < schema["minItems"]:
                errors.append(ValidationError(path, f"array length {len(instance)} < minItems {schema['minItems']}"))
            if "maxItems" in schema and len(instance) > schema["maxItems"]:
                errors.append(ValidationError(path, f"array length {len(instance)} > maxItems {schema['maxItems']}"))
            if "uniqueItems" in schema and schema["uniqueItems"]:
                seen: list[Any] = []
                for i, item in enumerate(instance):
                    try:
                        duplicate = item in seen
                    except TypeError:
                        errors.append(
                            ValidationError(
                                f"{path}[{i}]",
                                "unhashable item; uniqueItems not applicable to nested objects",
                            )
                        )
                        duplicate = False  # skip further checks
                    if duplicate:
                        errors.append(ValidationError(f"{path}[{i}]", f"duplicate item (uniqueItems violated)"))
                        break
                    seen.append(item)
            if "items" in schema:
                items_schema = schema["items"]
                for i, item in enumerate(instance):
                    self.validate(item, items_schema, f"{path}[{i}]", errors)

        # Object constraints (gated by isinstance)
        if isinstance(instance, dict):
            if "required" in schema:
                for key in schema["required"]:
                    if key not in instance:
                        errors.append(ValidationError(path, f"missing required property {key!r}"))
            if "properties" in schema:
                for key, value in instance.items():
                    if key in schema["properties"]:
                        self.validate(value, schema["properties"][key], f"{path}.{key}", errors)
            if schema.get("additionalProperties") is False:
                allowed = set(schema.get("properties", {}).keys())
                if allowed or "required" in schema:
                    for key in instance.keys():
                        if key not in allowed:
                            errors.append(ValidationError(f"{path}.{key}", f"unknown property {key!r} (additionalProperties: false)"))

    def _check_type(self, instance: Any, t: str | list) -> bool:
        if isinstance(t, list):
            return any(self._check_type(instance, sub) for sub in t)
        if t == "null":
            return instance is None
        if t == "boolean":
            return isinstance(instance, bool)
        if t == "integer":
            return isinstance(instance, int) and not isinstance(instance, bool)
        if t == "number":
            return isinstance(instance, (int, float)) and not isinstance(instance, bool)
        if t == "string":
            return isinstance(instance, str)
        if t == "array":
            return isinstance(instance, list)
        if t == "object":
            return isinstance(instance, dict)
        return False


# ---------------------------------------------------------------------------
# Top-level validation runner
# ---------------------------------------------------------------------------


def _format_path(absolute_path: Iterable) -> str:
    """Format a jsonschema absolute_path as a human-readable string.
    Object keys are joined with '.', array indices with '[i]'. If the
    result is empty, returns '<root>'."""
    parts: list[str] = []
    for p in absolute_path:
        if isinstance(p, int):
            parts.append(f"[{p}]")
        else:
            parts.append(f".{p}" if parts else str(p))
    return "".join(parts) or "<root>"


def validate_all(schema: dict, data: dict) -> tuple[int, list[str]]:
    """Validate `data` against `schema`. Returns (exit_code, message_lines)."""

    # 1. Check schema self-reference (canonical URI, not substring match)
    schema_self = schema.get("$schema")
    if schema_self is None:
        return 3, ["tools.schema.json: missing $schema declaration"]
    if schema_self != "http://json-schema.org/draft-07/schema#":
        return 3, [f"tools.schema.json: unsupported $schema: {schema_self!r}"]

    # 2. Check schema well-formedness
    schema_errors = validate_schema_wellformed(schema, schema)
    if schema_errors:
        return 3, [f"tools.schema.json: {e}" for e in schema_errors]

    # 3. Validate tools.json against schema
    validation_errors: list[ValidationError] = []

    # Try jsonschema first; fall back to the hand-rolled walker
    try:
        import jsonschema  # type: ignore[import-not-found]

        validator_cls = jsonschema.Draft7Validator
        validator = validator_cls(schema)
        for err in sorted(validator.iter_errors(data), key=lambda e: list(e.absolute_path)):
            validation_errors.append(ValidationError(_format_path(err.absolute_path), err.message))
    except ImportError:
        fallback = FallbackValidator(schema)
        fallback.validate(data, schema, "<root>", validation_errors)

    if validation_errors:
        return 1, [str(e) for e in validation_errors]

    return 0, ["tools.json: OK"]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Validate tools.json against tools.schema.json (pure-stdlib)",
    )
    parser.add_argument("--root", default=None, help="Path to repo root (auto-detected if omitted)")
    parser.add_argument("--schema-only", action="store_true", help="Only validate the schema itself")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve() if args.root else find_repo_root(Path.cwd())
    schema_path = root / "tools.schema.json"
    data_path = root / "tools.json"

    # Always validate the schema first
    schema, schema_err = load_json(schema_path)
    if schema_err is not None:
        print(f"tools.schema.json: {schema_err}", file=sys.stderr)
        return 2
    if not isinstance(schema, dict):
        print("tools.schema.json: top-level value must be an object", file=sys.stderr)
        return 3

    schema_errors = validate_schema_wellformed(schema, schema)
    if schema_errors:
        for line in schema_errors:
            print(f"tools.schema.json: {line}", file=sys.stderr)
        return 3

    if args.schema_only:
        print("tools.schema.json: OK")
        return 0

    # Now load and validate tools.json
    data, data_err = load_json(data_path)
    if data_err is not None:
        print(f"tools.json: {data_err}", file=sys.stderr)
        return 2
    if not isinstance(data, dict):
        print("tools.json: top-level value must be an object", file=sys.stderr)
        return 1

    exit_code, messages = validate_all(schema, data)
    for line in messages:
        if exit_code == 0:
            print(line)
        else:
            print(line, file=sys.stderr)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
