#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

bashio::log.level "$(bashio::config 'log_level')"

if bashio::config.is_empty 'api_key'; then
    bashio::exit.nok "No Mistral API key. Fill it in on the add-on's Configuration tab."
fi

# wyoming-openai reads its whole configuration from the environment; there is
# nothing to pass on the command line. Both LANGUAGES and MODELS are split on
# whitespace by the program, so "ru en" is two languages and "ru,en" is one
# language literally named "ru,en" that nothing will ever match.
WYOMING_URI="tcp://0.0.0.0:10300"
WYOMING_LANGUAGES="$(bashio::config 'languages')"
WYOMING_LOG_LEVEL="$(bashio::config 'log_level' | tr '[:lower:]' '[:upper:]')"
STT_BACKEND="OPENAI"
STT_OPENAI_KEY="$(bashio::config 'api_key')"
STT_OPENAI_URL="$(bashio::config 'stt_url')"
STT_MODELS="$(bashio::config 'stt_model')"
export WYOMING_URI WYOMING_LANGUAGES WYOMING_LOG_LEVEL
export STT_BACKEND STT_OPENAI_KEY STT_OPENAI_URL STT_MODELS

ADDON_VERSION="$(bashio::addon.version 2>/dev/null || echo 'unknown')"

bashio::log.info "Wyoming OpenAI ${ADDON_VERSION}: model ${STT_MODELS}, languages ${WYOMING_LANGUAGES}, endpoint ${STT_OPENAI_URL}"

# The package installs no console script, so the module is the entry point.
exec python3 -m wyoming_openai
