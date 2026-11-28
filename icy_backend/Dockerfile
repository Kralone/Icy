FROM maven:3.9.16-eclipse-temurin-25-alpine@sha256:781f1da87cd3d142e66e47cc149c4582a652fb7f574648206d1e956170c0dc90 AS build
WORKDIR /build
COPY pom.xml .
# Maven Central refuse parfois les runners CI (429 ou « absent ») : le résolveur
# réessaie les 429/503, puis le script bascule sur le miroir Google de Central.
ENV MAVEN_OPTS="-Daether.connector.http.retryHandler.count=5 -Daether.connector.http.retryHandler.interval=5000 -Daether.connector.http.retryHandler.serviceUnavailable=429,503"
COPY docker/mvn-resilient.sh /usr/local/bin/mvn-resilient
RUN mvn-resilient -B -ntp dependency:go-offline
COPY src ./src
# La CI passe SKIP_TESTS=true : le job backend a déjà lancé mvn verify sur la même révision.
ARG SKIP_TESTS=false
RUN mvn-resilient -B -ntp verify -DskipTests="${SKIP_TESTS}"

FROM eclipse-temurin:25.0.4_7-jre-alpine-3.24@sha256:2ca9adf44f5c29d28ecd26cf92d75cc0c66b7f32bfd839a4439e363a8b428af8
# Les paquets système de l'image de base sont mis à niveau : son empreinte est fixée, pas leurs correctifs de sécurité.
# OS_PACKAGES_REFRESH change chaque jour en CI : le cache Docker ne fige pas les correctifs de apk upgrade.
ARG OS_PACKAGES_REFRESH=
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
