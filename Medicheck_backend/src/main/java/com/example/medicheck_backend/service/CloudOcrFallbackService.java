package com.example.medicheck_backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.nio.file.Files;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class CloudOcrFallbackService {

    private static final Logger logger = LoggerFactory.getLogger(CloudOcrFallbackService.class);

    @Value("${ocr.cloud.google.api-key:}")
    private String googleVisionApiKey;

    private final RestTemplate restTemplate = new RestTemplate();

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
                                    "features", List.of(Map.of("type", "DOCUMENT_TEXT_DETECTION"))
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
                return Optional.of(fullText);
            }

            String fallback = body.at("/responses/0/textAnnotations/0/description").asText("").trim();
            if (!fallback.isBlank()) {
                return Optional.of(fallback);
            }

            return Optional.empty();
        } catch (Exception ex) {
            logger.warn("Google Vision fallback failed: {}", ex.getMessage());
            return Optional.empty();
        }
    }
}
