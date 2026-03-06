package com.example.medicheck_backend.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.File;
import java.util.Random;

/**
 * Mock OCR Service for testing and development purposes.
 * Returns sample prescription text extracted from the image.
 * Use this when Tesseract-OCR is not available.
 */
@Component
public class MockOCRService implements OCRServiceInterface {

    private static final Logger logger = LoggerFactory.getLogger(MockOCRService.class);

    private static final String[] SAMPLE_MEDICATIONS = {
            "AMOXICILLIN 500MG",
            "PARACETAMOL 650MG",
            "IBUPROFEN 400MG",
            "METFORMIN 500MG",
            "LISINOPRIL 10MG",
            "OMEPRAZOLE 20MG",
            "ASPIRIN 100MG",
            "ATORVASTATIN 20MG"
    };

    private static final String[] SAMPLE_INSTRUCTIONS = {
            "Take one tablet twice daily",
            "Take one capsule three times a day",
            "Take two tablets once daily",
            "Take one tablet before breakfast",
            "Take one tablet after meals"
    };

    @Override
    public String extractText(File imageFile) throws Exception {
        if (imageFile == null || !imageFile.exists()) {
            throw new IllegalArgumentException("Image file does not exist");
        }

        logger.info("Using MOCK OCR for testing - File: {}", imageFile.getAbsolutePath());

        // Generate mock prescription text
        Random random = new Random();
        StringBuilder prescription = new StringBuilder();

        prescription.append("PRESCRIPTION\n");
        prescription.append("Patient Name: John Doe\n");
        prescription.append("Date: 06/03/2026\n");
        prescription.append("Doctor: Dr. Jane Smith\n");
        prescription.append("-------------------\n\n");

        // Add random medications
        int numMeds = random.nextInt(3) + 1; // 1-3 medications
        for (int i = 0; i < numMeds; i++) {
            prescription.append(SAMPLE_MEDICATIONS[random.nextInt(SAMPLE_MEDICATIONS.length)]).append("\n");
            prescription.append(SAMPLE_INSTRUCTIONS[random.nextInt(SAMPLE_INSTRUCTIONS.length)]).append("\n");
            prescription.append("Duration: 5-7 days\n\n");
        }

        prescription.append("-------------------\n");
        prescription.append("Note: This is MOCK data for testing purposes.");

        logger.warn("MOCK OCR RESULT - In production, ensure Tesseract-OCR is installed");
        return prescription.toString();
    }
}

