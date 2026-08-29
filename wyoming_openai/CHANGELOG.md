# Changelog

## 0.2.0

**The slug changed from `wyoming_openai_voxtral` to `wyoming_openai`.** Home
Assistant sees that as a different add-on: remove the old one, install this one,
and enter the options again. The defaults changed too — both halves now point at
OpenAI, and Mistral is one endpoint among several rather than the assumption.

- Text-to-speech. The add-on now serves Assist a voice as well as an ear, over
  the same Wyoming connection and the same port. Mistral has no speech synthesis
  API, so the two halves are configured separately and can point at different
  providers.
- Streaming speech, on by default. The reply is synthesised sentence by sentence
  as Assist generates it, so playback starts on the first sentence instead of
  after the last. Needs Home Assistant 2025.7 or newer; older versions fall back
  to waiting for the whole reply.
- Realtime speech-to-text over a WebSocket, the new default for OpenAI. The
  `stt_mode` option picks between `batch`, `streaming` and `realtime`; pointing
  the add-on at Mistral means `batch`, which is what it always did.
- Home Assistant discovers the add-on by itself. The previous release promised
  this in its documentation and did not implement it — there was no `discovery`
  declaration and nothing ever told the Supervisor. Both are there now, and a
  failed discovery is a warning rather than a failed start.
- Local speech servers work. The backend is no longer hardcoded to `OPENAI`, so
  Kokoro-FastAPI, Speaches and LocalAI are recognised when `tts_url` points at
  them, and no API key is sent.
- Either half can be switched off by clearing its model. Clearing both is a
  start-up error rather than a server with nothing to say.
- A health check, so Supervisor can tell a running container from a working one.

## 0.1.0

- First release. Wraps `wyoming-openai` 0.5.0 and points it at Mistral's
  Voxtral transcription API, so Assist gets a speech-to-text engine that
  handles Russian without a GPU in the house.
- Refuses to start without an API key rather than failing on the first
  spoken command, where the error would surface in the Assist debug view
  instead of the add-on log.
