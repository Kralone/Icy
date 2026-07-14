FROM maven:3.9-eclipse-temurin-21-alpine AS build
WORKDIR /build
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /build/target/iceforge-backend-1.0.0.jar app.jar
VOLUME /app/logs
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
