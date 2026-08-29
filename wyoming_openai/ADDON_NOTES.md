# Notes on the upstream package

Answers to the questions that had to be settled before the add-on could be
written. Checked against a `v0.5.0` checkout of `roryeckel/wyoming_openai` (the
latest on PyPI, released 2026-05-25), against `home-assistant/addons` at
`piper/`, and against Mistral's documentation — all as of 2026-08-29. Anything
here can go stale; the sources are named so it can be rechecked rather than
re-guessed.

## 1. Entry point

`python3 -m wyoming_openai`.

`pyproject.toml` has no `[project.scripts]` table, and the published wheel
carries no `entry_points.txt`, so nothing named `wyoming-openai` lands on
`PATH` after a `pip install`. The upstream README claims a console script
exists as an alternative; it does not. Upstream's own Dockerfile ends in
`CMD ["python", "-m", "wyoming_openai"]`, which is the honest answer.

The package lives under `src/wyoming_openai/` with a real `__main__.py`.

## 2. Environment variables

Every setting is an argparse argument whose `default` reads an environment
variable, so anything on the command line has an environment twin. The ones
that matter here:

| Variable | Default | Note |
|---|---|---|
| `WYOMING_URI` | `tcp://0.0.0.0:10300` | |
| `WYOMING_LOG_LEVEL` | `INFO` | Uppercased before use, so case does not matter |
| `WYOMING_LANGUAGES` | `en` | **`.split()` — whitespace, not commas** |
| `STT_OPENAI_KEY` | none | |
| `STT_OPENAI_URL` | `https://api.openai.com/v1` | |
| `STT_MODELS` | none | Also `.split()` |
| `STT_BACKEND` | auto | `OPENAI`, `SPEACHES`, `KOKORO_FASTAPI`, `LOCALAI` |
| `STT_TEMPERATURE` | none | |
| `STT_PROMPT` | none | Style hint passed with each request |
| `STT_EXTRA_BODY` | none | JSON object merged into the request body |
| `STT_STREAMING_MODELS` | none | Models to call with `stream=true` |
| `STT_REALTIME_MODELS` | none | Models to drive over `/v1/realtime` |
| `TTS_OPENAI_KEY` | none | |
| `TTS_OPENAI_URL` | `https://api.openai.com/v1` | |
| `TTS_MODELS` | none | Also `.split()` |
| `TTS_VOICES` | none | `.split()`. Empty means "ask the backend" |
| `TTS_BACKEND` | auto | Same four values as `STT_BACKEND` |
| `TTS_SPEED` | none | 0.25 to 4.0 |
| `TTS_INSTRUCTIONS` | none | `gpt-4o-mini-tts` only |
| `TTS_EXTRA_BODY` | none | `stream`/`stream_format` rejected |
| `TTS_STREAMING_MODELS` | none | Models synthesised sentence by sentence |
| `TTS_STREAMING_MIN_WORDS` | none | Chunking floor for the above |
| `TTS_STREAMING_MAX_CHARS` | none | Chunking ceiling for the above |

There is **no timeout variable**. The request timeout is whatever the `openai`
client defaults to; it cannot be configured through this proxy.

`STT_EXTRA_BODY` exists and is validated at startup — `response_format` must
stay `json` and `stream` must be a boolean, or the program refuses to run.
`TTS_EXTRA_BODY` is validated the same way, and neither `EXTRA_BODY` is exposed
as an add-on option: they are escape hatches whose failure mode is a start-up
crash, and nothing the add-on needs goes through them.

The add-on sets one model list per direction, never two. `create_asr_programs`
treats the three STT lists as mutually exclusive (realtime beats streaming beats
batch) and a model named in only one of them is enough to build a program, so
the `stt_mode` option routes a single model name into a single variable. The
same holds for `TTS_MODELS` versus `TTS_STREAMING_MODELS`, which is what the
`tts_streaming` switch does.

`STT_BACKEND` and `TTS_BACKEND` are set only for `api.openai.com` and
`api.mistral.ai`. Left unset, `create_autodetected_factory` probes for LocalAI,
Speaches and Kokoro-FastAPI in turn before falling back to `OPENAI` — which is
exactly what a local server needs and exactly what a known cloud host does not.
`_is_openai_domain` already short-circuits the probes for OpenAI itself; naming
the backend covers Mistral, where all three probes would otherwise fire and fail.

## 3. Python version

The package declares `requires-python = ">=3.12"` and is tested on 3.12 and
3.13. Alpine 3.23 — the base the Home Assistant images are built on — ships
`python3` 3.12.14, so the floor is met with nothing extra installed.

## 4. Native builds on aarch64

None needed, and this was checked rather than assumed. Resolving the whole
tree for the target platform with source distributions forbidden:

```
pip download wyoming-openai==0.5.0 --only-binary=:all: \
    --python-version 3.12 --implementation cp \
    --platform musllinux_1_1_aarch64 --platform musllinux_1_2_aarch64 \
    --platform any
```

succeeds and yields 21 wheels. Three carry compiled code:

- `pydantic_core-2.46.4-cp312-cp312-musllinux_1_1_aarch64`
- `jiter-0.16.0-cp312-cp312-musllinux_1_1_aarch64`
- `websockets-15.0.1-cp312-cp312-musllinux_1_2_aarch64`

The other eighteen are `py3-none-any`. So no `gcc`, `musl-dev` or
`python3-dev` in the image — which also means that if a wheel ever goes
missing, the build fails outright instead of silently compiling for twenty
minutes on the device.

## 5. Streaming and realtime

The earlier note here said "batch only, fixed". That was a decision about
Mistral, not about the proxy, and it stopped being the whole story once the
add-on gained a TTS half aimed at OpenAI. What is actually true:

**Realtime STT** (`STT_REALTIME_MODELS`) opens an OpenAI `/v1/realtime`
WebSocket (`client.realtime.connect(extra_query={"intent": "transcription"})`).
`handler.py` resamples and downmixes the Wyoming audio to 24 kHz mono PCM16
itself, so a Wyoming satellite at any rate works. Against OpenAI this is the
fastest path and is the add-on's default. **Against Mistral it cannot work**:
Mistral's realtime transcription is its own protocol, reached through
`mistralai[realtime]` and `client.audio.realtime.transcribe_stream()`, so
`voxtral-mini-transcribe-realtime-26-02` is still out of reach.

**Streaming STT** (`STT_STREAMING_MODELS`) sends `stream=true` to
`/v1/audio/transcriptions` and parses the reply with the OpenAI SDK's stream
parser. Mistral does have SSE streaming on that endpoint, but with its own event
schema, and the two have not been checked against each other. Offered as
`stt_mode: streaming`, documented as OpenAI-only-verified.

**Streaming TTS** (`TTS_STREAMING_MODELS`) is the one that matters most in
Assist and is on by default. A model in that list is announced in
`TtsProgram(supports_synthesize_streaming=True)`; Home Assistant 2025.7 and
newer then drives `SynthesizeStart` / `SynthesizeChunk` / `SynthesizeStop`
instead of a single `Synthesize`, and the handler cuts the incoming text into
sentences with pySBD and synthesises up to three at a time. Playback starts on
the first sentence. Older Home Assistant ignores the flag and sends a plain
`Synthesize`, which `handler.py` still implements — so the switch degrades
rather than breaking, and no `homeassistant:` floor is declared in
`config.yaml`.

## 6. Discovery

`config.yaml` declares `discovery: [wyoming]`. That declaration is what lets the
Supervisor accept a `POST /discovery` from this add-on; no `hassio_api: true` is
needed, and the official Piper add-on does not set one either.

The message itself is two commands, lifted from
`piper/rootfs/etc/s6-overlay/s6-rc.d/discovery/run`: wait until the port
accepts a connection, then
`bashio::discovery "wyoming" "$(bashio::var.json uri "tcp://$(hostname):10300")"`.
Piper runs that as an s6-rc oneshot; here it is a background function in
`run.sh`, because this add-on has no `rootfs/` tree and adding a whole s6
service directory to issue two commands is not worth it. The wait matters: the
config flow the discovery opens connects immediately, and a closed port makes it
give up.

A failed discovery logs a warning and nothing else. It must never take the
server down — the add-on is perfectly usable with the integration added by hand.

## 7. Model names

Upstream's `docker-compose.voxtral.yml` and Mistral's current transcription
guide both use `voxtral-mini-latest`, which resolves to Voxtral Mini
Transcribe 2, API id `voxtral-mini-transcribe-26-02`.

Worth knowing: the dated ids `voxtral-mini-25-07` and
`voxtral-mini-transcribe-25-07` were deprecated on 2026-02-27 and retired on
2026-05-31. The alias survived the move, the dated names did not. If
transcription starts failing with a 404 on the model, this is the first place
to look.

`language` and `timestamp_granularities` cannot be sent together. The proxy
sends `language` and no granularities, so the combination never arises.

## Sources

- https://github.com/roryeckel/wyoming_openai (`pyproject.toml`,
  `src/wyoming_openai/__main__.py`, `src/wyoming_openai/handler.py`,
  `Dockerfile`, `docker-compose.voxtral.yml`, `README.md`)
- https://pypi.org/pypi/wyoming-openai/json
- https://github.com/home-assistant/addons (`piper/config.yaml`,
  `piper/rootfs/etc/s6-overlay/s6-rc.d/discovery/run`, `piper/Dockerfile`)
- https://github.com/hassio-addons/bashio (`lib/discovery.sh`, `lib/config.sh`)
- https://github.com/rhasspy/wyoming (`wyoming/info.py`, `wyoming/tts.py`)
- https://docs.mistral.ai/studio-api/audio/speech_to_text/offline_transcription
- https://docs.mistral.ai/getting-started/models/models_overview/
