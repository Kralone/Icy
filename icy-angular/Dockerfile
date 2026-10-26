FROM node:24.19.0-alpine3.24@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS build
ARG ICEFORGE_BUILD_COMMIT=unknown
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN ICEFORGE_BUILD_COMMIT="${ICEFORGE_BUILD_COMMIT}" npm run build

FROM nginx:1.31-alpine3.24@sha256:a3554c0d0b48177b1413c26e01f695334428020d9df01243fbae3e11cfd17417
# Les paquets système de l'image de base sont mis à niveau : son empreinte est fixée, pas leurs correctifs de sécurité.
RUN apk upgrade --no-cache
ARG ICEFORGE_BUILD_COMMIT=unknown
LABEL org.opencontainers.image.revision="${ICEFORGE_BUILD_COMMIT}"

COPY --from=build /app/dist/icy-angular/browser/ /usr/share/nginx/html/
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

RUN chown -R nginx:nginx /usr/share/nginx/html && \
    find /usr/share/nginx/html -type d -exec chmod 755 {} \; && \
    find /usr/share/nginx/html -type f -exec chmod 644 {} \;

USER nginx

EXPOSE 8080 8443
