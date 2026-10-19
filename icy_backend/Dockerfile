FROM maven:3.9.16-eclipse-temurin-25-alpine@sha256:781f1da87cd3d142e66e47cc149c4582a652fb7f574648206d1e956170c0dc90 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B -ntp dependency:go-offline
COPY src ./src
RUN mvn -B -ntp verify

FROM eclipse-temurin:27-jre-alpine-3.24@sha256:9d76de111573e77ac415d8344271a2e57dd19bd59c48725fa3bac38c101bd0ba
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
