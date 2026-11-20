FROM maven:3.9.16-eclipse-temurin-25-alpine@sha256:781f1da87cd3d142e66e47cc149c4582a652fb7f574648206d1e956170c0dc90 AS build
WORKDIR /build
COPY pom.xml .
# Maven Central limite parfois les téléchargements (429) ou répond « absent » par erreur :
# le résolveur réessaie les 429/503, et la commande complète est relancée avec -U
# pour ignorer un échec mis en cache par la tentative précédente.
ENV MAVEN_OPTS="-Daether.connector.http.retryHandler.count=5 -Daether.connector.http.retryHandler.interval=5000 -Daether.connector.http.retryHandler.serviceUnavailable=429,503"
RUN for attempt in 1 2 3 4; do \
      mvn -B -ntp -U dependency:go-offline && exit 0; \
      echo "Résolution Maven en échec (tentative $attempt), nouvel essai dans $((attempt * 20)) s" >&2; \
      sleep $((attempt * 20)); \
    done; \
    exit 1
COPY src ./src
RUN mvn -B -ntp verify

FROM eclipse-temurin:25.0.4_7-jre-alpine-3.24@sha256:2ca9adf44f5c29d28ecd26cf92d75cc0c66b7f32bfd839a4439e363a8b428af8
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
