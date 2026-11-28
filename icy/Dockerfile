FROM python:3.14.10-alpine3.24@sha256:5862d971d1f0ae26b258cefa4e893556b1d3aba81bd2ff30888704ad378bab67

# OS_PACKAGES_REFRESH change chaque jour en CI : le cache Docker ne fige pas les correctifs de apk upgrade.
ARG OS_PACKAGES_REFRESH=
RUN apk upgrade --no-cache

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
