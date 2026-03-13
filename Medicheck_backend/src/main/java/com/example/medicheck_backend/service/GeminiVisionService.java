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
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Uses Google Gemini AI Vision to interpret prescription images.
 * Unlike traditional OCR, Gemini can understand handwritten text intelligently.
 */
@Service
public class GeminiVisionService {

    private static final Logger logger = LoggerFactory.getLogger(GeminiVisionService.class);

    @Value("${gemini.api-key:}")
    private String geminiApiKey;

    @Value("${ocr.cloud.google.api-key:}")
    private String googleApiKey;

    @Value("${gemini.http.connect-timeout-ms:8000}")
    private int connectTimeoutMs;

    @Value("${gemini.http.read-timeout-ms:25000}")
    private int readTimeoutMs;

    @Value("${gemini.auth-failure-cooldown-ms:600000}")
    private long authFailureCooldownMs;

    private String getEffectiveApiKey() {
        if (geminiApiKey != null && !geminiApiKey.isBlank()) {
            return geminiApiKey;
        }
        return googleApiKey;
    }

    private RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private volatile long geminiAuthFailedUntilEpochMs = 0L;

    private static final String GEMINI_ENDPOINT_TEMPLATE =
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s";

    private static final String[] MODELS_TO_TRY = {
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.0-flash"
    };

    private static final int MAX_429_RETRIES = 2;
    private static final long[] RETRY_DELAYS_MS = {2000, 5000};

    @PostConstruct
    void initRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeoutMs);
        factory.setReadTimeout(readTimeoutMs);
        this.restTemplate = new RestTemplate(factory);

        logger.info(
                "Gemini client configured with connectTimeout={}ms, readTimeout={}ms, authCooldown={}ms",
                connectTimeoutMs,
                readTimeoutMs,
                authFailureCooldownMs
        );
    }

    private static final String PRESCRIPTION_PROMPT = """
            You are an expert medical prescription reader and pharmacist with 30 years of experience reading doctor handwriting.
            You MUST extract ALL information from this prescription image. NEVER say you cannot read it.

            CRITICAL RULES:
            - You MUST list every medicine written on the prescription. This is mandatory.
            - For handwritten text, use your medical knowledge to infer the most likely medicine name.
            - Doctors write common medicines like Paracetamol, Amoxicillin, Azithromycin, Cetirizine, Pantoprazole, etc.
            - If a word looks like it could be a medicine, list it as a medicine with your best guess spelling.
            - Look for patterns: "Tab", "Cap", "Syp", "Inj", dosage numbers (500mg, 250mg), frequencies (OD, BD, TDS, 1-0-1).
            - Even if the handwriting is very poor, you MUST still attempt to read every line and provide your best interpretation.
            - NEVER respond with "I could not read" or "not clearly readable" for medicines. Always provide your best guess.

            Format your response EXACTLY like this:

            DOCTOR: [Doctor name if visible, otherwise "Not clearly visible"]
            PATIENT: [Patient name if visible, otherwise "Not clearly visible"]
            DATE: [Date if visible, otherwise "Not clearly visible"]

            MEDICINES:
            1. [Medicine name] | [Dosage e.g. 500mg] | [Frequency e.g. twice daily] | [Duration e.g. 5 days] | [Instructions e.g. after food]
            2. [Medicine name] | [Dosage] | [Frequency] | [Duration] | [Instructions]
            (continue for ALL medicines - you MUST list at least the medicines you can see)

            DIAGNOSIS: [If any diagnosis is mentioned, otherwise "Not specified"]
            ADDITIONAL NOTES: [Any other instructions like follow-up date, tests, diet advice]

            Rules:
            - You MUST always output the MEDICINES section with numbered entries. This is non-negotiable.
            - If you cannot read a medicine name with 100% certainty, write your best guess with (unclear) next to it.
            - Use common Indian/generic medicine name spellings.
            - Include ALL medicines you can identify, even partial or blurry names.
            - Separate each medicine detail with | (pipe character).
            - Look at the ENTIRE image carefully, including margins and bottom of the page.
            - Common dosing patterns: 1-0-1 means morning and night, 1-1-1 means thrice daily, 0-0-1 means at night only.
            """;

    private static final String RETRY_PROMPT = """
            Look at this prescription image VERY carefully. I need you to read EVERY medicine written on it.

            This is a doctor's handwritten prescription. Doctors have notoriously bad handwriting, but as a pharmacist, you can read it.

            For EACH line of medicine, tell me:
            - The medicine name (your best guess based on the handwriting shapes)
            - The dosage (look for numbers followed by mg, ml, etc.)
            - How often to take it (look for OD, BD, TDS, or 1-0-1 type patterns)
            - For how long (look for number of days/weeks)

            Format EXACTLY as:
            MEDICINES:
            1. [Name] | [Dosage] | [Frequency] | [Duration] | [Instructions]

            You MUST list at least one medicine. Look at every line of text in the image.
            """;

    public Optional<String> analyzePrescription(File imageFile) {
        String apiKey = getEffectiveApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            logger.warn("No API key configured for Gemini, skipping");
            return Optional.empty();
        }

        if (isAuthCooldownActive()) {
            logger.warn("Gemini temporarily disabled due to recent auth failure");
            return Optional.empty();
        }

        try {
            byte[] imageBytes = Files.readAllBytes(imageFile.toPath());
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            String mimeType = detectMimeType(imageFile.getName());

            // Build correct Gemini API payload
            Map<String, Object> payload = buildPayload(base64Image, mimeType);
            String jsonPayload = objectMapper.writeValueAsString(payload);

            logger.info("Gemini payload size: {} bytes, image mime: {}", jsonPayload.length(), mimeType);
            logger.info("Using Gemini API key: {}...", apiKey.substring(0, Math.min(10, apiKey.length())));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> request = new HttpEntity<>(jsonPayload, headers);

            // Try models with 429 retry logic
            for (String model : MODELS_TO_TRY) {
                for (int attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
                    String url = String.format(GEMINI_ENDPOINT_TEMPLATE, model, apiKey);
                    logger.info("Trying Gemini {} (attempt {})", model, attempt + 1);

                    try {
                        ResponseEntity<JsonNode> response = restTemplate.postForEntity(url, request, JsonNode.class);
                        JsonNode body = response.getBody();

                        if (body == null) {
                            logger.warn("Gemini {} returned null body", model);
                            break; // try next model
                        }

                        logger.info("Gemini {} response status: {}", model, response.getStatusCode());

                        String text = body.at("/candidates/0/content/parts/0/text").asText("").trim();

                        if (!text.isBlank() && text.length() > 20) {
                            logger.info("Gemini {} succeeded, response: {} chars", model, text.length());

                            // Check if response actually contains medicines
                            if (containsMedicines(text)) {
                                return Optional.of(text);
                            }

                            // First attempt didn't find medicines — retry with aggressive prompt
                            logger.info("First Gemini response had no medicines, retrying with aggressive prompt...");
                            Optional<String> retryResult = retryWithAggressivePrompt(base64Image, mimeType, apiKey, model);
                            if (retryResult.isPresent()) {
                                return Optional.of(mergeGeminiResults(text, retryResult.get()));
                            }
                            return Optional.of(text);
                        }

                        logger.warn("Gemini {} returned insufficient text (length={})", model, text.length());
                        break; // try next model

                    } catch (HttpClientErrorException e) {
                        int status = e.getStatusCode().value();
                        if (status == 401 || status == 403) {
                            markAuthFailure(status);
                            return Optional.empty();
                        }
                        if (status == 429 && attempt < MAX_429_RETRIES) {
                            long delay = RETRY_DELAYS_MS[attempt];
                            logger.info("Gemini {} rate limited (429), waiting {}ms before retry...", model, delay);
                            try { Thread.sleep(delay); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                            continue; // retry same model
                        }
                        String responseBody = e.getResponseBodyAsString();
                        String snippet = responseBody == null ? "" : responseBody.substring(0, Math.min(200, responseBody.length()));
                        logger.warn("Gemini {} HTTP error {}: {}", model, e.getStatusCode(), snippet);
                        break; // try next model
                    } catch (Exception e) {
                        logger.warn("Gemini {} failed: {} - {}", model, e.getClass().getSimpleName(), e.getMessage());
                        break; // try next model
                    }
                }
            }

            logger.warn("All Gemini models failed");
            return Optional.empty();

        } catch (Exception ex) {
            logger.error("Gemini Vision analysis failed: {} - {}", ex.getClass().getSimpleName(), ex.getMessage());
            return Optional.empty();
        }
    }

    private Map<String, Object> buildPayload(String base64Image, String mimeType) {
        Map<String, Object> inlineData = new LinkedHashMap<>();
        inlineData.put("mimeType", mimeType);
        inlineData.put("data", base64Image);

        Map<String, Object> imagePart = new LinkedHashMap<>();
        imagePart.put("inlineData", inlineData);

        Map<String, Object> textPart = new LinkedHashMap<>();
        textPart.put("text", PRESCRIPTION_PROMPT);

        Map<String, Object> content = new LinkedHashMap<>();
        content.put("parts", List.of(textPart, imagePart));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("contents", List.of(content));
        return payload;
    }

    private String detectMimeType(String fileName) {
        String lower = fileName.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".bmp")) return "image/bmp";
        return "image/jpeg";
    }

    /**
     * Check if Gemini response actually contains numbered medicine entries in the MEDICINES section.
     */
    private boolean containsMedicines(String text) {
        if (text == null) return false;
        String upper = text.toUpperCase();
        int idx = upper.indexOf("MEDICINES:");
        if (idx < 0) idx = upper.indexOf("MEDICINES\n");
        if (idx < 0) return false;

        String after = text.substring(idx);
        // Look for at least one numbered line like "1. SomeName"
        return after.matches("(?s).*\\d+\\.\\s*[A-Za-z].+\\|.+");
    }

    /**
     * Retry Gemini with an aggressive medicine-focused prompt.
     */
    private Optional<String> retryWithAggressivePrompt(String base64Image, String mimeType, String apiKey, String model) {
        try {
            Map<String, Object> inlineData = new LinkedHashMap<>();
            inlineData.put("mimeType", mimeType);
            inlineData.put("data", base64Image);

            Map<String, Object> imagePart = new LinkedHashMap<>();
            imagePart.put("inlineData", inlineData);

            Map<String, Object> textPart = new LinkedHashMap<>();
            textPart.put("text", RETRY_PROMPT);

            Map<String, Object> content = new LinkedHashMap<>();
            content.put("parts", List.of(textPart, imagePart));

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("contents", List.of(content));

            String jsonPayload = objectMapper.writeValueAsString(payload);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> request = new HttpEntity<>(jsonPayload, headers);

            String url = String.format(GEMINI_ENDPOINT_TEMPLATE, model, apiKey);
            ResponseEntity<JsonNode> response = restTemplate.postForEntity(url, request, JsonNode.class);
            JsonNode body = response.getBody();
            if (body == null) return Optional.empty();

            String text = body.at("/candidates/0/content/parts/0/text").asText("").trim();
            if (!text.isBlank() && text.contains("|")) {
                logger.info("Retry succeeded with {} chars", text.length());
                return Optional.of(text);
            }
        } catch (Exception e) {
            logger.warn("Retry failed: {}", e.getMessage());
        }
        return Optional.empty();
    }

    /**
     * Merge the original response (has doctor/patient/date) with retry response (has medicines).
     */
    private String mergeGeminiResults(String original, String retry) {
        // Extract header info from original (everything before MEDICINES:)
        String upper = original.toUpperCase();
        int medIdx = upper.indexOf("MEDICINES:");
        if (medIdx < 0) medIdx = upper.indexOf("MEDICINES\n");
        String header = medIdx >= 0 ? original.substring(0, medIdx) : original + "\n\n";

        // Extract medicines section from retry
        String retryUpper = retry.toUpperCase();
        int retryMedIdx = retryUpper.indexOf("MEDICINES:");
        if (retryMedIdx < 0) retryMedIdx = retryUpper.indexOf("MEDICINES\n");
        String medicinesSection = retryMedIdx >= 0 ? retry.substring(retryMedIdx) : "MEDICINES:\n" + retry;

        return header + medicinesSection;
    }

    /**
     * Text-only Gemini call: send OCR text for intelligent interpretation.
     * Works when vision API fails but OCR text is available.
     */
    public Optional<String> interpretOcrText(String ocrText) {
        String apiKey = getEffectiveApiKey();
        if (apiKey == null || apiKey.isBlank() || ocrText == null || ocrText.length() < 10) {
            return Optional.empty();
        }

        if (isAuthCooldownActive()) {
            logger.warn("Skipping Gemini text interpretation during auth cooldown");
            return Optional.empty();
        }

        String textPrompt = """
                You are an expert pharmacist. Below is raw OCR text extracted from a doctor's handwritten prescription.
                The OCR may have errors, misspellings, and garbled characters. Use your medical knowledge to interpret it.

                OCR TEXT:
                %s

                Based on this OCR text, extract the prescription information.
                Format your response EXACTLY like this:

                DOCTOR: [Doctor name if found in the text]
                PATIENT: [Patient name if found]
                DATE: [Date if found]

                MEDICINES:
                1. [Medicine name - your best guess] | [Dosage] | [Frequency] | [Duration] | [Instructions]
                (list ALL medicines you can identify from the garbled text)

                DIAGNOSIS: [If mentioned]
                ADDITIONAL NOTES: [Any other info]

                IMPORTANT:
                - Look for common Indian medicine names even if misspelled (e.g., "Parces" could be "Paracetamol")
                - Look for patterns like "Tab", "Cap", "Syp", dosages like "500mg", frequencies like "1-0-1", "BD", "TDS"
                - You MUST list at least the medicines you think are mentioned
                - Hospital names, doctor names may appear at the top
                """.formatted(ocrText);

        try {
            Map<String, Object> textPart = new LinkedHashMap<>();
            textPart.put("text", textPrompt);

            Map<String, Object> content = new LinkedHashMap<>();
            content.put("parts", List.of(textPart));

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("contents", List.of(content));

            String jsonPayload = objectMapper.writeValueAsString(payload);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> request = new HttpEntity<>(jsonPayload, headers);

            // Try text-only models with 429 retry
            for (String model : MODELS_TO_TRY) {
                for (int attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
                    String url = String.format(GEMINI_ENDPOINT_TEMPLATE, model, apiKey);
                    logger.info("Trying text interpretation with {} (attempt {})", model, attempt + 1);

                    try {
                        ResponseEntity<JsonNode> response = restTemplate.postForEntity(url, request, JsonNode.class);
                        JsonNode body = response.getBody();
                        if (body == null) break;

                        String text = body.at("/candidates/0/content/parts/0/text").asText("").trim();
                        if (!text.isBlank() && text.length() > 30) {
                            logger.info("Text interpretation succeeded with {}: {} chars", model, text.length());
                            return Optional.of(text);
                        }
                        break; // try next model
                    } catch (HttpClientErrorException e) {
                        int status = e.getStatusCode().value();
                        if (status == 401 || status == 403) {
                            markAuthFailure(status);
                            return Optional.empty();
                        }
                        if (status == 429 && attempt < MAX_429_RETRIES) {
                            long delay = RETRY_DELAYS_MS[attempt];
                            logger.info("Text interpretation {} rate limited, waiting {}ms...", model, delay);
                            try { Thread.sleep(delay); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                            continue;
                        }
                        logger.warn("Text interpretation {} HTTP error: {}", model, e.getStatusCode());
                        break;
                    } catch (Exception e) {
                        logger.warn("Text interpretation {} failed: {}", model, e.getMessage());
                        break;
                    }
                }
            }
        } catch (Exception e) {
            logger.error("Text interpretation failed: {}", e.getMessage());
        }

        return Optional.empty();
    }

    /**
     * Answer a user's question about their prescription using Gemini.
     */
    public Optional<String> answerQuestion(String question, String prescriptionContext) {
        String apiKey = getEffectiveApiKey();
        if (apiKey == null || apiKey.isBlank() || question == null || question.isBlank()) {
            return Optional.empty();
        }

        if (isAuthCooldownActive()) {
            logger.warn("Skipping Gemini Q&A during auth cooldown");
            return Optional.empty();
        }

        String prompt = """
                You are a helpful medical assistant for the MediCheck prescription reader app.
                A patient has uploaded a prescription and wants to ask a question about it.

                PRESCRIPTION CONTEXT:
                %s

                PATIENT'S QUESTION:
                %s

                RULES:
                - Answer clearly and helpfully in simple language a patient can understand.
                - If the question is about medicines, side effects, interactions, or dosage, provide accurate medical information.
                - Always add a disclaimer that the patient should consult their doctor for personalized advice.
                - If the question is unrelated to health/medicine, politely redirect them.
                - Keep the answer concise (3-6 sentences).
                - Do NOT use markdown formatting. Use plain text only.
                """.formatted(
                prescriptionContext != null && !prescriptionContext.isBlank() ? prescriptionContext : "No prescription uploaded yet.",
                question
        );

        try {
            Map<String, Object> textPart = new LinkedHashMap<>();
            textPart.put("text", prompt);

            Map<String, Object> content = new LinkedHashMap<>();
            content.put("parts", List.of(textPart));

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("contents", List.of(content));

            String jsonPayload = objectMapper.writeValueAsString(payload);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> request = new HttpEntity<>(jsonPayload, headers);

            for (String model : MODELS_TO_TRY) {
                for (int attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
                    String url = String.format(GEMINI_ENDPOINT_TEMPLATE, model, apiKey);
                    try {
                        ResponseEntity<JsonNode> response = restTemplate.postForEntity(url, request, JsonNode.class);
                        JsonNode body = response.getBody();
                        if (body == null) break;

                        String text = body.at("/candidates/0/content/parts/0/text").asText("").trim();
                        if (!text.isBlank() && text.length() > 10) {
                            logger.info("AI Q&A succeeded with {}: {} chars", model, text.length());
                            return Optional.of(text);
                        }
                        break;
                    } catch (HttpClientErrorException e) {
                        int status = e.getStatusCode().value();
                        if (status == 401 || status == 403) {
                            markAuthFailure(status);
                            return Optional.empty();
                        }
                        if (e.getStatusCode().value() == 429 && attempt < MAX_429_RETRIES) {
                            try { Thread.sleep(RETRY_DELAYS_MS[attempt]); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                            continue;
                        }
                        logger.warn("AI Q&A {} error: {}", model, e.getStatusCode());
                        break;
                    } catch (Exception e) {
                        logger.warn("AI Q&A {} failed: {}", model, e.getMessage());
                        break;
                    }
                }
            }
        } catch (Exception e) {
            logger.error("AI Q&A failed: {}", e.getMessage());
        }

        return Optional.empty();
    }

    private boolean isAuthCooldownActive() {
        return System.currentTimeMillis() < geminiAuthFailedUntilEpochMs;
    }

    private void markAuthFailure(int statusCode) {
        geminiAuthFailedUntilEpochMs = System.currentTimeMillis() + authFailureCooldownMs;
        logger.error("Gemini auth failed with HTTP {}. Disabling Gemini for {} ms.", statusCode, authFailureCooldownMs);
    }
}
