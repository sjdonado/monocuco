#!/bin/bash
# Download DuckDB worker files for same-origin serving
# This avoids Safari CORS issues with blob URLs while keeping large WASM files on CDN

VERSION="1.31.0"
CDN_BASE="https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${VERSION}/dist"
STATIC_DIR="static"

echo "Downloading DuckDB artifacts v${VERSION} to ${STATIC_DIR}..."

curl -L -o "${STATIC_DIR}/duckdb-browser-eh.worker.min.js" "${CDN_BASE}/duckdb-browser-eh.worker.js"
curl -L -o "${STATIC_DIR}/duckdb-browser-mvp.worker.min.js" "${CDN_BASE}/duckdb-browser-mvp.worker.js"
curl -L "${CDN_BASE}/duckdb-eh.wasm" | gzip -c > "${STATIC_DIR}/duckdb-eh.wasm"
curl -L "${CDN_BASE}/duckdb-mvp.wasm" | gzip -c > "${STATIC_DIR}/duckdb-mvp.wasm"

echo "DuckDB artifacts downloaded successfully"
