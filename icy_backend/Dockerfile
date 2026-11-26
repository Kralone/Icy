FROM maven:3.9.16-eclipse-temurin-25-alpine@sha256:781f1da87cd3d142e66e47cc149c4582a652fb7f574648206d1e956170c0dc90 AS build
WORKDIR /build
COPY pom.xml .
# Maven Central refuse parfois les runners CI (429 ou « absent ») : le résolveur
# réessaie les 429/503, puis le script bascule sur le miroir Google de Central.
ENV MAVEN_OPTS="-Daether.connector.http.retryHandler.count=5 -Daether.connector.http.retryHandler.interval=5000 -Daether.connector.http.retryHandler.serviceUnavailable=429,503"
COPY docker/mvn-resilient.sh /usr/local/bin/mvn-resilient
RUN mvn-resilient -B -ntp dependency:go-offline
COPY src ./src
RUN mvn-resilient -B -ntp verify

FROM eclipse-temurin:25-jre-alpine-3.21@sha256:bf30e2e0d17471cf174fffeaa86fdb45c46810a11d1fda4f0ff86f5fb3577202
# Les paquets système de l'image de base sont mis à niveau : son empreinte est fixée, pas leurs correctifs de sécurité.
RUN apk upgrade --no-cache
WORKDIR /app
RUN addgroup -S iceforge && adduser -S -u 10001 -G iceforge iceforge \
    && mkdir -p /app/logs /app/uploads/images \
    && chown -R iceforge:iceforge /app
COPY --from=build --chown=iceforge:iceforge /build/target/iceforge-backend-1.0.0.jar app.jar
VOLUME /app/logs
USER iceforge
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
