FROM python:3.14.9-alpine3.24@sha256:dbeb11d16bb95c3a7e3c25c842cb9f20cbc8c18f8be0461a4a0dcc861ad386a0

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
