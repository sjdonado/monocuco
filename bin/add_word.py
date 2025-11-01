#!/usr/bin/env python3
"""CLI to append a new word entry to the project Parquet dataset."""

from __future__ import annotations

import datetime as _dt
import json
import re
import unicodedata
import uuid
from pathlib import Path
from typing import Any

import click
import pyarrow as pa
import pyarrow.parquet as pq

DEFAULT_PARQUET_PATH = Path("../static/data.parquet")
DEFAULT_JSON_PATH = Path("../data.json")
README_PATH = Path("../README.md")
CONTRIBUTORS_HEADER = "## Contribuidores"


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


def _format_profile_cell(website: str | None) -> str:
    if not website:
        return ""
    cleaned = website.strip()
    if not cleaned:
        return ""
    label = re.sub(r"^https?://", "", cleaned, flags=re.IGNORECASE).rstrip("/")
    return f"[{label or cleaned}]({cleaned})"


def _find_column(headers: list[str], targets: set[str]) -> int | None:
    normalized_targets = {_normalize_identifier(target) for target in targets}
    for idx, header in enumerate(headers):
        if _normalize_identifier(header) in normalized_targets:
            return idx
    return None


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
                if website:
                    target = website.strip()
                    if target:
                        pattern = re.compile(r'href="([^"]*)"')
                        match = pattern.search(cell)
                        if match:
                            current = match.group(1)
                            if current != target:
                                flat_cells[idx] = pattern.sub(f'href="{target}"', cell, count=1)
                                new_rows = [
                                    flat_cells[i : i + columns]
                                    for i in range(0, len(flat_cells), columns)
                                ]
                                formatted = [
                                    _format_markdown_row(row)
                                    for row in new_rows
                                    if any(item.strip() for item in row)
                                ]
                                lines[table_start:table_end] = [table_lines[0], table_lines[1], *formatted]
                                readme_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
                                print(f"ℹ️ README.md ya incluía a {author_name}; la información fue actualizada.")
                            else:
                                print(f"ℹ️ README.md ya incluía a {author_name}.")
                            return True
                        flat_cells[idx] = f'<a href="{target}">{cell}</a>'
                        new_rows = [
                            flat_cells[i : i + columns]
                            for i in range(0, len(flat_cells), columns)
                        ]
                        formatted = [
                            _format_markdown_row(row)
                            for row in new_rows
                            if any(item.strip() for item in row)
                        ]
                        lines[table_start:table_end] = [table_lines[0], table_lines[1], *formatted]
                        readme_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
                        print(f"ℹ️ README.md ya incluía a {author_name}; la información fue actualizada.")
                        return True
                print(f"ℹ️ README.md ya incluía a {author_name}.")
                return True

        label = author_name.strip()
        href = (website or "").strip()
        new_cell = (
            f'<a href="{href}"><img src="" width="100px;" alt="{label}"/><br /><sub><b>{label}</b></sub></a>'
        )
        empty_index = next((i for i, cell in enumerate(flat_cells) if not cell.strip()), None)

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
                existing_cell = cells[website_idx] if website_idx < len(cells) else ""
                match = re.search(r"\]\(([^)]+)\)", existing_cell)
                existing_url = match.group(1).strip() if match else existing_cell.strip()
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

    timestamp = created_at or _dt.datetime.now(tz=_dt.timezone.utc).isoformat().replace("+00:00", "Z")
    entry_id = str(uuid.uuid4())

    trimmed_word = word.strip()
    normalized_word = trimmed_word[:1].upper() + trimmed_word[1:] if trimmed_word else ""
    cleaned_definition = definition.strip()

    normalized_example = ""
    if example:
        example_lines = [line.strip() for line in example.splitlines() if line.strip()]
        if example_lines:
            formatted_lines: list[str] = []
            for line in example_lines:
                if line.startswith('"') and line.endswith('"'):
                    formatted_lines.append(line)
                else:
                    formatted_lines.append(f'"{line}"')
            normalized_example = "\n".join(formatted_lines)

    author_value = author.strip() if author and author.strip() else None
    website_value = website.strip() if website and website.strip() else None

    entry = {
        "id": entry_id,
        "word": normalized_word,
        "definition": cleaned_definition,
        "example": normalized_example,
        "createdBy": {
            "name": author_value,
            "website": website_value,
        },
        "createdAt": timestamp,
    }

    if dry_run:
        print(json.dumps(entry, ensure_ascii=False, indent=2))
        return entry

    existing_table = pq.read_table(parquet_path) if parquet_path.exists() else None
    if existing_table is not None:
        schema = existing_table.schema
        created_by_type = schema.field("createdBy").type
    else:
        created_by_type = pa.struct(
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
                pa.field("createdBy", created_by_type),
                pa.field("createdAt", pa.string()),
            ]
        )

    if "id" not in schema.names:
        raise RuntimeError(
            "Parquet schema missing 'id' column. Run bin/json_to_parquet.py to migrate the dataset."
        )

    new_table = pa.Table.from_pydict(
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

    combined_table = (
        pa.concat_tables([existing_table, new_table], promote=True)
        if existing_table is not None
        else new_table
    )

    pq.write_table(combined_table, parquet_path, version="2.6", compression="snappy")

    if json_path is not None:
        if json_path.exists():
            records = json.loads(json_path.read_text(encoding="utf-8"))
        else:
            json_path.parent.mkdir(parents=True, exist_ok=True)
            records = []
        records.append(entry)
        json_path.write_text(
            json.dumps(records, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    try:
        _maybe_update_readme_contributors(author, website)
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️ No se pudo actualizar README.md automáticamente: {exc}")
    print(f"✅ Added '{entry['word']}' to {parquet_path}")
    return entry


@click.command()
@click.option("-w", "--word", required=True, help="Word or expression to add")
@click.option("-d", "--definition", required=True, help="Definition in markdown")
@click.option("-e", "--example", default="", help="Example usage (markdown, optional)")
@click.option("--author", default=None, help="Author name")
@click.option("--website", default=None, help="Author website")
@click.option(
    "--created-at",
    default=None,
    help="ISO timestamp (defaults to current UTC time)",
)
@click.option(
    "--parquet",
    type=click.Path(path_type=Path),
    default=DEFAULT_PARQUET_PATH,
    show_default=True,
    help="Target Parquet file",
)
@click.option(
    "--dry-run",
    is_flag=True,
    help="Print the would-be entry without writing to disk",
)
def cli(
    *,
    word: str,
    definition: str,
    example: str,
    author: str | None,
    website: str | None,
    created_at: str | None,
    parquet: Path,
    dry_run: bool,
) -> None:
    """CLI facade for add_entry."""
    add_entry(
        word=word,
        definition=definition,
        example=example,
        author=author,
        website=website,
        created_at=created_at,
        parquet=parquet,
        dry_run=dry_run,
    )


if __name__ == "__main__":
    cli()
