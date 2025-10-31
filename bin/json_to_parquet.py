#!/usr/bin/env python3
"""Convert the JSON dataset into the Parquet format used by the app."""

from __future__ import annotations

import argparse
import json
import uuid
from collections.abc import Iterable
from pathlib import Path
from typing import Any, TypedDict, cast

import pyarrow as pa
import pyarrow.parquet as pq

DEFAULT_JSON_PATH = Path("static/data.json")
DEFAULT_PARQUET_PATH = Path("static/data.parquet")


class CreatedBy(TypedDict, total=False):
    name: str | None
    website: str | None


class NormalisedEntry(TypedDict):
    id: str
    word: str
    definition: str
    example: str
    createdBy: CreatedBy
    createdAt: str


def load_json(json_path: Path) -> list[dict[str, Any]]:
    with json_path.open("r", encoding="utf-8") as handle:
        data: Any = json.load(handle)
    if not isinstance(data, list):
        raise RuntimeError("Dataset JSON must be a list of entries")

    entries: list[dict[str, Any]] = []
    for item in data:
        if not isinstance(item, dict):
            raise RuntimeError("Dataset JSON entries must be objects")
        entries.append(cast(dict[str, Any], item))
    return entries


def _coerce_entry(raw: dict[str, Any]) -> NormalisedEntry:
    def _to_str(value: Any) -> str:
        if isinstance(value, str):
            return value
        return str(value) if value is not None else ""

    def _to_optional_str(value: Any) -> str | None:
        text = _to_str(value)
        return text if text else None

    raw_id = raw.get("id")
    if isinstance(raw_id, str) and raw_id.strip():
        entry_id = raw_id.strip()
    else:
        entry_id = str(uuid.uuid4())

    if "word" in raw:
        created_by = raw.get("createdBy") or {}
        return {
            "id": entry_id,
            "word": _to_str(raw.get("word")),
            "definition": _to_str(raw.get("definition", "")),
            "example": _to_str(raw.get("example", "")),
            "createdBy": {
                "name": _to_optional_str(created_by.get("name")),
                "website": _to_optional_str(created_by.get("website")),
            },
            "createdAt": _to_str(raw.get("createdAt", "")),
        }

    synonyms = raw.get("synonyms") or []
    cleaned_synonyms = ", ".join(
        _to_str(s).strip() for s in synonyms if _to_str(s).strip()
    )
    definition = _to_str(raw.get("meaning", "")).strip()
    if cleaned_synonyms:
        definition = f"{definition}\n\nSinónimos: {cleaned_synonyms}"

    authors = raw.get("authors") or []
    author_names = ", ".join(
        _to_str(a.get("name")).strip()
        for a in authors
        if _to_str(a.get("name")).strip()
    )
    author_websites = ", ".join(
        _to_str(a.get("link")).strip()
        for a in authors
        if _to_str(a.get("link")).strip()
    )

    return {
        "id": entry_id,
        "word": _to_str(raw.get("text", "")),
        "definition": definition,
        "example": "\n".join(
            _to_str(ex).strip("\n") for ex in (raw.get("examples") or [])
        ),
        "createdBy": {
            "name": author_names or None,
            "website": author_websites or None,
        },
        "createdAt": _to_str(raw.get("createdAt", "2021-08-31T00:00:00.000Z")),
    }


def transform_entries(data: Iterable[dict[str, Any]]) -> list[NormalisedEntry]:
    transformed: list[NormalisedEntry] = []
    for entry in data:
        transformed.append(_coerce_entry(entry))
    return transformed


def write_parquet(entries: list[NormalisedEntry], parquet_path: Path) -> None:
    created_by_struct = pa.struct(
        [
            pa.field("name", pa.string()),
            pa.field("website", pa.string()),
        ]
    )
    schema = pa.schema(
        [
            pa.field("id", pa.string()),
            pa.field("word", pa.string()),
            pa.field("definition", pa.string()),
            pa.field("example", pa.string()),
            pa.field("createdBy", created_by_struct),
            pa.field("createdAt", pa.string()),
        ]
    )

    table = pa.Table.from_pydict(
        {
            "id": [entry["id"] for entry in entries],
            "word": [entry["word"] for entry in entries],
            "definition": [entry["definition"] for entry in entries],
            "example": [entry["example"] for entry in entries],
            "createdBy": pa.array(
                [entry["createdBy"] for entry in entries],
                type=created_by_struct,
            ),
            "createdAt": [entry["createdAt"] for entry in entries],
        },
        schema=schema,
    )

    parquet_path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, parquet_path, version="2.6", compression="snappy")


def save_json(entries: list[NormalisedEntry], json_path: Path) -> None:
    json_path.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--json",
        type=Path,
        default=DEFAULT_JSON_PATH,
        help=f"Source JSON file (default: {DEFAULT_JSON_PATH})",
    )
    parser.add_argument(
        "--parquet",
        type=Path,
        default=DEFAULT_PARQUET_PATH,
        help=f"Destination Parquet file (default: {DEFAULT_PARQUET_PATH})",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data = load_json(args.json)
    entries = transform_entries(data)
    save_json(entries, args.json)
    write_parquet(entries, args.parquet)
    print(f"✅ Migrated {len(entries)} entries from {args.json} -> {args.parquet}")


if __name__ == "__main__":
    main()
