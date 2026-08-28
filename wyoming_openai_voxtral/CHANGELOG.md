# Changelog

## 0.1.0

- First release. Wraps `wyoming-openai` 0.5.0 and points it at Mistral's
  Voxtral transcription API, so Assist gets a speech-to-text engine that
  handles Russian without a GPU in the house.
- Refuses to start without an API key rather than failing on the first
  spoken command, where the error would surface in the Assist debug view
  instead of the add-on log.
