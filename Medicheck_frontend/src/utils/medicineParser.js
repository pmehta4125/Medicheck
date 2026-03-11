/**
 * Generic prescription parser - works with ANY medicine names.
 * Parses Gemini structured output or prescription-format text.
 * Does NOT rely on hardcoded medicine lists - trusts AI output.
 */
export const parsePrescription = (text) => {
  const medicines = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const seen = new Set();

  const PIPE_LINE = /^\d+\.\s*(.+?\|.+)/;
  const PREFIX_PATTERN = /(?:tab\.?|cap\.?|syp\.?|inj\.?|tablet|capsule|syrup|injection|cream|ointment|drops|gel|lotion|spray)\s+([A-Za-z][A-Za-z0-9\s\-.]+?)(?:\s*[-\u2013|]|\s*\(|\s+\d|\s*$)/i;
  const RX_PATTERN = /^(?:Rx|R\/?x)\s+(.+)/i;

  const DOSAGE_PATTERN = /(\d{1,4}\s?(?:mg|ml|mcg|gm|g|iu|%))/i;
  const FREQUENCY_PATTERN = /(once|twice|thrice|daily|morning|night|evening|afternoon|od|o\.?d\.?|bd|b\.?d\.?|tds|t\.?d\.?s\.?|hs|sos|qid|prn|before food|after food|before meal|after meal|empty stomach|at bedtime)/i;
  const DURATION_PATTERN = /(\d+\s?(?:day|days|week|weeks|month|months))/i;

  let inMedicinesSection = false;

  for (let line of lines) {
    const upper = line.toUpperCase();

    if (upper.startsWith("MEDICINES:") || upper === "MEDICINES") {
      inMedicinesSection = true;
      continue;
    }
    if (inMedicinesSection && (upper.startsWith("DIAGNOSIS:") || upper.startsWith("ADDITIONAL"))) {
      inMedicinesSection = false;
      continue;
    }

    let name = null;
    let dosage = "Not specified";
    let frequency = "As directed";
    let duration = "As prescribed";
    let instructions = "";

    const pipeMatch = line.match(PIPE_LINE);
    if (pipeMatch) {
      const parts = pipeMatch[1].split("|").map((s) => s.trim());
      if (parts.length >= 1 && parts[0].length >= 2) {
        name = parts[0].replace(/^(?:tab\.?|cap\.?|syp\.?|inj\.?|tablet|capsule|syrup|injection)\s+/i, "").trim();
        dosage = parts[1] || dosage;
        frequency = parts[2] || frequency;
        duration = parts[3] || duration;
        instructions = parts[4] || "";
      }
    }

    if (!name) {
      const prefixMatch = line.match(PREFIX_PATTERN);
      if (prefixMatch) {
        name = prefixMatch[1].trim();
        dosage = line.match(DOSAGE_PATTERN)?.[0] || dosage;
        frequency = line.match(FREQUENCY_PATTERN)?.[0] || frequency;
        duration = line.match(DURATION_PATTERN)?.[0] || duration;
      }
    }

    if (!name) {
      const rxMatch = line.match(RX_PATTERN);
      if (rxMatch) {
        name = rxMatch[1].split(/[-\u2013|]/)[0].trim();
        dosage = line.match(DOSAGE_PATTERN)?.[0] || dosage;
        frequency = line.match(FREQUENCY_PATTERN)?.[0] || frequency;
        duration = line.match(DURATION_PATTERN)?.[0] || duration;
      }
    }

    if (!name && inMedicinesSection && /^\d+\.\s*.+/.test(line)) {
      const cleaned = line.replace(/^\d+\.\s*/, "").trim();
      if (cleaned.length >= 2) {
        name = cleaned.replace(/^(?:tab\.?|cap\.?|syp\.?|inj\.?)\s+/i, "").split(/\s+\d/)[0].trim();
        dosage = line.match(DOSAGE_PATTERN)?.[0] || dosage;
        frequency = line.match(FREQUENCY_PATTERN)?.[0] || frequency;
        duration = line.match(DURATION_PATTERN)?.[0] || duration;
      }
    }

    if (name && name.length >= 2 && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      medicines.push({ name, dosage, frequency, duration, instructions, raw: line });
    }
  }

  return medicines;
};

export const parsePrescriptionInfo = (text) => {
  const info = { doctor: "", patient: "", date: "", diagnosis: "", additionalNotes: "" };
  if (!text) return info;

  const lines = text.split("\n");
  let inNotes = false;
  const notes = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const upper = trimmed.toUpperCase();

    if (upper.startsWith("DOCTOR:") || upper.startsWith("DR:") || upper.startsWith("DR.:")) {
      info.doctor = trimmed.substring(trimmed.indexOf(":") + 1).trim();
      inNotes = false;
    } else if (upper.startsWith("PATIENT:")) {
      info.patient = trimmed.substring(trimmed.indexOf(":") + 1).trim();
      inNotes = false;
    } else if (upper.startsWith("DATE:")) {
      info.date = trimmed.substring(trimmed.indexOf(":") + 1).trim();
      inNotes = false;
    } else if (upper.startsWith("DIAGNOSIS:")) {
      info.diagnosis = trimmed.substring(trimmed.indexOf(":") + 1).trim();
      inNotes = false;
    } else if (upper.startsWith("ADDITIONAL NOTES:") || upper.startsWith("ADDITIONAL:") || upper.startsWith("NOTES:")) {
      const content = trimmed.substring(trimmed.indexOf(":") + 1).trim();
      if (content) notes.push(content);
      inNotes = true;
    } else if (inNotes && trimmed) {
      notes.push(trimmed);
    } else if (upper.startsWith("MEDICINES:")) {
      inNotes = false;
    }
  }

  info.additionalNotes = notes.join("; ");
  return info;
};
