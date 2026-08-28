ARG BUILD_FROM
FROM ${BUILD_FROM}

# Alpine 3.23 ships Python 3.12, which is the floor wyoming-openai asks for.
# The version is pinned: a floating "latest" would make two builds of the same
# add-on release produce different images.
#
# Nothing here installs a compiler, and that is deliberate. Every dependency
# that has native code (pydantic-core, jiter, websockets) publishes musllinux
# aarch64 wheels, so a correct build downloads wheels and nothing else. If that
# ever stops being true, pip cannot quietly fall back to building from source —
# the build fails, loudly, on the machine instead of on the Pi.
# hadolint ignore=DL3018
RUN apk add --no-cache python3 py3-pip \
    && pip install --no-cache-dir --break-system-packages wyoming-openai==0.5.0

COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
