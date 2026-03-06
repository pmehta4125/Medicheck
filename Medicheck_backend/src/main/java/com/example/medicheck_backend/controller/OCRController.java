package com.example.medicheck_backend.controller;

import com.example.medicheck_backend.service.OCRService;
import com.example.medicheck_backend.service.PrescriptionInsightsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/analyze")
@CrossOrigin(originPatterns = "http://localhost:*")
public class OCRController {

    private static final Logger logger = LoggerFactory.getLogger(OCRController.class);

    @Autowired
    private OCRService ocrService;

    @Autowired
    private PrescriptionInsightsService prescriptionInsightsService;

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

            // Extract text using OCR
            logger.info("Starting OCR extraction...");
            String extractedText = ocrService.extractText(tempFile);
            logger.info("OCR extraction completed");
            logger.info("Extracted text length: {} characters", extractedText.length());

            // Return successful response
            Map<String, Object> response = new HashMap<>();
            Map<String, Object> insights = prescriptionInsightsService.buildInsights(extractedText);
            response.put("success", true);
            response.put("rawText", extractedText);
            response.put("text", insights.getOrDefault("cleanedText", extractedText));
            response.put("message", "Prescription analyzed successfully");
            response.putAll(insights);

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
}

