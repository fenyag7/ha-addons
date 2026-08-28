# Wyoming OpenAI (Voxtral)

The add-on runs `wyoming-openai` and listens on port 10300. Home Assistant's
Wyoming Protocol integration connects to it and gets a speech-to-text engine
back; every transcription request is forwarded to the configured endpoint as an
OpenAI-style `POST /v1/audio/transcriptions`.

Port 10300 is published on the host because that is how the Wyoming integration
reaches it. There is no web interface and no ingress.

## Options

| Option | Default | Meaning |
|---|---|---|
| `api_key` | empty | Mistral API key. The add-on stops with a message if it is empty. |
| `stt_url` | `https://api.mistral.ai/v1` | OpenAI-compatible endpoint. |
| `stt_model` | `voxtral-mini-latest` | Model name sent with each request. |
| `languages` | `ru en` | Languages offered to Assist. **Space-separated.** |
| `log_level` | `info` | `debug`, `info`, `warning`, `error`. |

### languages is space-separated

`wyoming-openai` splits this value on whitespace. `ru en` is two languages;
`ru,en` is one language whose name is the six characters `ru,en`, which no
Assist pipeline will ever ask for. The add-on will start either way — the
failure shows up later, as a pipeline that cannot select this engine.

The list only controls what Assist is willing to offer. Voxtral itself
detects the language, and the code of the pipeline's language is passed along
as a hint.

### stt_model

`voxtral-mini-latest` is an alias that currently resolves to Voxtral Mini
Transcribe 2 (`voxtral-mini-transcribe-26-02`). Pin the dated name instead if
a future alias move is not wanted. Roughly $0.003 per minute of audio.

The realtime model (`voxtral-mini-transcribe-realtime-26-02`) will not work
here. It speaks Mistral's own WebSocket protocol, and this proxy only knows
OpenAI's — see ADDON_NOTES.md.

## Setting up the pipeline

1. Settings → Devices & services → the Wyoming Protocol entry appears by
   itself after the add-on starts. If not, add it with `localhost` / `10300`.
2. Settings → Voice assistants → create an assistant, pick the Voxtral engine
   for speech-to-text.
3. Speech synthesis is a separate matter — the Piper add-on covers it locally.

## When something is wrong

**The add-on stops immediately with a line about the API key.** The key field
is empty. It is stored as a password, so it is masked in the interface and in
the log.

**Assist will not let the pipeline use this engine.** The pipeline's language
is not in `languages`. Check the separator first.

**Every request fails with 401.** The key is wrong, or the account has no
access to the model. `curl -H "Authorization: Bearer KEY" https://api.mistral.ai/v1/models`
lists what the account can actually use.

**Every request fails with 404 on the model.** The model name has moved.
Mistral retired `voxtral-mini-2507` on 2026-05-31; the current transcription
model is `voxtral-mini-transcribe-26-02`.

**Transcription is slow.** Settings → Voice assistants → the pipeline → ⋮ →
Debug shows the time each stage took. Anything over a second in the
speech-to-text stage is the network or the API, not this add-on.

Set `log_level` to `debug` to see the requests as they are made.
