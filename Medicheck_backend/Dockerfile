FROM eclipse-temurin:17-jdk-alpine

WORKDIR /app

COPY . .

# 🔥 ADD THIS LINE (IMPORTANT)
RUN chmod +x mvnw

RUN ./mvnw clean package -DskipTests

EXPOSE 10000

CMD ["java", "-jar", "target/*.jar"]