FROM node:24.22.3-alpine3.24@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build
ARG ICEFORGE_BUILD_COMMIT=unknown
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN ICEFORGE_BUILD_COMMIT="${ICEFORGE_BUILD_COMMIT}" npm run build

FROM nginx:1.31.9-alpine3.24@sha256:fb4658584bd9a916ffb6f6e365f97c25cfdb2923801f551ea08356e695f14ff7
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
