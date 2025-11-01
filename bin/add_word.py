#!/usr/bin/env python3
"""CLI to append a new word entry to the project Parquet dataset."""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import unicodedata
import uuid
from pathlib import Path
from typing import Any

import pyarrow as pa
import pyarrow.parquet as pq

DEFAULT_PARQUET_PATH = Path("static/data.parquet")
DEFAULT_JSON_PATH = Path("static/data.json")
README_PATH = Path("README.md")
CONTRIBUTORS_HEADER = "## Contribuidores"


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


def _normalize_created_by(
    name: str | None, website: str | None
) -> dict[str, str | None]:
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
    json_path.write_text(
        json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _split_markdown_row(line: str) -> list[str]:
    core = line.strip()
    if core.startswith("|"):
        core = core[1:]
    if core.endswith("|"):
        core = core[:-1]
    return [cell.strip() for cell in core.split("|")]


def _format_markdown_row(cells: list[str]) -> str:
    return "| " + " | ".join(cells) + " |"


def _normalize_identifier(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    stripped = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return stripped.strip().lower()


def _normalize_url(url: str | None) -> str:
    if not url:
        return ""
    cleaned = url.strip()
    cleaned = re.sub(r"^https?://", "", cleaned, flags=re.IGNORECASE)
    return cleaned.rstrip("/").lower()


def _display_label(url: str) -> str:
    label = re.sub(r"^https?://", "", url.strip(), flags=re.IGNORECASE)
    label = label.rstrip("/")
    return label or url.strip()


def _format_profile_cell(website: str | None) -> str:
    if not website:
        return ""
    return f"[{_display_label(website)}]({website.strip()})"


def _extract_link_url(cell: str) -> str:
    match = re.search(r"\]\(([^)]+)\)", cell)
    if match:
        return match.group(1).strip()
    return cell.strip()


def _find_column(headers: list[str], targets: set[str]) -> int | None:
    normalized_targets = {_normalize_identifier(target) for target in targets}
    for idx, header in enumerate(headers):
        if _normalize_identifier(header) in normalized_targets:
            return idx
    return None


def _build_grid_contributor_cell(name: str, website: str | None) -> str:
    label = name.strip()
    href = (website or "").strip()
    return (
        f'<a href="{href}"><img src="" width="100px;" alt="{label}"/><br /><sub><b>{label}</b></sub></a>'
    )


def _update_cell_link(cell: str, website: str | None) -> tuple[str, bool]:
    if not website:
        return cell, False
    target = website.strip()
    if not target:
        return cell, False
    pattern = re.compile(r'href="([^"]*)"')
    match = pattern.search(cell)
    if match:
        current = match.group(1)
        if current == target:
            return cell, False
        return pattern.sub(f'href="{target}"', cell, count=1), True
    return f'<a href="{target}">{cell}</a>', True


def _handle_grid_contributors_table(
    author_name: str,
    website: str | None,
    header_cells: list[str],
    data_lines: list[str],
    lines: list[str],
    table_start: int,
    table_end: int,
    table_lines: list[str],
    readme_path: Path,
) -> bool:
    columns = len(header_cells)
    if columns == 0:
        print("⚠️ La tabla de contribuidores no tiene columnas; omitiendo la actualización.")
        return False

    rows: list[list[str]] = []
    for line in data_lines:
        if not line.strip().startswith("|"):
            continue
        cells = _split_markdown_row(line)
        if len(cells) < columns:
            cells.extend([""] * (columns - len(cells)))
        rows.append(cells)

    flat_cells = [cell for row in rows for cell in row]
    normalized_author = _normalize_identifier(author_name)

    for idx, cell in enumerate(flat_cells):
        if not cell.strip():
            continue
        if normalized_author and normalized_author in _normalize_identifier(cell):
            updated_cell, changed = _update_cell_link(cell, website)
            if changed:
                flat_cells[idx] = updated_cell
                new_rows = [
                    flat_cells[i : i + columns] for i in range(0, len(flat_cells), columns)
                ]
                formatted = [
                    _format_markdown_row(row) for row in new_rows if any(item.strip() for item in row)
                ]
                lines[table_start:table_end] = [table_lines[0], table_lines[1], *formatted]
                readme_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
                print(f"ℹ️ README.md ya incluía a {author_name}; la información fue actualizada.")
            else:
                print(f"ℹ️ README.md ya incluía a {author_name}.")
            return True

    new_cell = _build_grid_contributor_cell(author_name, website)
    try:
        empty_index = next(
            idx for idx, cell in enumerate(flat_cells) if not cell.strip()
        )
    except StopIteration:
        empty_index = None

    if empty_index is None:
        flat_cells.append(new_cell)
        while len(flat_cells) % columns != 0:
            flat_cells.append("")
    else:
        flat_cells[empty_index] = new_cell

    new_rows = [
        flat_cells[i : i + columns] for i in range(0, len(flat_cells), columns)
    ]
    formatted_rows = [
        _format_markdown_row(row) for row in new_rows if any(item.strip() for item in row)
    ]
    lines[table_start:table_end] = [table_lines[0], table_lines[1], *formatted_rows]
    readme_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"✅ README.md actualizado con {author_name} en la lista de contribuidores.")
    return True


def _maybe_update_readme_contributors(
    author: str | None, website: str | None, readme_path: Path = README_PATH
) -> bool:
    author_name = (author or "").strip()
    if not author_name:
        return False

    if not readme_path.exists():
        print("⚠️ README.md no encontrado; omitiendo la actualización de contribuidores.")
        return False

    content = readme_path.read_text(encoding="utf-8")
    lines = content.splitlines()

    header_idx: int | None = None
    for idx, line in enumerate(lines):
        if _normalize_identifier(line) == _normalize_identifier(CONTRIBUTORS_HEADER):
            header_idx = idx
            break

    if header_idx is None:
        print("⚠️ No se encontró la sección '## Contribuidores' en README.md; omitiendo la actualización.")
        return False

    table_start: int | None = None
    for idx in range(header_idx + 1, len(lines)):
        if lines[idx].strip().startswith("|"):
            table_start = idx
            break

    if table_start is None:
        print(
            "⚠️ No se encontró una tabla Markdown de contribuidores en README.md; omitiendo la actualización."
        )
        return False

    table_end = len(lines)
    for idx in range(table_start, len(lines)):
        if not lines[idx].strip().startswith("|"):
            table_end = idx
            break

    table_lines = lines[table_start:table_end]
    if len(table_lines) < 2:
        print(
            "⚠️ La tabla de contribuidores parece incompleta; omitiendo la actualización."
        )
        return False

    header_cells = _split_markdown_row(table_lines[0])
    data_lines = table_lines[2:]

    name_idx = _find_column(header_cells, {"nombre", "autor", "name"})
    website_idx = _find_column(header_cells, {"perfil", "website", "sitio", "enlace", "url"})
    avatar_idx = _find_column(header_cells, {"foto", "avatar", "imagen", "photo"})

    if name_idx is None:
        return _handle_grid_contributors_table(
            author_name,
            website,
            header_cells,
            data_lines,
            lines,
            table_start,
            table_end,
            table_lines,
            readme_path,
        )

    author_identifier = _normalize_identifier(author_name)
    website_identifier = _normalize_url(website)
    data_lines_out = list(table_lines[2:])

    for row_idx, line in enumerate(data_lines):
        if not line.strip().startswith("|"):
            continue
        cells = _split_markdown_row(line)
        if len(cells) < len(header_cells):
            cells.extend([""] * (len(header_cells) - len(cells)))

        existing_name = _normalize_identifier(cells[name_idx]) if name_idx < len(cells) else ""
        if author_identifier and existing_name == author_identifier:
            updated = False
            if website and website_idx is not None:
                existing_url = _extract_link_url(cells[website_idx]) if website_idx < len(cells) else ""
                if _normalize_url(existing_url) != website_identifier:
                    cells[website_idx] = _format_profile_cell(website)
                    updated = True
            if updated:
                data_lines_out[row_idx] = _format_markdown_row(cells)
                lines[table_start:table_end] = [table_lines[0], table_lines[1], *data_lines_out]
                readme_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
                print(f"ℹ️ README.md ya incluía a {author_name}; la información fue actualizada.")
            else:
                print(f"ℹ️ README.md ya incluía a {author_name}.")
            return True

    new_row_cells = [""] * len(header_cells)
    new_row_cells[name_idx] = author_name
    if website and website_idx is not None:
        new_row_cells[website_idx] = _format_profile_cell(website)
    if avatar_idx is not None:
        new_row_cells[avatar_idx] = ""

    data_lines_out.append(_format_markdown_row(new_row_cells))
    lines[table_start:table_end] = [table_lines[0], table_lines[1], *data_lines_out]
    readme_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"✅ README.md actualizado con {author_name} en la lista de contribuidores.")
    return True


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "-w",
        "--word",
        required=True,
        help="Word or expression to add",
    )
    parser.add_argument(
        "-d",
        "--definition",
        required=True,
        help="Definition in markdown",
    )
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
    return parser.parse_args(argv)


def add_entry(
    *,
    word: str,
    definition: str,
    example: str = "",
    author: str | None = None,
    website: str | None = None,
    created_at: str | None = None,
    parquet: Path | str = DEFAULT_PARQUET_PATH,
    dry_run: bool = False,
) -> dict[str, Any]:
    parquet_path = Path(parquet)
    parquet_path.parent.mkdir(parents=True, exist_ok=True)
    json_path: Path | None = (
        DEFAULT_JSON_PATH
        if parquet_path.resolve() == DEFAULT_PARQUET_PATH.resolve()
        else None
    )

    created_at_value = created_at or _iso_now()
    entry_id = str(uuid.uuid4())

    entry = {
        "id": entry_id,
        "word": word.strip(),
        "definition": definition.strip(),
        "example": example.strip(),
        "createdBy": _normalize_created_by(author, website),
        "createdAt": created_at_value,
    }

    if dry_run:
        print(json.dumps(entry, ensure_ascii=False, indent=2))
        return entry

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
    try:
        _maybe_update_readme_contributors(author, website)
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️ No se pudo actualizar README.md automáticamente: {exc}")
    print(f"✅ Added '{entry['word']}' to {parquet_path}")
    return entry


def main() -> None:
    args = parse_args()
    add_entry(
        word=args.word,
        definition=args.definition,
        example=args.example,
        author=args.author,
        website=args.website,
        created_at=args.created_at,
        parquet=args.parquet,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
