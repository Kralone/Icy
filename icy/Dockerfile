FROM python:3.14.8-alpine3.24@sha256:f6a589d43c42b9e7f7dc67a12d37132491f362859a5d750607710cc56da3bc72

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
