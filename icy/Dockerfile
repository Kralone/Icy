FROM python:3.15.0-alpine3.24@sha256:2699b90f4d562a22e2dd076c82f964032f64814204bff36d271a54ba4cc2c7e2

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
