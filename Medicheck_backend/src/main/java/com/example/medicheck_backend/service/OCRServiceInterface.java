package com.example.medicheck_backend.service;

import java.io.File;

/**
 * Interface for OCR Services.
 * Allows switching between real Tesseract-OCR and mock implementations.
 */
public interface OCRServiceInterface {
    /**
     * Extract text from an image file.
     * @param imageFile The image file to process
     * @return Extracted text from the image
     * @throws Exception If processing fails
     */
    String extractText(File imageFile) throws Exception;
}

