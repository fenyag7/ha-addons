# Wyoming OpenAI

Speech-to-text **and** text-to-speech for Home Assistant Assist, handed off to
any OpenAI-compatible API. The add-on is a thin wrapper around
[wyoming-openai](https://github.com/roryeckel/wyoming_openai): it speaks the
Wyoming protocol to Home Assistant on port 10300 and HTTPS to whichever
endpoints you point it at.

Out of the box both halves point at OpenAI. Either half can be pointed
somewhere else — Mistral Voxtral for listening, a Kokoro-FastAPI box on the LAN
for speaking — or switched off entirely by clearing its model.

Speech is streamed sentence by sentence, so Assist starts talking before the
reply has been written to the end.

## Installation

Add the repository `https://github.com/fenyag7/ha-addons` to the Home Assistant
add-on store, then install **Wyoming OpenAI**. Supervisor builds the image
locally, so the first install takes a few minutes.

Put an API key in the options before starting it. Home Assistant then discovers
the Wyoming service by itself and offers it under Settings → Devices &
services; if the discovery card never appears, add the Wyoming Protocol
integration by hand with host `localhost` and port `10300`.

See [DOCS.md](DOCS.md) for the options, the recipes for other providers, and
the things that go wrong.

## License

MIT. Installs [wyoming-openai](https://github.com/roryeckel/wyoming_openai),
Apache-2.0.
