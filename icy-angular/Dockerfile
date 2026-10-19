FROM node:26.12.0-alpine3.24@sha256:6f08a523443ddedf52941874c203475b0ad503e859ad70cb26ab8be9a517dbd5 AS build
ARG ICEFORGE_BUILD_COMMIT=unknown
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN ICEFORGE_BUILD_COMMIT="${ICEFORGE_BUILD_COMMIT}" npm run build

FROM nginx:1.30.4-alpine3.24@sha256:dc5069ad14f19660b141b21236140b91656bf89bbc3e2417c70ae650cd66104c
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
