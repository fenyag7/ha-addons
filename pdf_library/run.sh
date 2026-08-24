#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

bashio::log.level "$(bashio::config 'log_level')"

LIBRARY_ROOT="$(bashio::config 'library_root')"
MAX_UPLOAD_MB="$(bashio::config 'max_upload_mb')"
UI_LANGUAGE="$(bashio::config 'language')"
LOG_LEVEL="$(bashio::config 'log_level')"
export LIBRARY_ROOT MAX_UPLOAD_MB UI_LANGUAGE LOG_LEVEL
export PDFJS_ROOT="/opt/pdfjs"

bashio::log.info "Library root: ${LIBRARY_ROOT}"
exec python3 /opt/app/server.py
