#!/bin/bash
# Download DuckDB worker and WASM files for same-origin serving
# This avoids Safari CORS issues with blob URLs

VERSION="1.31.0"
CDN_BASE="https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${VERSION}/dist"
STATIC_DIR="static"

echo "Downloading DuckDB files v${VERSION}..."

curl -o "${STATIC_DIR}/duckdb-browser-eh.worker.min.js" "${CDN_BASE}/duckdb-browser-eh.worker.js"
curl -o "${STATIC_DIR}/duckdb-browser-mvp.worker.min.js" "${CDN_BASE}/duckdb-browser-mvp.worker.js"
curl -o "${STATIC_DIR}/duckdb-eh.wasm" "${CDN_BASE}/duckdb-eh.wasm"
curl -o "${STATIC_DIR}/duckdb-mvp.wasm" "${CDN_BASE}/duckdb-mvp.wasm"

echo "DuckDB files downloaded successfully"
