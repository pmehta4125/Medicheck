package com.example.medicheck_backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.nio.file.Files;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

@Service
public class HuggingFaceVisionService {

    private static final Logger logger = LoggerFactory.getLogger(HuggingFaceVisionService.class);

    @Value("${huggingface.api-token:}")
    private String apiToken;

    @Value("${huggingface.model:Qwen/Qwen2.5-VL-7B-Instruct}")
    private String model;

    @Value("${huggingface.endpoint:https://router.huggingface.co/hf-inference/models}")
    private String endpoint;

    @Value("${huggingface.http.connect-timeout-ms:12000}")
    private int connectTimeoutMs;

    @Value("${huggingface.http.read-timeout-ms:60000}")
    private int readTimeoutMs;

    @Value("${huggingface.auth-failure-cooldown-ms:120000}")
    private long authFailureCooldownMs;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private RestTemplate restTemplate;

    private volatile long authFailedUntilEpochMs = 0L;
    private volatile long quotaExceededAtEpochMs = 0L;

    private static final String PROMPT = """
            You are an expert medical prescription reader and pharmacist.
            Extract information from this prescription image and return ONLY in this format:

            DOCTOR: [Doctor name if visible, otherwise Not clearly visible]
            PATIENT: [Patient name if visible, otherwise Not clearly visible]
            DATE: [Date if visible, otherwise Not clearly visible]

            MEDICINES:
            1. [Medicine name] | [Dosage] | [Frequency] | [Duration] | [Instructions]
            2. [Medicine name] | [Dosage] | [Frequency] | [Duration] | [Instructions]

            DIAGNOSIS: [If visible, else Not specified]
            ADDITIONAL NOTES: [Any additional instructions]

            Rules:
            - Always output at least one medicine if any medicine-like text exists.
            - Use your best medical guess for unclear handwriting.
            - Keep medicine lines pipe-separated.
            """;

    @PostConstruct
    void initRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);
        this.restTemplate = new RestTemplate(factory);

        logger.info(
                "Hugging Face client configured with connectTimeout={}ms, readTimeout={}ms, authCooldown={}ms",
                connectTimeoutMs,
                readTimeoutMs,
                authFailureCooldownMs
        );
    }

    public Optional<String> analyzePrescription(File imageFile) {
        if (apiToken == null || apiToken.isBlank()) {
            logger.info("Hugging Face token not configured, skipping HF fallback");
            return Optional.empty();
        }

        if (isAuthCooldownActive()) {
            logger.warn("Hugging Face temporarily disabled due to recent auth failure");
            return Optional.empty();
        }

        try {
            byte[] imageBytes = Files.readAllBytes(imageFile.toPath());
            String mimeType = detectMimeType(imageFile.getName());
            String imageDataUrl = "data:" + mimeType + ";base64," + java.util.Base64.getEncoder().encodeToString(imageBytes);

            String requestBody = objectMapper.writeValueAsString(buildPayload(imageDataUrl));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiToken);

            HttpEntity<String> request = new HttpEntity<>(requestBody, headers);

            String url = endpoint + "/" + model + "/v1/chat/completions";
            logger.info("Trying Hugging Face vision fallback with model {}", model);

            ResponseEntity<JsonNode> response = restTemplate.postForEntity(url, request, JsonNode.class);
            JsonNode body = response.getBody();
            if (body == null) {
                return Optional.empty();
            }

            String text = extractText(body).trim();
            if (text.isBlank() || text.length() < 20) {
                logger.warn("Hugging Face returned insufficient text");
                return Optional.empty();
            }

            logger.info("Hugging Face fallback succeeded with {} chars", text.length());
            return Optional.of(text);
        } catch (HttpClientErrorException e) {
            int status = e.getStatusCode().value();
            if (status == 401 || status == 403) {
                markAuthFailure(status);
            }
            if (status == 429) {
                markQuotaExceeded();
            }
            logger.warn("Hugging Face HTTP error {}: {}", status, e.getStatusText());
            return Optional.empty();
        } catch (Exception ex) {
            logger.warn("Hugging Face fallback failed: {} - {}", ex.getClass().getSimpleName(), ex.getMessage());
            return Optional.empty();
        }
    }

    public boolean wasQuotaExceededRecently() {
        long threshold = System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(10);
        return quotaExceededAtEpochMs >= threshold;
    }

    private boolean isAuthCooldownActive() {
        return System.currentTimeMillis() < authFailedUntilEpochMs;
    }

    private void markAuthFailure(int statusCode) {
        authFailedUntilEpochMs = System.currentTimeMillis() + authFailureCooldownMs;
        logger.error("Hugging Face auth failed with HTTP {}. Disabling for {} ms.", statusCode, authFailureCooldownMs);
    }

    private void markQuotaExceeded() {
        quotaExceededAtEpochMs = System.currentTimeMillis();
    }

    private Map<String, Object> buildPayload(String imageDataUrl) {
        Map<String, Object> textContent = new LinkedHashMap<>();
        textContent.put("type", "text");
        textContent.put("text", PROMPT);

        Map<String, Object> imageUrlObj = new LinkedHashMap<>();
        imageUrlObj.put("url", imageDataUrl);

        Map<String, Object> imageContent = new LinkedHashMap<>();
        imageContent.put("type", "image_url");
        imageContent.put("image_url", imageUrlObj);

        Map<String, Object> message = new LinkedHashMap<>();
        message.put("role", "user");
        message.put("content", List.of(textContent, imageContent));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("messages", List.of(message));
        payload.put("temperature", 0.1);
        payload.put("max_tokens", 1400);
        return payload;
    }

    private String extractText(JsonNode body) {
        JsonNode contentNode = body.at("/choices/0/message/content");

        if (contentNode.isTextual()) {
            return contentNode.asText("");
        }

        if (contentNode.isArray()) {
            StringBuilder combined = new StringBuilder();
            for (JsonNode part : contentNode) {
                String piece = part.path("text").asText("");
                if (!piece.isBlank()) {
                    if (combined.length() > 0) {
                        combined.append("\n");
                    }
                    combined.append(piece.trim());
                }
            }
            return combined.toString();
        }

        return "";
    }

    private String detectMimeType(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".bmp")) return "image/bmp";
        return "image/jpeg";
    }
}
