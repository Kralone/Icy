FROM python:3.14.7-alpine3.24@sha256:9e9fde4d32eedce0b661d9ab91e826b62dddf28e928c230ec55f1866cac66b01

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirement.txt requirements.lock ./
RUN pip install --no-cache-dir -r requirements.lock \
    && pip check \
    && python -m pip uninstall --yes pip

RUN addgroup -S -g 10001 iceforge \
    && adduser -S -D -H -u 10001 -G iceforge -s /sbin/nologin iceforge \
    && mkdir -p /app/config \
    && chown -R iceforge:iceforge /app

COPY --chown=iceforge:iceforge . .

USER iceforge
CMD ["python", "bot.py"]
