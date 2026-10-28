# -------------------------------------------------------------
# Stage 1: Build Spring Boot Application with Maven & JDK 21
# -------------------------------------------------------------
FROM maven:3.9.9-eclipse-temurin-21-alpine AS build
WORKDIR /workspace

# Cache Maven dependencies by copying pom.xml first
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy application source code and compile jar
COPY src ./src
RUN mvn clean package -DskipTests

# -------------------------------------------------------------
# Stage 2: Production JRE 21 Runtime (Lightweight & Secure)
# -------------------------------------------------------------
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy jar from build stage
COPY --from=build /workspace/target/*.jar app.jar

# Optional container port; EC2 systemd deployment uses deploy/aws/nbh-erp.service.
ENV PORT=8080
EXPOSE 8080

# Size the JVM heap relative to the container memory limit.
ENTRYPOINT ["sh", "-c", "java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Dserver.port=${PORT} -jar app.jar"]
