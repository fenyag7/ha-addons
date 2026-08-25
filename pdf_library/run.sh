#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

bashio::log.level "$(bashio::config 'log_level')"

LIBRARY_ROOT="$(bashio::config 'library_root')"
MAX_UPLOAD_MB="$(bashio::config 'max_upload_mb')"
UI_LANGUAGE="$(bashio::config 'language')"
LOG_LEVEL="$(bashio::config 'log_level')"
AUTO_COVER="$(bashio::config 'auto_cover')"
ADDON_VERSION="$(bashio::addon.version 2>/dev/null || echo 'unknown')"
export LIBRARY_ROOT MAX_UPLOAD_MB UI_LANGUAGE LOG_LEVEL ADDON_VERSION AUTO_COVER
export PDFJS_ROOT="/opt/pdfjs"

bashio::log.info "PDF Library ${ADDON_VERSION}, library root: ${LIBRARY_ROOT}"
exec python3 /opt/app/server.py
