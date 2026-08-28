# Wyoming OpenAI (Voxtral)

Speech-to-text for Home Assistant Assist, handed off to Mistral's Voxtral over
its OpenAI-compatible API. The add-on is a thin wrapper around
[wyoming-openai](https://github.com/roryeckel/wyoming_openai): it speaks the
Wyoming protocol to Home Assistant on port 10300 and HTTPS to Mistral.

Only the recorded audio leaves the house. The transcript comes back to Home
Assistant, and intent matching and speech synthesis stay local.

## Installation

Add the repository `https://github.com/fenyag7/ha-addons` to the Home Assistant
add-on store, then install **Wyoming OpenAI (Voxtral)**. Supervisor builds the
image locally, so the first install takes a few minutes.

Put a Mistral API key in the options before starting it. Home Assistant should
then discover the Wyoming service on its own; if it does not, add the Wyoming
Protocol integration by hand with host `localhost` and port `10300`.

See [DOCS.md](DOCS.md) for the options and the things that go wrong.

## License

MIT. Installs [wyoming-openai](https://github.com/roryeckel/wyoming_openai),
Apache-2.0.
