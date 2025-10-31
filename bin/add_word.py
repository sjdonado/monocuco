#!/usr/bin/env python3
"""CLI to append a new word entry to the project Parquet dataset."""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import uuid
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

DEFAULT_PARQUET_PATH = Path("static/data.parquet")
DEFAULT_JSON_PATH = Path("static/data.json")


def _iso_now() -> str:
    """Return an ISO 8601 timestamp with Z suffix."""
    return _dt.datetime.now(tz=_dt.timezone.utc).isoformat().replace("+00:00", "Z")


def _load_existing_table(parquet_path: Path) -> pa.Table | None:
    if parquet_path.exists():
        return pq.read_table(parquet_path)
    return None


def _build_schema(existing: pa.Table | None) -> pa.Schema:
    if existing is not None:
        return existing.schema

    created_by_struct = pa.struct(
        [
            pa.field("name", pa.string()),
            pa.field("website", pa.string()),
        ]
    )

    return pa.schema(
        [
            pa.field("id", pa.string()),
            pa.field("word", pa.string()),
            pa.field("definition", pa.string()),
            pa.field("example", pa.string()),
            pa.field("createdBy", created_by_struct),
            pa.field("createdAt", pa.string()),
        ]
    )


def _normalize_created_by(name: str | None, website: str | None) -> dict[str, str | None]:
    return {
        "name": name.strip() if name else None,
        "website": website.strip() if website else None,
    }


def _table_from_entry(schema: pa.Schema, entry: dict[str, Any]) -> pa.Table:
    created_by_type = schema.field("createdBy").type
    batch = pa.Table.from_pydict(
        {
            "id": [entry["id"]],
            "word": [entry["word"]],
            "definition": [entry["definition"]],
            "example": [entry["example"]],
            "createdBy": pa.array([entry["createdBy"]], type=created_by_type),
            "createdAt": [entry["createdAt"]],
        },
        schema=schema,
    )
    return batch


def _write_table(table: pa.Table, parquet_path: Path) -> None:
    pq.write_table(table, parquet_path, version="2.6", compression="snappy")


def _append_json_entry(entry: dict[str, Any], json_path: Path) -> None:
    records: list[dict[str, Any]]
    if json_path.exists():
        records = json.loads(json_path.read_text(encoding="utf-8"))
    else:
        json_path.parent.mkdir(parents=True, exist_ok=True)
        records = []

    records.append(entry)
    json_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("word", help="Word or expression to add")
    parser.add_argument("definition", help="Definition in markdown")
    parser.add_argument(
        "-e",
        "--example",
        default="",
        help="Example usage (markdown, optional)",
    )
    parser.add_argument("--author", help="Author name", default=None)
    parser.add_argument("--website", help="Author website", default=None)
    parser.add_argument(
        "--created-at",
        help="ISO timestamp (defaults to current UTC time)",
        default=None,
    )
    parser.add_argument(
        "--parquet",
        type=Path,
        default=DEFAULT_PARQUET_PATH,
        help=f"Target Parquet file (default: {DEFAULT_PARQUET_PATH})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the would-be entry without writing to disk",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    parquet_path: Path = args.parquet
    parquet_path.parent.mkdir(parents=True, exist_ok=True)
    json_path: Path | None = (
        DEFAULT_JSON_PATH
        if parquet_path.resolve() == DEFAULT_PARQUET_PATH.resolve()
        else None
    )

    created_at = args.created_at or _iso_now()
    entry_id = str(uuid.uuid4())

    entry = {
        "id": entry_id,
        "word": args.word.strip(),
        "definition": args.definition.strip(),
        "example": args.example.strip(),
        "createdBy": _normalize_created_by(args.author, args.website),
        "createdAt": created_at,
    }

    if args.dry_run:
        print(json.dumps(entry, ensure_ascii=False, indent=2))
        return

    existing = _load_existing_table(parquet_path)
    schema = _build_schema(existing)
    if "id" not in schema.names:
        raise RuntimeError(
            "Parquet schema missing 'id' column. Run bin/json_to_parquet.py to migrate the dataset."
        )
    new_table = _table_from_entry(schema, entry)

    if existing is not None:
        combined = pa.concat_tables([existing, new_table], promote=True)
    else:
        combined = new_table

    _write_table(combined, parquet_path)
    if json_path is not None:
        _append_json_entry(entry, json_path)
    print(f"✅ Added '{entry['word']}' to {parquet_path}")


if __name__ == "__main__":
    main()
