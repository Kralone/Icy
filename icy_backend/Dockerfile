FROM maven:3.9.16-eclipse-temurin-25-alpine@sha256:21e373f51c0b14c9c76d415033f4eb145d1c0b59cd227a3ec5cc1c78002c6da8 AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B -ntp dependency:go-offline
COPY src ./src
RUN mvn -B -ntp verify

FROM eclipse-temurin:26-jre-alpine-3.24@sha256:2c984601c59ac93f97947ce66d03df25c2e16bed97a28289fbc0ab157087f1b5
WORKDIR /app
RUN addgroup -S iceforge && adduser -S -u 10001 -G iceforge iceforge \
    && mkdir -p /app/logs /app/uploads/images \
    && chown -R iceforge:iceforge /app
COPY --from=build --chown=iceforge:iceforge /build/target/iceforge-backend-1.0.0.jar app.jar
VOLUME /app/logs
USER iceforge
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
