package com.example.medicheck_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class MedicheckBackendApplication {

    public static void main(String[] args) {
        // Render provides DATABASE_URL as postgres:// but Spring Boot needs jdbc:postgresql://
        String dbUrl = System.getenv("DATABASE_URL");
        if (dbUrl != null && dbUrl.startsWith("postgres://")) {
            dbUrl = dbUrl.replace("postgres://", "jdbc:postgresql://");
            System.setProperty("DATABASE_URL", dbUrl);
        } else if (dbUrl != null && dbUrl.startsWith("postgresql://")) {
            dbUrl = dbUrl.replace("postgresql://", "jdbc:postgresql://");
            System.setProperty("DATABASE_URL", dbUrl);
        }

        SpringApplication.run(MedicheckBackendApplication.class, args);
    }
}