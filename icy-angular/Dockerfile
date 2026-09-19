FROM node:26.8.1-alpine3.24@sha256:2d984a15c9b54fd0aeb608b8e0d0d83529eb34d2966db27a1fb4f1edc3d298a3 AS build
ARG ICEFORGE_BUILD_COMMIT=unknown
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN ICEFORGE_BUILD_COMMIT="${ICEFORGE_BUILD_COMMIT}" npm run build

FROM nginx:1.30.4-alpine3.24@sha256:97d490c12ba55b4946b01546d1c3ed324e8d41ab1c9fcb2a616aa470620e5b46
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
