FROM node:24.19.0-alpine3.24@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS build
ARG ICEFORGE_BUILD_COMMIT=unknown
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN ICEFORGE_BUILD_COMMIT="${ICEFORGE_BUILD_COMMIT}" npm run build

FROM nginx:1.31.5-alpine3.24@sha256:72ba65eb42c10344912a84ff42408db7d34f2feb642204570ab8fc5ffd29f1d3
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
