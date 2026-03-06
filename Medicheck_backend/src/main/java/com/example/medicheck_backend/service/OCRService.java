package com.example.medicheck_backend.service;

import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.File;

/**
 * OCR Service using Tesseract-OCR for real text extraction.
 * Falls back to MockOCRService if Tesseract is not installed.
 */
@Service
public class OCRService implements OCRServiceInterface {

    private static final Logger logger = LoggerFactory.getLogger(OCRService.class);
    private static final String PRIMARY_TESSERACT_PATH = "C:\\Program Files\\Tesseract-OCR";
    private static final String FALLBACK_TESSERACT_PATH = "C:\\Users\\HP\\AppData\\Local\\Programs\\Tesseract-OCR";
    private static final String ALT_TESSERACT_PATH = "C:\\Program Files (x86)\\Tesseract-OCR";

    @Autowired(required = false)
    private MockOCRService mockOCRService;

    @Override
    public String extractText(File imageFile) throws Exception {

        if (imageFile == null || !imageFile.exists()) {
            throw new IllegalArgumentException("Image file does not exist: " +
                (imageFile != null ? imageFile.getAbsolutePath() : "null"));
        }

        logger.info("Extracting text from image: {}", imageFile.getAbsolutePath());

        String tesseractPath = findTesseractPath();

        if (tesseractPath == null) {
            logger.warn("Tesseract-OCR not found. Switching to mock OCR for testing/development.");
            logger.warn("For production use, install Tesseract from: https://github.com/UB-Mannheim/tesseract/wiki");

            if (mockOCRService != null) {
                return mockOCRService.extractText(imageFile);
            } else {
                throw new Exception("Tesseract-OCR is not installed and mock OCR service is not available. " +
                    "Please install Tesseract from: https://github.com/UB-Mannheim/tesseract/wiki");
            }
        }

        logger.info("Using Tesseract installation at: {}", tesseractPath);

        // Point JNA to Tesseract installation for native DLLs
        System.setProperty("jna.library.path", tesseractPath);

        Tesseract tesseract = new Tesseract();
        tesseract.setDatapath(tesseractPath + File.separator + "tessdata");
        tesseract.setLanguage("eng");
        tesseract.setTessVariable("user_defined_dpi", "300");

        try {
            String result = tesseract.doOCR(imageFile);
            logger.info("OCR extraction completed successfully, extracted {} characters", result.length());
            return result;
        } catch (TesseractException e) {
            logger.error("Tesseract OCR processing error, falling back to mock OCR", e);
            if (mockOCRService != null) {
                logger.warn("Using MockOCRService as fallback due to Tesseract failure");
                return mockOCRService.extractText(imageFile);
            }
            throw new Exception("Failed to process image with OCR: " + e.getMessage() +
                ". Make sure Tesseract is properly installed with English language data.", e);
        } catch (Exception e) {
            logger.error("Unexpected error during OCR processing, falling back to mock OCR", e);
            if (mockOCRService != null) {
                logger.warn("Using MockOCRService as fallback due to unexpected error");
                return mockOCRService.extractText(imageFile);
            }
            throw new Exception("Unexpected error during OCR: " + e.getMessage(), e);
        }
    }

    private String findTesseractPath() {
        String[] pathsToCheck = {
            PRIMARY_TESSERACT_PATH,
            ALT_TESSERACT_PATH,
            FALLBACK_TESSERACT_PATH
        };

        for (String path : pathsToCheck) {
            File pathFile = new File(path);
            if (pathFile.exists() && pathFile.isDirectory()) {
                logger.info("Found Tesseract installation at: {}", path);
                return path;
            } else {
                logger.debug("Tesseract path not found: {}", path);
            }
        }

        logger.warn("Tesseract-OCR not found in any of the expected locations");
        return null;
    }
}