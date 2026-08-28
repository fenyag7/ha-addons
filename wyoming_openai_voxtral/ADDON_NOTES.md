# Notes on the upstream package

Answers to the questions that had to be settled before the add-on could be
written. Checked against `roryeckel/wyoming_openai` at version 0.5.0 (the
latest on PyPI, released 2026-05-25) and Mistral's documentation, both as of
2026-08-28. Anything here can go stale; the sources are named so it can be
rechecked rather than re-guessed.

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

There is **no timeout variable**. The request timeout is whatever the `openai`
client defaults to; it cannot be configured through this proxy.

`STT_EXTRA_BODY` exists and is validated at startup — `response_format` must
stay `json` and `stream` must be a boolean, or the program refuses to run.

The `TTS_*` half of the list is deliberately left unset. Voxtral does not
synthesise speech, and Piper handles that locally.

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

**Batch only. Fixed, do not spend time on it.**

The proxy has two faster paths and neither reaches Mistral:

- `STT_REALTIME_MODELS` opens an OpenAI `/v1/realtime` WebSocket
  (`client.realtime.connect(extra_query={"intent": "transcription"})`).
  Mistral's realtime transcription is its own protocol, reached through
  `mistralai[realtime]` and `client.audio.realtime.transcribe_stream()`. The
  two are not the same wire format, so `voxtral-mini-transcribe-realtime-26-02`
  cannot be driven from here.
- `STT_STREAMING_MODELS` sends `stream=true` to `/v1/audio/transcriptions`.
  Whether Mistral accepts that on the batch endpoint has not been verified, and
  it would only stream partial transcripts of an utterance that is already over
  — no latency worth the risk. Left unset.

A command of a few seconds is one request and one response. That is the whole
interaction.

## 6. Model names

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
- https://docs.mistral.ai/studio-api/audio/speech_to_text/offline_transcription
- https://docs.mistral.ai/getting-started/models/models_overview/
