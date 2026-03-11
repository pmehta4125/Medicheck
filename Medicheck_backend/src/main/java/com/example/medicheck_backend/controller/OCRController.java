package com.example.medicheck_backend.controller;

import com.example.medicheck_backend.service.GeminiVisionService;
import com.example.medicheck_backend.service.OCRService;
import com.example.medicheck_backend.service.PrescriptionInsightsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.example.medicheck_backend.repository.UserRepository;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/analyze")
@CrossOrigin(originPatterns = "http://localhost:*")
public class OCRController {

    private static final Logger logger = LoggerFactory.getLogger(OCRController.class);

    @Autowired
    private OCRService ocrService;

    @Autowired
    private GeminiVisionService geminiVisionService;

    @Autowired
    private PrescriptionInsightsService prescriptionInsightsService;

    @Autowired
    private UserRepository userRepository;

    @PostMapping
    public ResponseEntity<?> analyzePrescription(
        @RequestParam(value = "file", required = false) MultipartFile file,
        @RequestParam(value = "image", required = false) MultipartFile image
    ) {
        File tempFile = null;
        MultipartFile upload = file != null ? file : image;

        try {
            logger.info("=== OCR Analysis Request Started ===");
            if (upload == null) {
                logger.warn("No file provided. Expected multipart key 'file' or 'image'.");
                Map<String, String> error = new HashMap<>();
                error.put("error", "No file was uploaded. Use multipart field name 'file' or 'image'.");
                return ResponseEntity.badRequest().body(error);
            }

            logger.info("Received prescription file: {}", upload.getOriginalFilename());
            logger.info("File size: {} bytes", upload.getSize());
            logger.info("File content type: {}", upload.getContentType());

            if (upload.isEmpty()) {
                logger.warn("Uploaded file is empty");
                Map<String, String> error = new HashMap<>();
                error.put("error", "File is empty");
                return ResponseEntity.badRequest().body(error);
            }

            // Get system temp directory
            String tempDir = System.getProperty("java.io.tmpdir");
            logger.info("Using temp directory: {}", tempDir);

            // Create temp file with proper extension
            String originalFileName = upload.getOriginalFilename();
            String fileExtension = originalFileName != null && originalFileName.contains(".")
                ? originalFileName.substring(originalFileName.lastIndexOf("."))
                : ".tmp";

            logger.info("File extension: {}", fileExtension);

            // Create temp file
            tempFile = File.createTempFile("prescription_", fileExtension, new File(tempDir));
            logger.info("Temp file created at: {}", tempFile.getAbsolutePath());

            // Save the file
            upload.transferTo(tempFile);
            logger.info("File successfully saved to temp location");
            logger.info("File exists: {}", tempFile.exists());
            logger.info("File size after save: {} bytes", tempFile.length());

            // Try Gemini AI Vision first (best for handwritten prescriptions)
            logger.info("Trying Gemini AI Vision for prescription analysis...");
            Optional<String> geminiResult = geminiVisionService.analyzePrescription(tempFile);

            Map<String, Object> response = new HashMap<>();

            if (geminiResult.isPresent() && geminiResult.get().length() > 30) {
                String geminiText = geminiResult.get();
                logger.info("Gemini AI Vision succeeded, response length: {} chars", geminiText.length());

                // Build insights from Gemini's structured text (parses medicines, risk, schedule)
                Map<String, Object> insights = prescriptionInsightsService.buildInsightsFromGemini(geminiText);

                // Also run traditional OCR for raw text comparison
                String extractedText = "";
                try {
                    extractedText = ocrService.extractText(tempFile);
                } catch (Exception ocrEx) {
                    logger.warn("Traditional OCR failed (Gemini already succeeded): {}", ocrEx.getMessage());
                }

                // If Gemini found no medicines, try supplementing from OCR text
                @SuppressWarnings("unchecked")
                java.util.List<Object> geminiMedicines = (java.util.List<Object>) insights.get("medicines");
                if ((geminiMedicines == null || geminiMedicines.isEmpty()) && !extractedText.isBlank()) {
                    logger.info("Gemini found no medicines, attempting OCR-based extraction as supplement...");
                    Map<String, Object> ocrInsights = prescriptionInsightsService.buildInsights(extractedText);
                    @SuppressWarnings("unchecked")
                    java.util.List<Object> ocrMedicines = (java.util.List<Object>) ocrInsights.get("medicines");
                    if (ocrMedicines != null && !ocrMedicines.isEmpty()) {
                        logger.info("OCR extracted {} medicines as supplement", ocrMedicines.size());
                        insights.put("medicines", ocrMedicines);
                        insights.put("riskScore", ocrInsights.get("riskScore"));
                        insights.put("risks", ocrInsights.get("risks"));
                        insights.put("medicineExplanations", ocrInsights.get("medicineExplanations"));
                        insights.put("scheduleTimeline", ocrInsights.get("scheduleTimeline"));
                    }
                }

                response.put("success", true);
                response.put("rawText", extractedText);
                response.put("text", geminiText);
                response.put("geminiAnalysis", geminiText);
                response.put("message", "Prescription analyzed successfully using AI Vision");
                response.putAll(insights);
            } else {
                // Fallback: Gemini Vision failed. Try OCR + Gemini text interpretation hybrid.
                logger.info("Gemini Vision unavailable or failed, falling back to OCR + text interpretation...");
                String extractedText = ocrService.extractText(tempFile);
                logger.info("OCR extraction completed, length: {} characters", extractedText.length());

                // Try sending OCR text to Gemini for intelligent interpretation
                Optional<String> textInterpretation = geminiVisionService.interpretOcrText(extractedText);

                if (textInterpretation.isPresent() && textInterpretation.get().length() > 30) {
                    String geminiText = textInterpretation.get();
                    logger.info("Gemini text interpretation succeeded: {} chars", geminiText.length());

                    Map<String, Object> insights = prescriptionInsightsService.buildInsightsFromGemini(geminiText);
                    response.put("success", true);
                    response.put("rawText", extractedText);
                    response.put("text", geminiText);
                    response.put("geminiAnalysis", geminiText);
                    response.put("message", "Prescription analyzed using OCR + AI text interpretation");
                    response.putAll(insights);
                } else {
                    // Pure OCR fallback (no Gemini at all)
                    logger.info("Gemini text interpretation also failed, using pure OCR...");
                    Map<String, Object> insights = prescriptionInsightsService.buildInsights(extractedText);
                    response.put("success", true);
                    response.put("rawText", extractedText);
                    response.put("text", insights.getOrDefault("simpleEnglishText", insights.getOrDefault("cleanedText", extractedText)));
                    response.put("message", "Prescription analyzed using OCR only");
                    response.putAll(insights);
                }
            }

            logger.info("=== OCR Analysis Completed Successfully ===");
            return ResponseEntity.ok(response);

        } catch (IOException e) {
            logger.error("IO Error during file processing", e);
            Map<String, String> error = new HashMap<>();
            error.put("error", "File processing failed: " + e.getMessage());
            error.put("type", "IOException");
            return ResponseEntity.internalServerError().body(error);

        } catch (Exception e) {
            logger.error("Error during OCR processing", e);
            Map<String, String> error = new HashMap<>();
            error.put("error", "OCR processing failed: " + e.getMessage());
            error.put("type", e.getClass().getSimpleName());
            return ResponseEntity.internalServerError().body(error);

        } finally {
            // Cleanup temp file
            if (tempFile != null && tempFile.exists()) {
                try {
                    boolean deleted = tempFile.delete();
                    logger.info("Temp file cleanup - Deleted: {}", deleted);
                } catch (Exception e) {
                    logger.warn("Failed to delete temp file: {}", tempFile.getAbsolutePath(), e);
                }
            }
        }
    }

    @PostMapping("/ask")
    public ResponseEntity<?> askQuestion(@RequestBody Map<String, String> body) {
        String question = body.get("question");
        String context = body.get("prescriptionContext");

        if (question == null || question.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Question is required"));
        }

        logger.info("AI Q&A request: {}", question.substring(0, Math.min(100, question.length())));

        Optional<String> answer = geminiVisionService.answerQuestion(question, context);

        if (answer.isPresent()) {
            return ResponseEntity.ok(Map.of("answer", answer.get()));
        }

        return ResponseEntity.ok(Map.of("answer",
                "I'm sorry, I couldn't process your question right now. Please try again in a moment or consult your doctor/pharmacist directly."));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        long userCount = userRepository.count();
        return ResponseEntity.ok(Map.of("userCount", userCount));
    }
}

