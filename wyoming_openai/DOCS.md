# Wyoming OpenAI

The add-on runs `wyoming-openai` and listens on port 10300. Home Assistant's
Wyoming Protocol integration connects to it and gets back a speech-to-text
engine, a text-to-speech engine, or both. Transcription goes out as an
OpenAI-style `POST /v1/audio/transcriptions`; synthesis as `POST
/v1/audio/speech`.

Port 10300 is published on the host so clients outside Home Assistant can reach
it too. Home Assistant itself does not need it — it is told about the service
through the Supervisor. There is no web interface and no ingress.

## Options

| Option | Default | Meaning |
|---|---|---|
| `api_key` | empty | Used for both directions unless `tts_api_key` is set. |
| `languages` | `ru en` | Languages offered to Assist. **Space-separated.** |
| `stt_url` | `https://api.openai.com/v1` | OpenAI-compatible transcription endpoint. |
| `stt_model` | `gpt-4o-mini-transcribe` | Empty turns speech-to-text off. |
| `stt_mode` | `realtime` | `batch`, `streaming` or `realtime`. See below. |
| `tts_url` | `https://api.openai.com/v1` | OpenAI-compatible speech endpoint. |
| `tts_api_key` | empty | Only for a split setup. Empty means `api_key`. |
| `tts_model` | `gpt-4o-mini-tts` | Empty turns text-to-speech off. |
| `tts_voices` | empty | Empty means every voice the endpoint offers. |
| `tts_streaming` | `true` | Synthesise sentence by sentence. |
| `tts_speed` | `1.0` | Between 0.25 and 4.0. |
| `tts_instructions` | empty | `gpt-4o-mini-tts` only. |
| `log_level` | `info` | `debug`, `info`, `warning`, `error`. |

Clearing both `stt_model` and `tts_model` leaves nothing to serve, and the
add-on stops with a message saying so.

### languages is space-separated

`wyoming-openai` splits this value on whitespace. `ru en` is two languages;
`ru,en` is one language whose name is the five characters `ru,en`, which no
Assist pipeline will ever ask for. The add-on starts either way — the failure
shows up later, as a pipeline that cannot select this engine.

The list only controls what Assist is willing to offer. The model detects the
language itself, and the pipeline's language is passed along as a hint.

### stt_mode

| Mode | What it does | Works with |
|---|---|---|
| `batch` | Uploads the finished recording, waits for the whole transcript. | Everything, Mistral included. |
| `streaming` | Same endpoint with `stream=true`, transcript arrives in pieces. | OpenAI. Unverified against Mistral. |
| `realtime` | Opens a `/v1/realtime` WebSocket and transcribes as you speak. | OpenAI only. |

`realtime` is the default because it is the one that shortens the pause between
the end of a sentence and Assist reacting. It is also the most moving parts: if
transcription starts failing in a way the log blames on the WebSocket, set
`batch` and see whether the problem goes away.

**Pointing this at Mistral means `batch`.** Mistral's own realtime
transcription (`voxtral-mini-transcribe-realtime-26-02`) speaks Mistral's
WebSocket protocol, not OpenAI's, and cannot be driven from here. Its
`stream=true` support on the batch endpoint uses its own event schema, which
this proxy's parser has not been checked against.

### tts_streaming

With this on, the add-on tells Home Assistant it supports streaming synthesis.
Assist then sends the reply as it is generated, the add-on cuts it into
sentences and synthesises them as they complete, and playback starts on the
first one. On a long answer this is the difference between speaking after a
second and speaking after five.

It needs Home Assistant **2025.7 or newer**. On anything older Home Assistant
ignores the offer and asks for the whole reply at once, which still works.

### tts_voices

Left empty, the add-on asks the endpoint what it has. For OpenAI that is
`alloy ash coral echo fable onyx nova sage shimmer`; for Kokoro-FastAPI,
Speaches and LocalAI it is whatever they have loaded. All of them are then
offered to Home Assistant, and the actual voice is chosen per assistant under
Settings → Voice assistants. Fill this in only to cut the list down.

## Recipes

**OpenAI for both** — the defaults. One key, nothing else to change.

**Voxtral for listening, OpenAI for speaking.** Mistral has no speech synthesis
at all, so the two halves have to be split:

- `api_key` — the Mistral key
- `stt_url` — `https://api.mistral.ai/v1`
- `stt_model` — `voxtral-mini-latest`
- `stt_mode` — `batch`
- `tts_api_key` — the OpenAI key
- everything else left as it is

**A local speech server.** Kokoro-FastAPI, Speaches, LocalAI and
openai-edge-tts all serve `/v1/audio/speech`. Point `tts_url` at it (for example
`http://192.168.1.50:8880/v1`), set `tts_model` to whatever it serves, and leave
`tts_api_key` empty — the add-on recognises these backends by probing them and
sends no key. Nothing then leaves the house for synthesis.

## Setting up the pipeline

1. Settings → Devices & services — a **Wyoming Protocol** discovery card appears
   by itself once the add-on has started. Accept it. If it does not appear, add
   the integration by hand with `localhost` / `10300`.
2. Settings → Voice assistants → create an assistant and pick this engine for
   speech-to-text, text-to-speech, or both.
3. Pick the voice on the same page.

## What it costs

Roughly, at OpenAI's list prices: `gpt-4o-mini-transcribe` is about $0.003 per
minute of audio, `gpt-4o-mini-tts` about $0.015 per minute of speech. A
household's worth of short commands is cents a month. `realtime` is billed
differently from `batch` — check the current pricing page before leaving it on
if that matters.

## When something is wrong

**The add-on stops with a line about the API key.** The key is empty while a
paid endpoint is configured. It is stored as a password, so it is masked in the
interface and in the log.

**The add-on stops saying there is nothing to serve.** Both `stt_model` and
`tts_model` are empty.

**No discovery card appears.** The log says either that Home Assistant was told
about the service, or that it could not be. If it could not, add the Wyoming
Protocol integration by hand — the add-on works the same either way.

**Assist will not let the pipeline use this engine.** The pipeline's language is
not in `languages`. Check the separator first.

**Every request fails with 401.** The key is wrong, or the account has no access
to the model. `curl -H "Authorization: Bearer KEY" https://api.openai.com/v1/models`
lists what the account can actually use.

**Every request fails with 400 mentioning instructions.** `tts_instructions` is
set and the model is not `gpt-4o-mini-tts`. Clear one or the other.

**Every request fails with 404 on the model.** The model name has moved. Mistral
retired `voxtral-mini-2507` on 2026-05-31; its current transcription model is
`voxtral-mini-transcribe-26-02`, aliased as `voxtral-mini-latest`.

**Speech is slow to start.** Check `tts_streaming` is on and Home Assistant is
2025.7 or newer. The add-on log lists the TTS model as `(streaming)` at startup
when the offer is being made.

**Anything is slow.** Settings → Voice assistants → the pipeline → ⋮ → Debug
shows the time each stage took. Anything over a second is the network or the
API, not this add-on.

Set `log_level` to `debug` to see the requests as they are made.
