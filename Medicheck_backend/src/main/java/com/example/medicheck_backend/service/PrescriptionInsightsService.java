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

    private static final Pattern MEDICINE_PATTERN = Pattern.compile(
            "(paracetamol|dolo|crocin|calpol|ibuprofen|amoxicillin|amoxyclav|azithromycin|cetirizine|cetzine|pantoprazole|pantocid|metformin|atorvastatin|omeprazole|aspirin|lisinopril)",
            Pattern.CASE_INSENSITIVE
    );

    private static final Pattern DOSAGE_PATTERN = Pattern.compile("(\\d{2,4}\\s?(mg|ml))", Pattern.CASE_INSENSITIVE);
    private static final Pattern FREQUENCY_PATTERN = Pattern.compile(
            "(once|twice|thrice|daily|morning|afternoon|evening|night|od|bd|tds)",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern DURATION_PATTERN = Pattern.compile(
            "(\\d+\\s?(day|days|week|weeks|month|months))",
            Pattern.CASE_INSENSITIVE
    );
        private static final Pattern MEDICAL_HINT_PATTERN = Pattern.compile(
            "(mg|ml|tab|tablet|cap|capsule|od|bd|tds|sos|dr\\.|doctor|hospital|patient|pulse|bp|spo2|temp|rx|reg\\.|name|date)",
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
        List<Map<String, String>> medicines = parseMedicines(cleanedText);
        if (medicines.isEmpty()) {
            medicines = parseMedicines(rawText);
        }
        Map<String, Object> riskData = buildRiskScore(medicines);

        Map<String, Object> response = new HashMap<>();
        response.put("cleanedText", cleanedText);
        response.put("medicines", medicines);
        response.put("riskScore", riskData.get("riskScore"));
        response.put("risks", riskData.get("risks"));
        response.put("medicineExplanations", buildMedicineExplanations(medicines));
        response.put("scheduleTimeline", buildScheduleTimeline(medicines));
        return response;
    }

    public String buildReadableText(String rawText) {
        if (rawText == null || rawText.isBlank()) {
            return "";
        }

        String[] lines = rawText.split("\\r?\\n");
        List<String> cleaned = new ArrayList<>();

        for (String line : lines) {
            String normalized = line == null ? "" : line.replaceAll("\\s+", " ").trim();
            if (normalized.isBlank()) {
                continue;
            }

            if (isLikelyReadableMedicalLine(normalized)) {
                cleaned.add(normalized);
            }
        }

        if (cleaned.isEmpty()) {
            return rawText;
        }

        return String.join("\n", cleaned);
    }

    private boolean isLikelyReadableMedicalLine(String line) {
        Matcher medicineMatcher = MEDICINE_PATTERN.matcher(line);
        if (medicineMatcher.find()) {
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

    private List<Map<String, String>> parseMedicines(String rawText) {
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

            Matcher medicineMatcher = MEDICINE_PATTERN.matcher(value);
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
            String normalized = normalizeName(name);

            Map<String, String> meta = MEDICINE_INFO.getOrDefault(normalized, defaultInfo());
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

        List<String> slots = new ArrayList<>();
        if (value.contains("morning") || value.contains("od") || value.contains("daily")) {
            slots.add("Morning");
        }
        if (value.contains("afternoon")) {
            slots.add("Afternoon");
        }
        if (value.contains("evening") || value.contains("night")) {
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
