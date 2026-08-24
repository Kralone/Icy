FROM python:3.11.16-slim-bookworm@sha256:2e32f7d302adc1c37428355c1e646897c0c53f4fd60b6a551245fb90ee129f91

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirement.txt .
RUN pip install --no-cache-dir -r requirement.txt

RUN groupadd --gid 10001 iceforge \
    && useradd --uid 10001 --gid iceforge --create-home --shell /usr/sbin/nologin iceforge \
    && mkdir -p /app/config \
    && chown -R iceforge:iceforge /app

COPY --chown=iceforge:iceforge . .

USER iceforge
CMD ["python", "bot.py"]
