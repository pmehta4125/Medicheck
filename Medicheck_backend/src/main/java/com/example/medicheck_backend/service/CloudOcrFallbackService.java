package com.example.medicheck_backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.nio.file.Files;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
public class CloudOcrFallbackService {

    private static final Logger logger = LoggerFactory.getLogger(CloudOcrFallbackService.class);

    @Value("${ocr.cloud.google.api-key:}")
    private String googleVisionApiKey;

    @Value("${ocr.cloud.http.connect-timeout-ms:8000}")
    private int connectTimeoutMs;

    @Value("${ocr.cloud.http.read-timeout-ms:25000}")
    private int readTimeoutMs;

    private RestTemplate restTemplate;

    @PostConstruct
    void initRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);
        this.restTemplate = new RestTemplate(factory);

        logger.info(
                "Google Vision fallback client configured with connectTimeout={}ms, readTimeout={}ms",
                connectTimeoutMs,
                readTimeoutMs
        );
    }

    public Optional<String> extractTextIfConfigured(File imageFile) {
        if (googleVisionApiKey == null || googleVisionApiKey.isBlank()) {
            return Optional.empty();
        }

        try {
            byte[] imageBytes = Files.readAllBytes(imageFile.toPath());
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);

            Map<String, Object> payload = Map.of(
                    "requests", List.of(
                            Map.of(
                                    "image", Map.of("content", base64Image),
                            "features", List.of(
                                Map.of("type", "DOCUMENT_TEXT_DETECTION", "model", "builtin/latest"),
                                Map.of("type", "TEXT_DETECTION", "model", "builtin/latest")
                            ),
                            "imageContext", Map.of(
                                "languageHints", List.of("en", "en-t-i0-handwrit")
                            )
                            )
                    )
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
            String endpoint = "https://vision.googleapis.com/v1/images:annotate?key=" + googleVisionApiKey;

            ResponseEntity<JsonNode> response = restTemplate.postForEntity(endpoint, request, JsonNode.class);
            JsonNode body = response.getBody();

            if (body == null) {
                return Optional.empty();
            }

            String fullText = body.at("/responses/0/fullTextAnnotation/text").asText("").trim();
            if (!fullText.isBlank()) {
                return Optional.of(normalizeCloudText(fullText));
            }

            String fallback = body.at("/responses/0/textAnnotations/0/description").asText("").trim();
            if (!fallback.isBlank()) {
                return Optional.of(normalizeCloudText(fallback));
            }

            return Optional.empty();
        } catch (Exception ex) {
            logger.warn("Google Vision fallback failed: {}", ex.getMessage());
            return Optional.empty();
        }
    }

    private String normalizeCloudText(String text) {
        if (text == null || text.isBlank()) {
            return "";
        }

        String normalized = text
                .replace('\u2018', '\'')
                .replace('\u2019', '\'')
                .replace('\u201c', '"')
                .replace('\u201d', '"')
                .replaceAll("[^\\p{Print}\\r\\n\\t]", " ")
                .replaceAll("[\\t\\x0B\\f\\r ]+", " ")
                .replaceAll("\\n{3,}", "\\n\\n")
                .trim();

        StringBuilder cleaned = new StringBuilder();
        for (String line : normalized.split("\\r?\\n")) {
            String value = line.replaceAll("\\s+", " ").trim();
            if (value.isBlank()) {
                continue;
            }

            String lower = value.toLowerCase(Locale.ROOT);
            if (lower.length() >= 4) {
                cleaned.append(value).append("\n");
            }
        }

        return cleaned.toString().trim();
    }
}
