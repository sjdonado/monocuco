#!/bin/bash
# Download DuckDB worker files for same-origin serving
# This avoids Safari CORS issues with blob URLs while keeping large WASM files on CDN

VERSION="1.31.0"
CDN_BASE="https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${VERSION}/dist"
STATIC_DIR="static"

echo "Downloading DuckDB artifacts v${VERSION} to ${STATIC_DIR}..."

curl -L -o "${STATIC_DIR}/duckdb-browser-eh.worker.min.js" "${CDN_BASE}/duckdb-browser-eh.worker.js"
curl -L -o "${STATIC_DIR}/duckdb-browser-mvp.worker.min.js" "${CDN_BASE}/duckdb-browser-mvp.worker.js"
curl -L -o "${STATIC_DIR}/duckdb-eh.wasm" "${CDN_BASE}/duckdb-eh.wasm"
curl -L -o "${STATIC_DIR}/duckdb-mvp.wasm" "${CDN_BASE}/duckdb-mvp.wasm"

if command -v gzip >/dev/null 2>&1; then
  echo "Compressing WASM artifacts..."
  gzip -kf "${STATIC_DIR}/duckdb-eh.wasm"
  gzip -kf "${STATIC_DIR}/duckdb-mvp.wasm"
else
  echo "gzip not found; skipping compression. Compress manually or install gzip."
fi

echo "DuckDB artifacts downloaded successfully"
