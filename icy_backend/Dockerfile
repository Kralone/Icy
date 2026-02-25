FROM eclipse-temurin:21-jdk-alpine
WORKDIR /app
COPY app.jar app.jar
VOLUME /app/logs
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
