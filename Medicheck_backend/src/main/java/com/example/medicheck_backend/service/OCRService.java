package com.example.medicheck_backend.service;

import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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

    @Autowired(required = false)
    private CloudOcrFallbackService cloudOcrFallbackService;

    @Value("${ocr.cloud.google.min-local-score:185}")
    private double minLocalScoreForCloudSkip;

    @Value("${ocr.mock.enabled:false}")
    private boolean mockEnabled;

    @Override
    public String extractText(File imageFile) throws Exception {

        if (imageFile == null || !imageFile.exists()) {
            throw new IllegalArgumentException("Image file does not exist: " +
                (imageFile != null ? imageFile.getAbsolutePath() : "null"));
        }

        logger.info("Extracting text from image: {}", imageFile.getAbsolutePath());

        String tesseractPath = findTesseractPath();

        if (tesseractPath == null) {
            logger.warn("Tesseract-OCR not found. Trying cloud OCR fallback.");

            Optional<String> cloudText = tryCloudFallback(imageFile);
            if (cloudText.isPresent()) {
                logger.info("Cloud OCR used because Tesseract is unavailable.");
                return cloudText.get();
            }

            if (mockEnabled && mockOCRService != null) {
                logger.warn("Cloud OCR unavailable; using mock OCR because ocr.mock.enabled=true.");
                return mockOCRService.extractText(imageFile);
            }

            throw new Exception("Tesseract-OCR is not installed and cloud OCR is not configured/reachable. " +
                    "Install Tesseract or configure GOOGLE_VISION_API_KEY.");
        }

        logger.info("Using Tesseract installation at: {}", tesseractPath);

        // Point JNA to Tesseract installation for native DLLs
        System.setProperty("jna.library.path", tesseractPath);

        File enhancedFile = null;

        try {
            List<OcrCandidate> candidates = new ArrayList<>();

            // Keep original-image OCR as one candidate.
            addCandidateSafely(candidates, "tesseract-original-psm6", imageFile, tesseractPath, 6);
            addCandidateSafely(candidates, "tesseract-original-psm11", imageFile, tesseractPath, 11);

            // Preprocess image for handwriting/noisy scans, then run OCR passes.
            enhancedFile = preprocessForOcr(imageFile);
            addCandidateSafely(candidates, "tesseract-preprocessed-psm6", enhancedFile, tesseractPath, 6);
            addCandidateSafely(candidates, "tesseract-preprocessed-psm11", enhancedFile, tesseractPath, 11);

            OcrCandidate bestLocal = selectBestCandidate(candidates);

            if (shouldTryCloudFallback(bestLocal) && cloudOcrFallbackService != null) {
                Optional<String> cloudText = tryCloudFallback(imageFile);
                cloudText.ifPresent(text -> candidates.add(buildCandidate("google-vision", text)));
            }

            OcrCandidate best = selectBestCandidate(candidates);
            if (best == null) {
                return "";
            }

            logger.info(
                    "OCR extraction completed successfully, source={}, score={}, length={}",
                    best.source,
                    Math.round(best.score),
                    best.text.length()
            );
            return best.text;
        } catch (Exception e) {
            logger.error("Unexpected OCR error; trying cloud fallback", e);
            Optional<String> cloudText = tryCloudFallback(imageFile);
            if (cloudText.isPresent()) {
                return cloudText.get();
            }
            if (mockEnabled && mockOCRService != null) {
                logger.warn("Using MockOCRService because ocr.mock.enabled=true.");
                return mockOCRService.extractText(imageFile);
            }
            throw new Exception("Unexpected error during OCR: " + e.getMessage(), e);
        } finally {
            if (enhancedFile != null && enhancedFile.exists()) {
                boolean deleted = enhancedFile.delete();
                logger.debug("Enhanced OCR temp file deleted: {}", deleted);
            }
        }
    }

    private Optional<String> tryCloudFallback(File imageFile) {
        if (cloudOcrFallbackService == null) {
            return Optional.empty();
        }
        return cloudOcrFallbackService.extractTextIfConfigured(imageFile);
    }

    private void addCandidateSafely(
            List<OcrCandidate> candidates,
            String source,
            File targetFile,
            String tesseractPath,
            int pageSegMode
    ) {
        try {
            candidates.add(buildCandidate(source, runOcrPass(targetFile, tesseractPath, pageSegMode)));
        } catch (Exception ex) {
            logger.warn("OCR pass failed: {} ({})", source, ex.getMessage());
        }
    }

    private OcrCandidate buildCandidate(String source, String text) {
        String normalized = text == null ? "" : text.trim();
        return new OcrCandidate(source, normalized, scoreTextQuality(normalized));
    }

    private String runOcrPass(File targetFile, String tesseractPath, int pageSegMode) throws TesseractException {
        Tesseract tesseract = buildTesseract(tesseractPath, pageSegMode);
        String output = tesseract.doOCR(targetFile);
        return output == null ? "" : output.trim();
    }

    private Tesseract buildTesseract(String tesseractPath, int pageSegMode) {
        Tesseract tesseract = new Tesseract();
        tesseract.setDatapath(tesseractPath + File.separator + "tessdata");
        tesseract.setLanguage("eng");
        tesseract.setPageSegMode(pageSegMode);
        tesseract.setOcrEngineMode(1);
        tesseract.setTessVariable("user_defined_dpi", "300");
        tesseract.setTessVariable("preserve_interword_spaces", "1");
        return tesseract;
    }

    private File preprocessForOcr(File imageFile) throws IOException {
        BufferedImage source = ImageIO.read(imageFile);
        if (source == null) {
            throw new IOException("Unable to read image for OCR preprocessing.");
        }

        int targetWidth = Math.max(1200, source.getWidth() * 2);
        int targetHeight = Math.max(800, source.getHeight() * 2);
        BufferedImage upscaled = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);

        Graphics2D graphics = upscaled.createGraphics();
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        graphics.drawImage(source, 0, 0, targetWidth, targetHeight, null);
        graphics.dispose();

        BufferedImage binary = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_BYTE_BINARY);

        int threshold = estimateThreshold(upscaled);
        for (int y = 0; y < targetHeight; y++) {
            for (int x = 0; x < targetWidth; x++) {
                int rgb = upscaled.getRGB(x, y);
                int r = (rgb >> 16) & 0xff;
                int g = (rgb >> 8) & 0xff;
                int b = rgb & 0xff;

                int gray = (int) (0.299 * r + 0.587 * g + 0.114 * b);
                int adjusted = (int) Math.max(0, Math.min(255, (gray - 128) * 1.15 + 128));
                int bw = adjusted < threshold ? 0 : 255;
                int color = (bw << 16) | (bw << 8) | bw;
                binary.setRGB(x, y, color);
            }
        }

        File enhanced = File.createTempFile("ocr_preprocessed_", ".png");
        ImageIO.write(binary, "png", enhanced);
        return enhanced;
    }

    private int estimateThreshold(BufferedImage image) {
        int width = image.getWidth();
        int height = image.getHeight();
        long sum = 0;
        long count = (long) width * height;

        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int rgb = image.getRGB(x, y);
                int r = (rgb >> 16) & 0xff;
                int g = (rgb >> 8) & 0xff;
                int b = rgb & 0xff;
                int gray = (int) (0.299 * r + 0.587 * g + 0.114 * b);
                sum += gray;
            }
        }

        int average = (int) (sum / Math.max(1, count));
        return Math.max(95, Math.min(175, average));
    }

    private OcrCandidate selectBestCandidate(List<OcrCandidate> candidates) {
        return candidates.stream()
                .filter(candidate -> candidate != null && !candidate.text.isBlank())
                .max(Comparator.comparingDouble(candidate -> candidate.score))
                .orElse(null);
    }

    private boolean shouldTryCloudFallback(OcrCandidate bestLocal) {
        if (bestLocal == null) {
            return true;
        }

        if (bestLocal.score < minLocalScoreForCloudSkip) {
            return true;
        }

        return countReadableWords(bestLocal.text) < 24;
    }

    private double scoreTextQuality(String text) {
        int length = text.length();
        if (length == 0) {
            return 0;
        }

        int alphaNumeric = 0;
        int symbols = 0;
        for (char ch : text.toCharArray()) {
            if (Character.isLetterOrDigit(ch) || Character.isWhitespace(ch)) {
                alphaNumeric++;
            } else {
                symbols++;
            }
        }

        double ratio = (double) alphaNumeric / length;
        int readableWords = countReadableWords(text);
        int medicalHints = countMedicalHints(text);

        return ratio * 120 + readableWords * 2.4 + medicalHints * 6 - symbols * 0.08;
    }

    private int countReadableWords(String text) {
        Matcher matcher = Pattern.compile("\\b[a-zA-Z]{3,}\\b").matcher(text);
        int count = 0;
        while (matcher.find()) {
            count++;
        }
        return count;
    }

    private int countMedicalHints(String text) {
        String lower = text.toLowerCase(Locale.ROOT);
        List<String> hints = List.of("mg", "ml", "od", "bd", "tds", "tablet", "capsule", "tab", "cap");
        int total = 0;
        for (String hint : hints) {
            if (lower.contains(hint)) {
                total++;
            }
        }
        return total;
    }

    private static class OcrCandidate {
        private final String source;
        private final String text;
        private final double score;

        private OcrCandidate(String source, String text, double score) {
            this.source = source;
            this.text = text;
            this.score = score;
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