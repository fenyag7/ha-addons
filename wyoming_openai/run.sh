#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

readonly PORT=10300

bashio::log.level "$(bashio::config 'log_level')"

# bashio::config prints the literal string "null" for a key that is missing
# from options.json altogether, which is not what any caller here wants an
# unset option to look like.
config_or_empty() {
    if bashio::config.has_value "${1}"; then
        bashio::config "${1}"
    fi
}

# wyoming-openai reads its whole configuration from the environment; there is
# nothing to pass on the command line. LANGUAGES, MODELS and VOICES are all
# split on whitespace by the program, so "ru en" is two languages and "ru,en"
# is one language literally named "ru,en" that nothing will ever match.
WYOMING_URI="tcp://0.0.0.0:${PORT}"
WYOMING_LANGUAGES="$(bashio::config 'languages')"
WYOMING_LOG_LEVEL="$(bashio::config 'log_level' | tr '[:lower:]' '[:upper:]')"
export WYOMING_URI WYOMING_LANGUAGES WYOMING_LOG_LEVEL

api_key="$(config_or_empty 'api_key')"
stt_url="$(bashio::config 'stt_url')"
stt_model="$(config_or_empty 'stt_model')"
stt_mode="$(bashio::config 'stt_mode')"
tts_url="$(bashio::config 'tts_url')"
tts_key="$(config_or_empty 'tts_api_key')"
tts_model="$(config_or_empty 'tts_model')"
tts_voices="$(config_or_empty 'tts_voices')"
tts_instructions="$(config_or_empty 'tts_instructions')"

if bashio::var.is_empty "${stt_model}" && bashio::var.is_empty "${tts_model}"; then
    bashio::exit.nok \
        "Both the speech-to-text and the text-to-speech model are empty, so there is nothing to serve. Fill in at least one on the Configuration tab."
fi

# A local backend (Kokoro-FastAPI, Speaches, LocalAI, openai-edge-tts) needs no
# key, so an empty one is only fatal when a paid cloud endpoint is configured.
# Caught here rather than on the first spoken command, where the error would
# surface in the Assist debug view instead of the add-on log.
is_cloud() {
    [[ "${1}" == *"api.openai.com"* || "${1}" == *"api.mistral.ai"* ]]
}

if bashio::var.is_empty "${api_key}"; then
    if bashio::var.has_value "${stt_model}" && is_cloud "${stt_url}"; then
        bashio::exit.nok "No API key, and speech-to-text points at ${stt_url}. Fill it in on the add-on's Configuration tab."
    fi
    if bashio::var.has_value "${tts_model}" && bashio::var.is_empty "${tts_key}" \
        && is_cloud "${tts_url}"; then
        bashio::exit.nok "No API key, and text-to-speech points at ${tts_url}. Fill it in on the add-on's Configuration tab."
    fi
fi

# Left unset, the backend is autodetected by probing paths that only the local
# servers answer. That is pointless noise against a host we already recognise,
# so name it for the two known cloud endpoints and let the probes run for
# everything else.
backend_for() {
    if is_cloud "${1}"; then
        echo "OPENAI"
    fi
}

if bashio::var.has_value "${stt_model}"; then
    STT_OPENAI_KEY="${api_key}"
    STT_OPENAI_URL="${stt_url}"
    export STT_OPENAI_KEY STT_OPENAI_URL

    # The three lists are mutually exclusive upstream (realtime beats streaming
    # beats batch), and a model named in only one of them is enough to build an
    # ASR program. So one model name goes into exactly one list.
    case "${stt_mode}" in
        realtime)  STT_REALTIME_MODELS="${stt_model}";  export STT_REALTIME_MODELS ;;
        streaming) STT_STREAMING_MODELS="${stt_model}"; export STT_STREAMING_MODELS ;;
        *)         STT_MODELS="${stt_model}";           export STT_MODELS ;;
    esac

    stt_backend="$(backend_for "${stt_url}")"
    if bashio::var.has_value "${stt_backend}"; then
        STT_BACKEND="${stt_backend}"
        export STT_BACKEND
    fi
fi

if bashio::var.has_value "${tts_model}"; then
    # One key covers the common case of both halves on OpenAI; the override is
    # for a split setup, such as Voxtral for listening and OpenAI for speaking.
    if bashio::var.is_empty "${tts_key}"; then
        tts_key="${api_key}"
    fi

    TTS_OPENAI_KEY="${tts_key}"
    TTS_OPENAI_URL="${tts_url}"
    TTS_SPEED="$(bashio::config 'tts_speed')"
    export TTS_OPENAI_KEY TTS_OPENAI_URL TTS_SPEED

    # A model listed as streaming is announced to Home Assistant with
    # supports_synthesize_streaming, which is what lets playback start before
    # the reply has been written to the end.
    if bashio::config.true 'tts_streaming'; then
        TTS_STREAMING_MODELS="${tts_model}"
        export TTS_STREAMING_MODELS
    else
        TTS_MODELS="${tts_model}"
        export TTS_MODELS
    fi

    # Left unset, the voice list is fetched from the backend, which is what
    # gives Assist every voice the endpoint offers instead of a frozen subset.
    if bashio::var.has_value "${tts_voices}"; then
        TTS_VOICES="${tts_voices}"
        export TTS_VOICES
    fi

    # Only gpt-4o-mini-tts accepts instructions; tts-1 answers 400 to them.
    if bashio::var.has_value "${tts_instructions}"; then
        TTS_INSTRUCTIONS="${tts_instructions}"
        export TTS_INSTRUCTIONS
    fi

    tts_backend="$(backend_for "${tts_url}")"
    if bashio::var.has_value "${tts_backend}"; then
        TTS_BACKEND="${tts_backend}"
        export TTS_BACKEND
    fi
fi

# Home Assistant learns about the service from the Supervisor rather than being
# handed an address by hand. The server has to be answering first, or the config
# flow opens against a closed port and gives up.
announce() {
    local uri="tcp://$(hostname):${PORT}"
    local attempt

    for attempt in $(seq 1 120); do
        if (exec 3<>"/dev/tcp/localhost/${PORT}") 2>/dev/null; then
            break
        fi
        sleep 0.5
    done

    if bashio::discovery "wyoming" "$(bashio::var.json uri "${uri}")" > /dev/null; then
        bashio::log.info "Home Assistant was told about the Wyoming service at ${uri}."
    else
        bashio::log.warning \
            "Could not send discovery to Home Assistant. Add the Wyoming Protocol integration by hand with host localhost and port ${PORT}."
    fi
}

announce &

ADDON_VERSION="$(bashio::addon.version 2>/dev/null || echo 'unknown')"
bashio::log.info "Wyoming OpenAI ${ADDON_VERSION}, languages ${WYOMING_LANGUAGES}"

if bashio::var.has_value "${stt_model}"; then
    bashio::log.info "Speech-to-text: ${stt_model} (${stt_mode}) at ${stt_url}"
else
    bashio::log.info "Speech-to-text: off"
fi

if bashio::var.has_value "${tts_model}"; then
    if bashio::config.true 'tts_streaming'; then
        bashio::log.info "Text-to-speech: ${tts_model} (streaming) at ${tts_url}"
    else
        bashio::log.info "Text-to-speech: ${tts_model} at ${tts_url}"
    fi
else
    bashio::log.info "Text-to-speech: off"
fi

# The package installs no console script, so the module is the entry point.
exec python3 -m wyoming_openai
