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
#
# netcat-openbsd is only there for the health check below. Busybox has an nc
# applet too, but not on every build, and a health check that silently cannot
# run would leave the add-on permanently unhealthy.
# hadolint ignore=DL3018
RUN apk add --no-cache python3 py3-pip netcat-openbsd \
    && pip install --no-cache-dir --break-system-packages wyoming-openai==0.5.0

COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Every program the proxy announces is named openai, openai-streaming or
# openai-realtime, so this one grep covers whichever halves are switched on.
HEALTHCHECK --start-period=1m \
    CMD echo '{ "type": "describe" }' \
        | nc -w 1 localhost 10300 \
        | grep -q "openai" \
        || exit 1

CMD [ "/run.sh" ]
