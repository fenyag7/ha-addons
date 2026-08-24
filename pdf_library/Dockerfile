ARG BUILD_FROM
FROM ${BUILD_FROM}

# Only runtime dependency. py3-aiohttp lives in the Alpine community repo and
# ships prebuilt for aarch64, so nothing is compiled on the target device.
# hadolint ignore=DL3018
RUN apk add --no-cache python3 py3-aiohttp

# Bundled pdf.js viewer. "dist" is the build Mozilla ships for current
# browsers and the one they actually test on; "legacy-dist" is the same
# viewer transpiled and polyfilled for older ones. Legacy was the first
# choice here only because its browser floor is written down, but a current
# iPhone is far above that floor and gains nothing from the polyfills.
# Switch back to legacy-dist if the viewer ever has to run on an old device.
ARG PDFJS_VERSION=6.2.108
ARG PDFJS_FLAVOR=dist

ADD "https://github.com/mozilla/pdf.js/releases/download/v${PDFJS_VERSION}/pdfjs-${PDFJS_VERSION}-${PDFJS_FLAVOR}.zip" /tmp/pdfjs.zip
RUN apk add --no-cache --virtual .pdfjs-deps unzip \
    && mkdir -p /opt/pdfjs \
    && unzip -q /tmp/pdfjs.zip -d /opt/pdfjs \
    && rm -f /tmp/pdfjs.zip \
    && apk del .pdfjs-deps

COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Last layer: application code changes must not invalidate anything above.
COPY app /opt/app

CMD [ "/run.sh" ]
