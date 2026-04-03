package com.example.medicheck_backend.service;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class PrescriptionInsightsService {

    // Known medicine names for bonus matching
    private static final Pattern KNOWN_MEDICINE_PATTERN = Pattern.compile(
            "(paracetamol|dolo|crocin|calpol|ibuprofen|amoxicillin|amoxyclav|azithromycin|cetirizine|cetzine|pantoprazole|pantocid|metformin|atorvastatin|omeprazole|aspirin|lisinopril|amlodipine|losartan|telmisartan|atenolol|metoprolol|ramipril|enalapril|ciprofloxacin|levofloxacin|ofloxacin|cefixime|ceftriaxone|doxycycline|clindamycin|fluconazole|acyclovir|ranitidine|domperidone|ondansetron|diclofenac|naproxen|tramadol|gabapentin|pregabalin|clonazepam|alprazolam|escitalopram|sertraline|fluoxetine|risperidone|olanzapine|levothyroxine|insulin|glimepiride|sitagliptin|rosuvastatin|clopidogrel|warfarin|furosemide|hydrochlorothiazide|spironolactone|montelukast|salbutamol|budesonide|prednisolone|methylprednisolone|folic acid|iron|calcium|vitamin|multivitamin|shelcal|becosule|zincovit|limcee|sinarest|allegra|montair|deriphyllin|asthalin|foracort|budecort|alex|benadryl|vicks|strepsils|betadine|neosporin|candid|clotrimazole|mvitamin|stamlo|cilnidipine|torsemide|olmesartan|chlorthalidone|indapamide|bisoprolol|carvedilol|diltiazem|verapamil|nitroglycerin|digoxin|amiodarone|enoxaparin|rivaroxaban|apixaban|dabigatran|ticagrelor|prasugrel|vildagliptin|empagliflozin|dapagliflozin|pioglitazone|glipizide|gliclazide|voglibose|acarbose|teneligliptin|linezolid|meropenem|piperacillin|tazobactam|vancomycin|colistin|tigecycline|metronidazole|tinidazole|secnidazole|albendazole|ivermectin|hydroxychloroquine|levetiracetam|carbamazepine|phenytoin|valproate|topiramate|lamotrigine|baclofen|tizanidine|duloxetine|venlafaxine|amitriptyline|mirtazapine|quetiapine|aripiprazole|haloperidol|lithium|donepezil|memantine|trihexyphenidyl|levodopa|carbidopa|ropinirole|pramipexole|kloza|altonil|constiguard|chymoral|vivifiz|stamlo|cilacart|arknil|relax|zodow|leon)",
            Pattern.CASE_INSENSITIVE
    );

    // Generic pattern: "Tab/Cap/Syp + Medicine Name" - works for ANY medicine
    private static final Pattern PRESCRIPTION_LINE_PATTERN = Pattern.compile(
            "(?i)(?:tab\\.?|cap\\.?|syp\\.?|inj\\.?|tablet|capsule|syrup|injection|cream|ointment|drops|gel|lotion|spray)\\s+([A-Za-z][A-Za-z0-9\\s\\-\\.]+?)(?:\\s*[-–]|\\s*\\(|\\s+\\d|\\s*$)",
            Pattern.CASE_INSENSITIVE
    );

    // Pattern for "Rx" lines
    private static final Pattern RX_LINE_PATTERN = Pattern.compile(
            "(?i)^\\s*(?:Rx|R/?x)\\s+(.+)",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern DOSAGE_PATTERN = Pattern.compile("(\\d{1,4}\\s?(?:mg|ml|mcg|gm|g|iu|%|unit))", Pattern.CASE_INSENSITIVE);
    private static final Pattern FREQUENCY_PATTERN = Pattern.compile(
            "(once|twice|thrice|daily|morning|afternoon|evening|night|od|o\\.?d\\.?|bd|b\\.?d\\.?|tds|t\\.?d\\.?s\\.?|hs|h\\.?s\\.?|sos|s\\.?o\\.?s\\.?|qid|prn|before food|after food|before meal|after meal|empty stomach|at morning|at night|at bedtime)",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern DURATION_PATTERN = Pattern.compile(
            "(\\d+\\s?(?:day|days|week|weeks|month|months))",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern MEDICAL_HINT_PATTERN = Pattern.compile(
            "(mg|ml|mcg|tab|tablet|cap|capsule|od|bd|tds|sos|hs|dr\\.|doctor|hospital|patient|pulse|bp|spo2|temp|rx|reg\\.|name|date|syp|inj|cream|ointment)",
            Pattern.CASE_INSENSITIVE
    );
    // "1 tab" / "2 caps" / "1-0-1" / "0-0-1" pattern
    private static final Pattern DOSING_SCHEDULE_PATTERN = Pattern.compile(
            "(\\d\\s*[-–]\\s*\\d\\s*[-–]\\s*\\d|\\d+\\s*tab(?:let)?s?|\\d+\\s*cap(?:sule)?s?|\\d+\\s*(?:tsp|tablespoon|teaspoon|spoon|drops|puff))",
            Pattern.CASE_INSENSITIVE
    );

    private static final Map<String, Map<String, String>> MEDICINE_INFO = createMedicineInfo();
    private static final List<List<String>> INTERACTION_RULES = List.of(
            List.of("ibuprofen", "paracetamol"),
            List.of("azithromycin", "amoxicillin"),
            List.of("ibuprofen", "atorvastatin")
    );

    public Map<String, Object> buildInsights(String rawText) {
        String cleanedText = buildReadableText(rawText);
        // Try smart parsing on raw text first (has more data), then cleaned
        List<Map<String, String>> medicines = parseSmartMedicines(rawText);
        if (medicines.isEmpty()) {
            medicines = parseSmartMedicines(cleanedText);
        }
        if (medicines.isEmpty()) {
            medicines = parseMedicinesByKnownNames(cleanedText);
        }
        if (medicines.isEmpty()) {
            medicines = parseMedicinesByKnownNames(rawText);
        }
        Map<String, Object> riskData = buildRiskScore(medicines);

        Map<String, Object> response = new HashMap<>();
        response.put("cleanedText", cleanedText);
        response.put("simpleEnglishText", buildSimpleEnglishText(cleanedText, medicines));
        response.put("medicines", medicines);
        response.put("riskScore", riskData.get("riskScore"));
        response.put("risks", riskData.get("risks"));
        response.put("medicineExplanations", buildMedicineExplanations(medicines));
        response.put("scheduleTimeline", buildScheduleTimeline(medicines));
        return response;
    }

    /**
     * Build insights from Gemini AI text. Parses the structured Gemini response
     * to extract medicines, risk scores, explanations and schedules.
     */
    public Map<String, Object> buildInsightsFromGemini(String geminiText) {
        List<Map<String, String>> medicines = parseGeminiMedicines(geminiText);
        Map<String, Object> riskData = buildRiskScore(medicines);
        Map<String, String> prescriptionInfo = parseGeminiPrescriptionInfo(geminiText);

        Map<String, Object> response = new HashMap<>();
        response.put("cleanedText", geminiText);
        response.put("simpleEnglishText", geminiText);
        response.put("geminiAnalysis", geminiText);
        response.put("medicines", medicines);
        response.put("doctorName", prescriptionInfo.getOrDefault("doctor", "Not clearly visible"));
        response.put("patientName", prescriptionInfo.getOrDefault("patient", "Not clearly visible"));
        response.put("prescriptionDate", prescriptionInfo.getOrDefault("date", "Not clearly visible"));
        response.put("diagnosis", prescriptionInfo.getOrDefault("diagnosis", "Not specified"));
        response.put("additionalNotes", prescriptionInfo.getOrDefault("additionalNotes", ""));
        response.put("riskScore", riskData.get("riskScore"));
        response.put("risks", riskData.get("risks"));
        response.put("medicineExplanations", buildMedicineExplanations(medicines));
        response.put("scheduleTimeline", buildScheduleTimeline(medicines));
        return response;
    }

    /**
     * Extract doctor, patient, date, diagnosis, and additional notes from Gemini's structured text.
     */
    private Map<String, String> parseGeminiPrescriptionInfo(String geminiText) {
        Map<String, String> info = new HashMap<>();
        if (geminiText == null || geminiText.isBlank()) return info;

        String[] lines = geminiText.split("\\r?\\n");
        StringBuilder additionalNotes = new StringBuilder();
        boolean inAdditionalNotes = false;

        for (String line : lines) {
            String trimmed = line.trim();
            String upper = trimmed.toUpperCase();

            if (upper.startsWith("DOCTOR:") || upper.startsWith("DR:") || upper.startsWith("DR.:")) {
                info.put("doctor", trimmed.substring(trimmed.indexOf(':') + 1).trim());
                inAdditionalNotes = false;
            } else if (upper.startsWith("PATIENT:")) {
                info.put("patient", trimmed.substring(trimmed.indexOf(':') + 1).trim());
                inAdditionalNotes = false;
            } else if (upper.startsWith("DATE:")) {
                info.put("date", trimmed.substring(trimmed.indexOf(':') + 1).trim());
                inAdditionalNotes = false;
            } else if (upper.startsWith("DIAGNOSIS:")) {
                info.put("diagnosis", trimmed.substring(trimmed.indexOf(':') + 1).trim());
                inAdditionalNotes = false;
            } else if (upper.startsWith("ADDITIONAL NOTES:") || upper.startsWith("ADDITIONAL:") || upper.startsWith("NOTES:")) {
                String noteContent = trimmed.substring(trimmed.indexOf(':') + 1).trim();
                if (!noteContent.isBlank()) {
                    additionalNotes.append(noteContent);
                }
                inAdditionalNotes = true;
            } else if (inAdditionalNotes && !trimmed.isBlank()) {
                if (additionalNotes.length() > 0) additionalNotes.append("; ");
                additionalNotes.append(trimmed);
            } else if (upper.startsWith("MEDICINES:") || upper.startsWith("MEDICINES")) {
                inAdditionalNotes = false;
            }
        }

        if (additionalNotes.length() > 0) {
            info.put("additionalNotes", additionalNotes.toString());
        }

        return info;
    }

    /**
     * Parse medicines from Gemini's structured output format.
     * Expects lines like: "1. Medicine Name | 500mg | twice daily | 5 days | after food"
     */
    private List<Map<String, String>> parseGeminiMedicines(String geminiText) {
        if (geminiText == null || geminiText.isBlank()) {
            return Collections.emptyList();
        }

        List<Map<String, String>> medicines = new ArrayList<>();
        String[] lines = geminiText.split("\\r?\\n");
        boolean inMedicinesSection = false;

        for (String line : lines) {
            String trimmed = line.trim();

            if (trimmed.toUpperCase().startsWith("MEDICINES:") || trimmed.toUpperCase().startsWith("MEDICINES")) {
                inMedicinesSection = true;
                continue;
            }

            // Stop parsing medicines when we hit another section header
            if (inMedicinesSection && (trimmed.toUpperCase().startsWith("DIAGNOSIS:") ||
                    trimmed.toUpperCase().startsWith("ADDITIONAL NOTES:") ||
                    trimmed.toUpperCase().startsWith("ADDITIONAL:") ||
                    trimmed.isBlank())) {
                if (trimmed.toUpperCase().startsWith("DIAGNOSIS:") || trimmed.toUpperCase().startsWith("ADDITIONAL")) {
                    inMedicinesSection = false;
                }
                continue;
            }

            if (!inMedicinesSection) {
                continue;
            }

            // Parse numbered medicine lines: "1. Name | Dosage | Frequency | Duration | Instructions"
            String cleaned = trimmed.replaceFirst("^\\d+\\.\\s*", ""); // Remove leading number
            if (cleaned.isBlank() || cleaned.length() < 3) {
                continue;
            }

            // Try pipe-separated format first
            String[] parts;
            if (cleaned.contains("|")) {
                parts = cleaned.split("\\|");
            } else if (cleaned.contains(" - ")) {
                parts = cleaned.split("\\s*-\\s*");
            } else {
                // Single medicine name without details
                parts = new String[]{cleaned};
            }

            Map<String, String> medicine = new HashMap<>();
            String name = parts.length > 0 ? parts[0].trim() : cleaned;
            // Clean up name - remove common prefixes
            name = name.replaceFirst("(?i)^(tab\\.?|cap\\.?|syp\\.?|inj\\.?|tablet|capsule|syrup|injection)\\s+", "");
            medicine.put("name", name);
            medicine.put("dosage", parts.length > 1 ? parts[1].trim() : "Not specified");
            medicine.put("frequency", parts.length > 2 ? parts[2].trim() : "As directed");
            medicine.put("duration", parts.length > 3 ? parts[3].trim() : "As prescribed");
            if (parts.length > 4) {
                medicine.put("instructions", parts[4].trim());
            }
            medicine.put("raw", trimmed);
            medicines.add(medicine);
        }

        return medicines;
    }

    private String buildSimpleEnglishText(String cleanedText, List<Map<String, String>> medicines) {
        StringBuilder summary = new StringBuilder();
        summary.append("Prescription Analysis\n");

        if (medicines == null || medicines.isEmpty()) {
            summary.append("- Processing prescription image with OCR...\n");
            if (cleanedText != null && !cleanedText.isBlank()) {
                summary.append("- Detected text from prescription:\n");
                String[] lines = cleanedText.split("\\r?\\n");
                int count = 0;
                for (String line : lines) {
                    String trimmed = line.trim();
                    if (!trimmed.isEmpty() && trimmed.length() >= 3 && count < 15) {
                        summary.append("  ").append(trimmed).append("\n");
                        count++;
                    }
                }
                if (count == 0) {
                    summary.append("- Text was difficult to read. Try a clearer, well-lit photo.\n");
                } else {
                    summary.append("- Note: Handwriting recognition may be incomplete. Please verify with your pharmacist.\n");
                }
            } else {
                summary.append("- Could not extract text. Please try a clearer photo.\n");
            }
            return summary.toString().trim();
        }

        summary.append("- Medicines detected:\n");
        int index = 1;
        for (Map<String, String> medicine : medicines) {
            String name = medicine.getOrDefault("name", "Unknown");
            String dosage = medicine.getOrDefault("dosage", "Not specified");
            String frequency = medicine.getOrDefault("frequency", "As directed");
            String duration = medicine.getOrDefault("duration", "As prescribed");
            summary.append(index)
                    .append(". ")
                    .append(name)
                    .append(" | Dosage: ")
                    .append(dosage)
                    .append(" | Frequency: ")
                    .append(frequency)
                    .append(" | Duration: ")
                    .append(duration)
                    .append("\n");
            index++;
            if (index > 8) {
                break;
            }
        }

        if (cleanedText == null || cleanedText.isBlank()) {
            summary.append("- Original handwritten text was unclear, so details may be incomplete.");
        } else if (countReadableContentLines(cleanedText) < 3) {
            summary.append("- Handwriting is difficult to read; please verify with doctor/pharmacist before using medicines.");
        }

        return summary.toString().trim();
    }

    private int countReadableContentLines(String text) {
        int lines = 0;
        for (String line : text.split("\\r?\\n")) {
            String value = line.trim();
            if (value.length() < 4) {
                continue;
            }
            if (lineReadabilityScore(value) >= 55 || isLikelyReadableMedicalLine(value)) {
                lines++;
            }
        }
        return lines;
    }

    public String buildReadableText(String rawText) {
        if (rawText == null || rawText.isBlank()) {
            return "";
        }

        String[] lines = rawText.split("\\r?\\n");
        List<String> cleaned = new ArrayList<>();
        List<Map<String, Object>> scored = new ArrayList<>();

        for (String line : lines) {
            String normalized = line == null ? "" : line.replaceAll("\\s+", " ").trim();
            if (normalized.isBlank()) {
                continue;
            }

            double score = lineReadabilityScore(normalized);
            Map<String, Object> item = new HashMap<>();
            item.put("line", normalized);
            item.put("score", score);
            scored.add(item);

            if (score >= 50 || isLikelyReadableMedicalLine(normalized)) {
                cleaned.add(normalized);
            }
        }

        if (cleaned.isEmpty() && !scored.isEmpty()) {
            scored.sort((a, b) -> Double.compare((double) b.get("score"), (double) a.get("score")));
            for (Map<String, Object> item : scored) {
                double score = (double) item.get("score");
                if (score < 40) {
                    continue;
                }
                cleaned.add((String) item.get("line"));
                if (cleaned.size() >= 8) {
                    break;
                }
            }
        }

        if (cleaned.isEmpty()) {
            return rawText;
        }

        return String.join("\n", cleaned);
    }

    private double lineReadabilityScore(String line) {
        int alpha = 0;
        int digits = 0;
        int symbols = 0;
        for (char ch : line.toCharArray()) {
            if (Character.isLetter(ch)) {
                alpha++;
            } else if (Character.isDigit(ch)) {
                digits++;
            } else if (!Character.isWhitespace(ch)) {
                symbols++;
            }
        }

        int length = Math.max(1, line.length());
        double alphaRatio = (double) alpha / length;
        double symbolRatio = (double) symbols / length;
        String[] tokens = line.split("\\s+");

        int readableTokens = 0;
        int noisyTokens = 0;
        int singleCharTokens = 0;
        for (String token : tokens) {
            String normalized = token.replaceAll("[^a-zA-Z0-9]", "").toLowerCase();
            if (normalized.isEmpty()) {
                continue;
            }

            if (normalized.length() == 1) {
                singleCharTokens++;
            }

            if (normalized.matches("(mg|ml|tab|tablet|cap|capsule|od|bd|tds|sos|rx|bp|hr|rr)") ||
                (normalized.length() >= 3 && normalized.matches(".*[aeiou].*"))) {
                readableTokens++;
            } else if (normalized.length() >= 4) {
                noisyTokens++;
            }
        }

        int hintBonus = MEDICAL_HINT_PATTERN.matcher(line).find() ? 18 : 0;
        int medicineBonus = KNOWN_MEDICINE_PATTERN.matcher(line).find() ? 24 : 0;
        int prescriptionBonus = PRESCRIPTION_LINE_PATTERN.matcher(line).find() ? 20 : 0;
        int dosageBonus = DOSAGE_PATTERN.matcher(line).find() ? 12 : 0;
        int scheduleBonus = DOSING_SCHEDULE_PATTERN.matcher(line).find() ? 15 : 0;

        return alphaRatio * 52
            + readableTokens * 6.8
            + hintBonus
            + medicineBonus
            + prescriptionBonus
            + dosageBonus
            + scheduleBonus
            - symbolRatio * 45
            - noisyTokens * 7.5
            - singleCharTokens * 4.2;
    }

    private boolean isLikelyReadableMedicalLine(String line) {
        if (KNOWN_MEDICINE_PATTERN.matcher(line).find()) {
            return true;
        }
        if (PRESCRIPTION_LINE_PATTERN.matcher(line).find()) {
            return true;
        }
        if (DOSING_SCHEDULE_PATTERN.matcher(line).find()) {
            return true;
        }

        Matcher hintMatcher = MEDICAL_HINT_PATTERN.matcher(line);
        if (hintMatcher.find()) {
            return true;
        }

        int alpha = 0;
        int digits = 0;
        int symbols = 0;
        for (char ch : line.toCharArray()) {
            if (Character.isLetter(ch)) {
                alpha++;
            } else if (Character.isDigit(ch)) {
                digits++;
            } else if (!Character.isWhitespace(ch)) {
                symbols++;
            }
        }

        int length = line.length();
        if (length < 4) {
            return false;
        }

        double alphaRatio = (double) alpha / length;
        double symbolRatio = (double) symbols / length;

        int words = line.split("\\s+").length;
        return words >= 2 && alphaRatio >= 0.45 && symbolRatio <= 0.25 && (alpha + digits) >= 4;
    }

    /**
     * Smart medicine parser that detects prescription patterns: Tab/Cap/Syp + name + dosage.
     * Works with ANY medicine name, not just hardcoded ones.
     */
    private List<Map<String, String>> parseSmartMedicines(String rawText) {
        if (rawText == null || rawText.isBlank()) {
            return Collections.emptyList();
        }

        List<Map<String, String>> medicines = new ArrayList<>();
        Set<String> seenNames = new HashSet<>();
        String[] lines = rawText.split("\\r?\\n");

        for (String line : lines) {
            String value = line.trim();
            if (value.isBlank() || value.length() < 4) {
                continue;
            }

            // Method 1: Match "Tab/Cap/Syp [Name]" pattern
            Matcher prescMatcher = PRESCRIPTION_LINE_PATTERN.matcher(value);
            if (prescMatcher.find()) {
                String name = prescMatcher.group(1).trim();
                name = cleanMedicineName(name);
                if (name.length() >= 2 && !seenNames.contains(name.toLowerCase())) {
                    seenNames.add(name.toLowerCase());
                    medicines.add(buildMedicineMap(name, value));
                    continue;
                }
            }

            // Method 2: Match lines with "Rx" prefix
            Matcher rxMatcher = RX_LINE_PATTERN.matcher(value);
            if (rxMatcher.find()) {
                String rxContent = rxMatcher.group(1).trim();
                // Try to find Tab/Cap within Rx line
                Matcher innerMatcher = PRESCRIPTION_LINE_PATTERN.matcher(rxContent);
                if (innerMatcher.find()) {
                    String name = cleanMedicineName(innerMatcher.group(1).trim());
                    if (name.length() >= 2 && !seenNames.contains(name.toLowerCase())) {
                        seenNames.add(name.toLowerCase());
                        medicines.add(buildMedicineMap(name, value));
                    }
                }
                continue;
            }

            // Method 3: Line has known medicine name
            Matcher knownMatcher = KNOWN_MEDICINE_PATTERN.matcher(value);
            if (knownMatcher.find()) {
                String name = knownMatcher.group(1).trim();
                if (!seenNames.contains(name.toLowerCase())) {
                    seenNames.add(name.toLowerCase());
                    medicines.add(buildMedicineMap(name, value));
                    continue;
                }
            }

            // Method 4: Line has dosage/schedule pattern without Tab/Cap prefix
            // e.g. "Constiguard - 2 tablespoon in warm water"
            if (DOSING_SCHEDULE_PATTERN.matcher(value).find() || DOSAGE_PATTERN.matcher(value).find()) {
                // Extract first capitalized word as medicine name
                Matcher nameMatcher = Pattern.compile("^\\s*(?:\\d+\\.?\\s*)?([A-Z][a-zA-Z]{2,}(?:\\s+[A-Z][a-zA-Z]+)?)").matcher(value);
                if (nameMatcher.find()) {
                    String name = cleanMedicineName(nameMatcher.group(1).trim());
                    if (name.length() >= 3 && !seenNames.contains(name.toLowerCase()) && !isNonMedicineName(name)) {
                        seenNames.add(name.toLowerCase());
                        medicines.add(buildMedicineMap(name, value));
                    }
                }
            }
        }

        return medicines;
    }

    private Map<String, String> buildMedicineMap(String name, String lineText) {
        Map<String, String> medicine = new HashMap<>();
        medicine.put("name", name);
        medicine.put("dosage", findOrDefault(DOSAGE_PATTERN, lineText, "Not specified"));

        // Try to find frequency
        String frequency = findOrDefault(FREQUENCY_PATTERN, lineText, "");
        if (frequency.isEmpty()) {
            // Check for dosing schedule like "1-0-1"
            Matcher scheduleMatcher = Pattern.compile("(\\d\\s*[-–]\\s*\\d\\s*[-–]\\s*\\d)").matcher(lineText);
            if (scheduleMatcher.find()) {
                frequency = scheduleMatcher.group(1).replaceAll("\\s+", "");
            } else {
                frequency = "As directed";
            }
        }
        medicine.put("frequency", frequency);
        medicine.put("duration", findOrDefault(DURATION_PATTERN, lineText, "As prescribed"));
        medicine.put("raw", lineText);
        return medicine;
    }

    private String cleanMedicineName(String name) {
        // Remove trailing numbers, dosage info, and common suffixes
        name = name.replaceAll("\\s*\\d+\\s*(mg|ml|mcg|gm)?.*$", "").trim();
        name = name.replaceAll("\\s*[-–]\\s*$", "").trim();
        name = name.replaceFirst("(?i)\\s*(forte|plus|sr|xr|er|cr|ds|ls|xt|mr|xl)$", " $1").trim();
        // Capitalize first letter of each word
        if (!name.isEmpty()) {
            String[] words = name.split("\\s+");
            StringBuilder sb = new StringBuilder();
            for (String w : words) {
                if (!w.isEmpty()) {
                    sb.append(Character.toUpperCase(w.charAt(0)));
                    if (w.length() > 1) sb.append(w.substring(1));
                    sb.append(" ");
                }
            }
            name = sb.toString().trim();
        }
        return name;
    }

    private boolean isNonMedicineName(String name) {
        String lower = name.toLowerCase();
        // Common non-medicine words that appear in prescriptions
        Set<String> skip = Set.of("date", "name", "patient", "doctor", "hospital", "age", "sex",
                "address", "phone", "mobile", "email", "consultant", "department",
                "diagnosis", "history", "complaint", "examination", "investigation",
                "follow", "review", "next", "visit", "advice", "note", "regd",
                "plot", "road", "street", "colony", "garden", "after", "before",
                "morning", "evening", "night", "daily", "weekly", "monthly",
                "mowry", "moth", "serna", "toss", "wish", "ging", "counsell");
        return skip.contains(lower) || lower.length() < 2;
    }

    /**
     * Fallback: parse medicines by known name matching (original method).
     */
    private List<Map<String, String>> parseMedicinesByKnownNames(String rawText) {
        if (rawText == null || rawText.isBlank()) {
            return Collections.emptyList();
        }

        List<Map<String, String>> medicines = new ArrayList<>();
        String[] lines = rawText.split("\\r?\\n");

        for (String line : lines) {
            String value = line.trim();
            if (value.isBlank()) {
                continue;
            }

            Matcher medicineMatcher = KNOWN_MEDICINE_PATTERN.matcher(value);
            if (!medicineMatcher.find()) {
                continue;
            }

            Map<String, String> medicine = new HashMap<>();
            medicine.put("name", medicineMatcher.group(1).toUpperCase());
            medicine.put("dosage", findOrDefault(DOSAGE_PATTERN, value, "Not specified"));
            medicine.put("frequency", findOrDefault(FREQUENCY_PATTERN, value, "As directed"));
            medicine.put("duration", findOrDefault(DURATION_PATTERN, value, "As prescribed"));
            medicine.put("raw", value);
            medicines.add(medicine);
        }

        return medicines;
    }

    private String findOrDefault(Pattern pattern, String input, String fallback) {
        Matcher matcher = pattern.matcher(input);
        return matcher.find() ? matcher.group(1) : fallback;
    }

    private Map<String, Object> buildRiskScore(List<Map<String, String>> medicines) {
        int score = 100;
        List<Map<String, String>> risks = new ArrayList<>();

        if (medicines.isEmpty()) {
            score = 40;
            risks.add(risk("High", "No medicine lines confidently detected from OCR."));
            return riskResponse(score, risks);
        }

        Map<String, Integer> counts = new HashMap<>();
        Set<String> normalizedNames = new HashSet<>();

        for (Map<String, String> medicine : medicines) {
            String normalizedName = normalizeName(medicine.get("name"));
            counts.put(normalizedName, counts.getOrDefault(normalizedName, 0) + 1);
            normalizedNames.add(normalizedName);

            int dosageMg = extractDosageMg(medicine.get("dosage"));
            if (dosageMg > 650) {
                score -= 14;
                risks.add(risk("High", "High dosage detected for " + medicine.get("name") + ": " + dosageMg + "mg."));
            }
        }

        for (Map.Entry<String, Integer> entry : counts.entrySet()) {
            if (entry.getValue() > 1) {
                score -= 12;
                risks.add(risk("Medium", "Duplicate ingredient risk: " + entry.getKey() + " appears " + entry.getValue() + " times."));
            }
        }

        for (List<String> interactionRule : INTERACTION_RULES) {
            String first = interactionRule.get(0);
            String second = interactionRule.get(1);
            if (normalizedNames.contains(first) && normalizedNames.contains(second)) {
                score -= 15;
                risks.add(risk("Medium", "Possible interaction between " + first + " and " + second + "."));
            }
        }

        score = Math.max(0, Math.min(100, score));
        if (risks.isEmpty()) {
            risks.add(risk("Low", "No major safety risk patterns detected in basic checks."));
        }

        return riskResponse(score, risks);
    }

    private Map<String, String> risk(String severity, String message) {
        Map<String, String> item = new HashMap<>();
        item.put("severity", severity);
        item.put("message", message);
        return item;
    }

    private Map<String, Object> riskResponse(int score, List<Map<String, String>> risks) {
        String level;
        String indicator;
        if (score >= 80) {
            level = "Safe";
            indicator = "green";
        } else if (score >= 55) {
            level = "Moderate risk";
            indicator = "yellow";
        } else {
            level = "High risk";
            indicator = "red";
        }

        Map<String, Object> riskScore = new HashMap<>();
        riskScore.put("score", score);
        riskScore.put("level", level);
        riskScore.put("indicator", indicator);

        Map<String, Object> response = new HashMap<>();
        response.put("riskScore", riskScore);
        response.put("risks", risks);
        return response;
    }

    private int extractDosageMg(String dosage) {
        if (dosage == null) {
            return 0;
        }

        Matcher matcher = Pattern.compile("(\\d+)\\s?mg", Pattern.CASE_INSENSITIVE).matcher(dosage);
        if (!matcher.find()) {
            return 0;
        }

        try {
            return Integer.parseInt(matcher.group(1));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private List<Map<String, String>> buildMedicineExplanations(List<Map<String, String>> medicines) {
        List<Map<String, String>> explanations = new ArrayList<>();

        for (Map<String, String> medicine : medicines) {
            String name = medicine.getOrDefault("name", "UNKNOWN");

            Map<String, String> meta = lookupMedicineInfo(name);
            Map<String, String> explanation = new LinkedHashMap<>();
            explanation.put("name", name);
            explanation.put("usedFor", meta.get("usedFor"));
            explanation.put("commonSideEffects", meta.get("commonSideEffects"));
            explanation.put("avoidWith", meta.get("avoidWith"));
            explanations.add(explanation);
        }

        return explanations;
    }

    private List<Map<String, String>> buildScheduleTimeline(List<Map<String, String>> medicines) {
        List<Map<String, String>> timeline = new ArrayList<>();

        for (Map<String, String> medicine : medicines) {
            String name = medicine.getOrDefault("name", "UNKNOWN");
            String dosage = medicine.getOrDefault("dosage", "Not specified");
            String frequency = medicine.getOrDefault("frequency", "As directed");

            for (String slot : inferSlots(frequency + " " + dosage)) {
                Map<String, String> item = new HashMap<>();
                item.put("slot", slot);
                item.put("time", slotToTime(slot));
                item.put("medicine", name);
                item.put("dosage", dosage);
                timeline.add(item);
            }
        }

        timeline.sort(Comparator.comparingInt(item -> slotOrder(item.get("slot"))));
        return timeline;
    }

    private List<String> inferSlots(String text) {
        String value = text == null ? "" : text.toLowerCase();

        if (value.contains("tds") || value.contains("thrice")) {
            return List.of("Morning", "Afternoon", "Night");
        }

        if (value.contains("bd") || value.contains("twice")) {
            return List.of("Morning", "Night");
        }

        // Handle Indian-style "1-0-1", "1-1-1", "0-0-1" schedules
        java.util.regex.Matcher scheduleMatcher = Pattern.compile("(\\d)\\s*[-–]\\s*(\\d)\\s*[-–]\\s*(\\d)").matcher(value);
        if (scheduleMatcher.find()) {
            List<String> slots = new ArrayList<>();
            if (!"0".equals(scheduleMatcher.group(1))) slots.add("Morning");
            if (!"0".equals(scheduleMatcher.group(2))) slots.add("Afternoon");
            if (!"0".equals(scheduleMatcher.group(3))) slots.add("Night");
            if (!slots.isEmpty()) return slots;
        }

        List<String> slots = new ArrayList<>();
        if (value.contains("morning") || value.contains("od") || value.contains("daily")) {
            slots.add("Morning");
        }
        if (value.contains("afternoon")) {
            slots.add("Afternoon");
        }
        if (value.contains("evening") || value.contains("night") || value.contains("h.s") || value.contains("hs")) {
            slots.add("Night");
        }

        if (slots.isEmpty()) {
            slots.add("Morning");
        }

        return slots;
    }

    private String slotToTime(String slot) {
        if ("Morning".equals(slot)) return "08:00";
        if ("Afternoon".equals(slot)) return "14:00";
        return "22:00";
    }

    private int slotOrder(String slot) {
        if ("Morning".equals(slot)) return 1;
        if ("Afternoon".equals(slot)) return 2;
        return 3;
    }

    private String normalizeName(String value) {
        if (value == null) {
            return "";
        }

        return value.toLowerCase().replaceAll("[^a-z0-9]", "").trim();
    }

    private Map<String, String> lookupMedicineInfo(String rawName) {
        if (rawName == null || rawName.isBlank()) return defaultInfo();

        // Try exact normalized match first
        String normalized = normalizeName(rawName);
        if (MEDICINE_INFO.containsKey(normalized)) {
            return MEDICINE_INFO.get(normalized);
        }

        // Split on parentheses, slashes, hyphens, commas — try each token
        String[] tokens = rawName.toLowerCase().split("[()\\[\\]/,\\-–—+&]+");
        for (String token : tokens) {
            String clean = token.replaceAll("[^a-z0-9]", "").trim();
            if (!clean.isEmpty() && MEDICINE_INFO.containsKey(clean)) {
                return MEDICINE_INFO.get(clean);
            }
        }

        // Try partial: check if any known key is contained in the normalized name
        for (Map.Entry<String, Map<String, String>> entry : MEDICINE_INFO.entrySet()) {
            if (entry.getKey().length() >= 4 && normalized.contains(entry.getKey())) {
                return entry.getValue();
            }
        }

        return defaultInfo();
    }

    private static Map<String, Map<String, String>> createMedicineInfo() {
        Map<String, Map<String, String>> info = new HashMap<>();

        info.put("amoxicillin", medicineInfo("Bacterial infections", "Nausea, diarrhea", "Unnecessary antibiotic overlap"));
        info.put("amoxyclav", medicineInfo("Bacterial infections", "Nausea, loose motions", "Unnecessary antibiotic overlap"));
        info.put("paracetamol", medicineInfo("Fever and pain", "Nausea, mild rash", "Alcohol and overdose combinations"));
        info.put("dolo", medicineInfo("Fever and pain", "Nausea, mild rash", "Alcohol and overdose combinations"));
        info.put("calpol", medicineInfo("Fever and pain", "Nausea, mild rash", "Alcohol and overdose combinations"));
        info.put("crocin", medicineInfo("Fever and pain", "Nausea, mild rash", "Alcohol and overdose combinations"));
        info.put("ibuprofen", medicineInfo("Pain and inflammation", "Acidity, stomach upset", "Ulcer history and kidney disease"));
        info.put("azithromycin", medicineInfo("Bacterial infections", "Loose stools, nausea", "Unnecessary antibiotic overlap"));
        info.put("cetirizine", medicineInfo("Allergy symptoms", "Sleepiness, dry mouth", "Sedatives and alcohol"));
        info.put("cetzine", medicineInfo("Allergy symptoms", "Sleepiness, dry mouth", "Sedatives and alcohol"));
        info.put("pantoprazole", medicineInfo("Acidity and reflux", "Headache, bloating", "Long-term unsupervised use"));
        info.put("pantocid", medicineInfo("Acidity and reflux", "Headache, bloating", "Long-term unsupervised use"));
        info.put("metformin", medicineInfo("Type 2 diabetes", "Nausea, stomach upset", "Heavy alcohol intake"));
        info.put("atorvastatin", medicineInfo("High cholesterol", "Muscle ache, nausea", "Grapefruit juice excess"));
        info.put("omeprazole", medicineInfo("Acidity and reflux", "Headache, abdominal discomfort", "Long-term unsupervised use"));
        info.put("aspirin", medicineInfo("Blood thinning and heart protection", "Acidity, easy bruising", "Bleeding risk with unsupervised use"));
        info.put("lisinopril", medicineInfo("Blood pressure control", "Dry cough, dizziness", "Potassium supplements without advice"));

        // Benzodiazepines & anxiolytics
        info.put("lorazepam", medicineInfo("Anxiety and panic disorders", "Drowsiness, dizziness, weakness", "Alcohol, opioids, driving"));
        info.put("ativan", medicineInfo("Anxiety and panic disorders", "Drowsiness, dizziness, weakness", "Alcohol, opioids, driving"));
        info.put("clonazepam", medicineInfo("Seizures, panic disorder, anxiety", "Drowsiness, coordination problems, fatigue", "Alcohol, sedatives, abrupt discontinuation"));
        info.put("rivotril", medicineInfo("Seizures, panic disorder, anxiety", "Drowsiness, coordination problems, fatigue", "Alcohol, sedatives, abrupt discontinuation"));
        info.put("diazepam", medicineInfo("Anxiety, muscle spasms, seizures", "Drowsiness, fatigue, muscle weakness", "Alcohol, opioids, driving"));
        info.put("valium", medicineInfo("Anxiety, muscle spasms, seizures", "Drowsiness, fatigue, muscle weakness", "Alcohol, opioids, driving"));
        info.put("alprazolam", medicineInfo("Anxiety and panic attacks", "Drowsiness, lightheadedness, memory issues", "Alcohol, opioids, abrupt stopping"));
        info.put("xanax", medicineInfo("Anxiety and panic attacks", "Drowsiness, lightheadedness, memory issues", "Alcohol, opioids, abrupt stopping"));

        // Antidepressants
        info.put("sertraline", medicineInfo("Depression, anxiety, OCD", "Nausea, insomnia, dizziness, dry mouth", "MAO inhibitors, abrupt discontinuation"));
        info.put("serta", medicineInfo("Depression, anxiety, OCD", "Nausea, insomnia, dizziness, dry mouth", "MAO inhibitors, abrupt discontinuation"));
        info.put("zoloft", medicineInfo("Depression, anxiety, OCD", "Nausea, insomnia, dizziness, dry mouth", "MAO inhibitors, abrupt discontinuation"));
        info.put("fluoxetine", medicineInfo("Depression, anxiety, OCD", "Nausea, headache, insomnia", "MAO inhibitors, alcohol"));
        info.put("prozac", medicineInfo("Depression, anxiety, OCD", "Nausea, headache, insomnia", "MAO inhibitors, alcohol"));
        info.put("escitalopram", medicineInfo("Depression and generalized anxiety", "Nausea, insomnia, sexual dysfunction", "MAO inhibitors, abrupt stopping"));
        info.put("cipralex", medicineInfo("Depression and generalized anxiety", "Nausea, insomnia, sexual dysfunction", "MAO inhibitors, abrupt stopping"));
        info.put("amitriptyline", medicineInfo("Depression, nerve pain, migraine prevention", "Drowsiness, dry mouth, weight gain", "Alcohol, MAO inhibitors"));
        info.put("venlafaxine", medicineInfo("Depression, anxiety, panic disorder", "Nausea, dizziness, sweating, insomnia", "MAO inhibitors, abrupt discontinuation"));
        info.put("duloxetine", medicineInfo("Depression, anxiety, nerve pain", "Nausea, dry mouth, drowsiness", "MAO inhibitors, liver disease"));
        info.put("mirtazapine", medicineInfo("Depression", "Drowsiness, weight gain, dry mouth", "Alcohol, MAO inhibitors"));

        // Antipsychotics
        info.put("olanzapine", medicineInfo("Schizophrenia, bipolar disorder", "Weight gain, drowsiness, dizziness", "Alcohol, driving initially"));
        info.put("risperidone", medicineInfo("Schizophrenia, bipolar disorder", "Weight gain, drowsiness, restlessness", "Alcohol, driving initially"));
        info.put("quetiapine", medicineInfo("Schizophrenia, bipolar disorder, depression", "Drowsiness, weight gain, dry mouth", "Alcohol, abrupt discontinuation"));
        info.put("aripiprazole", medicineInfo("Schizophrenia, bipolar disorder", "Restlessness, insomnia, nausea", "Alcohol, driving initially"));
        info.put("haloperidol", medicineInfo("Psychosis, severe agitation", "Muscle stiffness, tremors, restlessness", "Alcohol, CNS depressants"));

        // Anticholinergics / Parkinson's
        info.put("trihexyphenidyl", medicineInfo("Parkinson's disease, drug-induced movement disorders", "Dry mouth, blurred vision, constipation", "Glaucoma, urinary retention, heat exposure"));
        info.put("pacitane", medicineInfo("Parkinson's disease, drug-induced movement disorders", "Dry mouth, blurred vision, constipation", "Glaucoma, urinary retention, heat exposure"));
        info.put("levodopa", medicineInfo("Parkinson's disease", "Nausea, dizziness, involuntary movements", "MAO inhibitors without supervision"));
        info.put("carbidopa", medicineInfo("Parkinson's disease (with levodopa)", "Nausea, dizziness, headache", "MAO inhibitors without supervision"));

        // Mood stabilizers / Anticonvulsants
        info.put("lithium", medicineInfo("Bipolar disorder", "Tremor, thirst, frequent urination, nausea", "Dehydration, NSAIDs without monitoring"));
        info.put("valproate", medicineInfo("Epilepsy, bipolar disorder, migraine prevention", "Nausea, weight gain, tremor, hair loss", "Pregnancy, liver disease"));
        info.put("valproicacid", medicineInfo("Epilepsy, bipolar disorder, migraine prevention", "Nausea, weight gain, tremor, hair loss", "Pregnancy, liver disease"));
        info.put("depakote", medicineInfo("Epilepsy, bipolar disorder, migraine prevention", "Nausea, weight gain, tremor, hair loss", "Pregnancy, liver disease"));
        info.put("carbamazepine", medicineInfo("Epilepsy, nerve pain, bipolar disorder", "Dizziness, drowsiness, nausea", "MAO inhibitors, pregnancy"));
        info.put("tegretol", medicineInfo("Epilepsy, nerve pain, bipolar disorder", "Dizziness, drowsiness, nausea", "MAO inhibitors, pregnancy"));
        info.put("lamotrigine", medicineInfo("Epilepsy, bipolar disorder", "Headache, dizziness, rash", "Abrupt discontinuation, rash requires immediate doctor visit"));
        info.put("gabapentin", medicineInfo("Nerve pain, epilepsy", "Dizziness, drowsiness, fatigue", "Alcohol, driving initially"));
        info.put("pregabalin", medicineInfo("Nerve pain, anxiety, epilepsy", "Dizziness, drowsiness, weight gain", "Alcohol, driving initially"));
        info.put("lyrica", medicineInfo("Nerve pain, anxiety, epilepsy", "Dizziness, drowsiness, weight gain", "Alcohol, driving initially"));

        // Pain / NSAIDs
        info.put("diclofenac", medicineInfo("Pain and inflammation", "Stomach upset, nausea, dizziness", "Ulcer history, kidney disease, long-term use"));
        info.put("naproxen", medicineInfo("Pain, inflammation, arthritis", "Stomach upset, headache, dizziness", "Ulcer history, kidney disease"));
        info.put("tramadol", medicineInfo("Moderate to severe pain", "Nausea, dizziness, constipation, drowsiness", "Alcohol, seizure history, MAO inhibitors"));
        info.put("codeine", medicineInfo("Mild to moderate pain, cough", "Drowsiness, constipation, nausea", "Alcohol, driving, children under 12"));
        info.put("morphine", medicineInfo("Severe pain", "Drowsiness, constipation, nausea, respiratory depression", "Alcohol, driving, unsupervised use"));
        info.put("aceclofenac", medicineInfo("Pain and inflammation", "Stomach upset, nausea, dizziness", "Ulcer history, kidney disease"));
        info.put("piroxicam", medicineInfo("Arthritis, pain, inflammation", "Stomach upset, dizziness", "Ulcer history, kidney disease"));
        info.put("etoricoxib", medicineInfo("Pain, arthritis, gout", "Headache, swelling, high BP", "Heart disease, ulcers"));

        // Antibiotics
        info.put("ciprofloxacin", medicineInfo("Bacterial infections (UTI, respiratory)", "Nausea, diarrhea, dizziness", "Tendon problems, antacids with the dose"));
        info.put("levofloxacin", medicineInfo("Bacterial infections", "Nausea, diarrhea, headache", "Tendon problems, sun exposure"));
        info.put("doxycycline", medicineInfo("Bacterial and acne infections", "Nausea, sun sensitivity, esophageal irritation", "Antacids, dairy near dose time, sun exposure"));
        info.put("metronidazole", medicineInfo("Bacterial and parasitic infections", "Nausea, metallic taste, headache", "Alcohol (causes severe reaction)"));
        info.put("flagyl", medicineInfo("Bacterial and parasitic infections", "Nausea, metallic taste, headache", "Alcohol (causes severe reaction)"));
        info.put("cephalexin", medicineInfo("Bacterial infections", "Nausea, diarrhea, stomach pain", "Unnecessary antibiotic overlap"));
        info.put("cefixime", medicineInfo("Bacterial infections", "Diarrhea, nausea, stomach pain", "Unnecessary antibiotic overlap"));
        info.put("clindamycin", medicineInfo("Bacterial and skin infections", "Diarrhea, nausea, abdominal pain", "Colitis history"));

        // Cardiovascular
        info.put("amlodipine", medicineInfo("High blood pressure, angina", "Swelling in ankles, dizziness, flushing", "Grapefruit juice excess"));
        info.put("losartan", medicineInfo("High blood pressure, kidney protection", "Dizziness, fatigue, hyperkalemia", "Pregnancy, potassium supplements"));
        info.put("telmisartan", medicineInfo("High blood pressure", "Dizziness, back pain, diarrhea", "Pregnancy, potassium supplements"));
        info.put("metoprolol", medicineInfo("High blood pressure, heart rate control", "Fatigue, dizziness, cold extremities", "Abrupt discontinuation, asthma"));
        info.put("atenolol", medicineInfo("High blood pressure, angina", "Fatigue, dizziness, cold hands/feet", "Abrupt stopping, asthma"));
        info.put("propranolol", medicineInfo("High blood pressure, anxiety tremor, migraine", "Fatigue, dizziness, cold extremities", "Abrupt stopping, asthma"));
        info.put("ramipril", medicineInfo("High blood pressure, heart protection", "Dry cough, dizziness, fatigue", "Pregnancy, potassium supplements"));
        info.put("enalapril", medicineInfo("High blood pressure, heart failure", "Dry cough, dizziness, headache", "Pregnancy, potassium supplements"));
        info.put("clopidogrel", medicineInfo("Blood clot prevention", "Bleeding, bruising, stomach upset", "Active bleeding, surgery without doctor advice"));
        info.put("warfarin", medicineInfo("Blood clot prevention", "Bleeding, bruising", "Alcohol, inconsistent vitamin K intake, surgery"));
        info.put("furosemide", medicineInfo("Fluid retention, heart failure, high BP", "Frequent urination, dizziness, dehydration", "Dehydration, electrolyte imbalance"));
        info.put("lasix", medicineInfo("Fluid retention, heart failure, high BP", "Frequent urination, dizziness, dehydration", "Dehydration, electrolyte imbalance"));
        info.put("hydrochlorothiazide", medicineInfo("High blood pressure, fluid retention", "Dizziness, frequent urination, electrolyte loss", "Dehydration, gout"));
        info.put("spironolactone", medicineInfo("Fluid retention, heart failure, high BP", "Hyperkalemia, dizziness, breast tenderness", "Potassium supplements, kidney failure"));
        info.put("digoxin", medicineInfo("Heart failure, atrial fibrillation", "Nausea, dizziness, visual disturbance", "Electrolyte imbalance, toxicity risk"));

        // Diabetes
        info.put("glimepiride", medicineInfo("Type 2 diabetes", "Low blood sugar, weight gain, nausea", "Skipping meals, alcohol"));
        info.put("gliclazide", medicineInfo("Type 2 diabetes", "Low blood sugar, weight gain", "Skipping meals, alcohol"));
        info.put("sitagliptin", medicineInfo("Type 2 diabetes", "Headache, upper respiratory infection", "Kidney impairment without dose adjustment"));
        info.put("januvia", medicineInfo("Type 2 diabetes", "Headache, upper respiratory infection", "Kidney impairment without dose adjustment"));
        info.put("insulin", medicineInfo("Diabetes (Type 1 and Type 2)", "Low blood sugar, weight gain, injection site reaction", "Skipping meals, incorrect dosing"));
        info.put("pioglitazone", medicineInfo("Type 2 diabetes", "Weight gain, fluid retention, bone fractures", "Heart failure, bladder cancer history"));

        // Respiratory / Asthma
        info.put("salbutamol", medicineInfo("Asthma, bronchospasm relief", "Tremor, palpitations, headache", "Overuse without controller inhaler"));
        info.put("montelukast", medicineInfo("Asthma, allergic rhinitis", "Headache, stomach pain, mood changes", "Replacing rescue inhaler"));
        info.put("budesonide", medicineInfo("Asthma, inflammatory bowel disease", "Oral thrush, hoarse voice, headache", "Abrupt stopping of long-term use"));
        info.put("theophylline", medicineInfo("Asthma, COPD", "Nausea, headache, insomnia, palpitations", "Caffeine excess, smoking changes"));

        // GI / Stomach
        info.put("ranitidine", medicineInfo("Acidity, ulcers", "Headache, constipation", "Long-term unsupervised use"));
        info.put("domperidone", medicineInfo("Nausea, vomiting, bloating", "Dry mouth, headache", "Heart rhythm disorders"));
        info.put("ondansetron", medicineInfo("Nausea and vomiting", "Headache, constipation, dizziness", "Heart rhythm disorders at high doses"));
        info.put("sucralfate", medicineInfo("Stomach ulcers", "Constipation, dry mouth", "Taking with other medicines (space by 2 hrs)"));
        info.put("loperamide", medicineInfo("Diarrhea", "Constipation, dizziness, nausea", "Bacterial diarrhea, children under 2"));
        info.put("bisacodyl", medicineInfo("Constipation", "Stomach cramps, diarrhea", "Long-term daily use"));
        info.put("lactulose", medicineInfo("Constipation, liver disease", "Bloating, gas, stomach cramps", "Diabetics without monitoring"));

        // Thyroid
        info.put("levothyroxine", medicineInfo("Hypothyroidism", "Weight changes, palpitations, insomnia", "Taking with calcium/iron (space by 4 hrs)"));
        info.put("thyronorm", medicineInfo("Hypothyroidism", "Weight changes, palpitations, insomnia", "Taking with calcium/iron (space by 4 hrs)"));
        info.put("eltroxin", medicineInfo("Hypothyroidism", "Weight changes, palpitations, insomnia", "Taking with calcium/iron (space by 4 hrs)"));

        // Steroids
        info.put("prednisolone", medicineInfo("Inflammation, allergies, autoimmune conditions", "Weight gain, mood changes, high blood sugar", "Abrupt stopping, infections"));
        info.put("prednisone", medicineInfo("Inflammation, allergies, autoimmune conditions", "Weight gain, mood changes, high blood sugar", "Abrupt stopping, infections"));
        info.put("dexamethasone", medicineInfo("Severe inflammation, allergies, nausea", "Insomnia, mood changes, high blood sugar", "Infections, abrupt stopping"));
        info.put("hydrocortisone", medicineInfo("Adrenal insufficiency, inflammation", "Weight gain, fluid retention, high blood sugar", "Infections, abrupt stopping"));
        info.put("methylprednisolone", medicineInfo("Inflammation, allergies", "Stomach upset, mood changes, insomnia", "Infections, live vaccines"));

        // Vitamins / Supplements
        info.put("calciumcarbonate", medicineInfo("Calcium deficiency, bone health", "Constipation, bloating", "Taking with iron or thyroid meds at same time"));
        info.put("shelcal", medicineInfo("Calcium and vitamin D supplement", "Constipation, bloating", "Taking with iron or thyroid meds at same time"));
        info.put("vitaminb12", medicineInfo("B12 deficiency, nerve health", "Generally well-tolerated", "Masking B12 deficiency with folic acid alone"));
        info.put("methylcobalamin", medicineInfo("Nerve pain, B12 deficiency", "Generally well-tolerated", "None significant"));
        info.put("ferroussulfate", medicineInfo("Iron deficiency anemia", "Constipation, dark stools, nausea", "Tea/coffee near dose, antacids"));
        info.put("folicacid", medicineInfo("Folate deficiency, pregnancy support", "Generally well-tolerated", "Masking B12 deficiency"));
        info.put("cholecalciferol", medicineInfo("Vitamin D deficiency", "Generally well-tolerated in normal doses", "Excess dosing without monitoring"));
        info.put("vitamind3", medicineInfo("Vitamin D deficiency", "Generally well-tolerated in normal doses", "Excess dosing without monitoring"));

        // Muscle relaxants
        info.put("chlorzoxazone", medicineInfo("Muscle spasm and pain", "Drowsiness, dizziness, nausea", "Alcohol, liver disease"));
        info.put("tizanidine", medicineInfo("Muscle spasticity", "Drowsiness, dry mouth, dizziness", "Alcohol, fluvoxamine, ciprofloxacin"));
        info.put("cyclobenzaprine", medicineInfo("Muscle spasms", "Drowsiness, dry mouth, dizziness", "MAO inhibitors, heart disease"));
        info.put("baclofen", medicineInfo("Muscle spasticity", "Drowsiness, weakness, dizziness", "Abrupt discontinuation, alcohol"));

        // Antihistamines
        info.put("levocetirizine", medicineInfo("Allergies, hay fever, hives", "Drowsiness, dry mouth, fatigue", "Alcohol, driving initially"));
        info.put("fexofenadine", medicineInfo("Allergies, hay fever, hives", "Headache, nausea", "Fruit juice near dose (reduces absorption)"));
        info.put("allegra", medicineInfo("Allergies, hay fever, hives", "Headache, nausea", "Fruit juice near dose (reduces absorption)"));
        info.put("chlorpheniramine", medicineInfo("Allergies, cold symptoms", "Drowsiness, dry mouth, dizziness", "Alcohol, driving, sedatives"));
        info.put("diphenhydramine", medicineInfo("Allergies, insomnia, cold symptoms", "Drowsiness, dry mouth, dizziness", "Alcohol, driving, children under 2"));
        info.put("benadryl", medicineInfo("Allergies, insomnia, cold symptoms", "Drowsiness, dry mouth, dizziness", "Alcohol, driving, children under 2"));
        info.put("hydroxyzine", medicineInfo("Anxiety, allergies, itching", "Drowsiness, dry mouth, dizziness", "Alcohol, driving, CNS depressants"));

        // Sleep
        info.put("zolpidem", medicineInfo("Insomnia", "Drowsiness, dizziness, headache", "Alcohol, driving, long-term use"));
        info.put("zopiclone", medicineInfo("Insomnia", "Metallic taste, drowsiness, dry mouth", "Alcohol, driving, long-term use"));
        info.put("melatonin", medicineInfo("Sleep regulation", "Drowsiness, headache", "Driving immediately after"));

        // Antifungal
        info.put("fluconazole", medicineInfo("Fungal infections", "Nausea, headache, abdominal pain", "Liver disease, certain heart medications"));
        info.put("itraconazole", medicineInfo("Fungal infections", "Nausea, headache, rash", "Heart failure, liver disease"));
        info.put("clotrimazole", medicineInfo("Skin and vaginal fungal infections", "Skin irritation, burning sensation", "Eye contact"));
        info.put("terbinafine", medicineInfo("Fungal skin and nail infections", "Headache, stomach upset, taste disturbance", "Liver disease"));

        return info;
    }

    private static Map<String, String> medicineInfo(String usedFor, String sideEffects, String avoidWith) {
        Map<String, String> item = new HashMap<>();
        item.put("usedFor", usedFor);
        item.put("commonSideEffects", sideEffects);
        item.put("avoidWith", avoidWith);
        return item;
    }

    private Map<String, String> defaultInfo() {
        return medicineInfo(
                "Prescription medicine based on doctor guidance",
                "May include nausea or mild dizziness",
                "Self-medication, alcohol, or duplicate brands"
        );
    }
}
