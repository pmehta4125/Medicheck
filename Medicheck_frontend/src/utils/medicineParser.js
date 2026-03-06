export const parsePrescription = (text) => {
  const medicines = [];
  const lines = text.split("\n").map((l) => l.trim());

  const MEDICINE_PATTERN =
    /(paracetamol|amoxicillin|ibuprofen|dolo|azithromycin|cetirizine|pantoprazole|metformin|atorvastatin|omeprazole)/i;

  const DOSAGE_PATTERN = /(\d{2,4}\s?mg|\d+\s?ml)/i;
  const FREQUENCY_PATTERN = /(once|twice|thrice|daily|morning|night|evening|afternoon|od|bd|tds)/i;
  const DURATION_PATTERN = /(\d+\s?(day|days|week|weeks))/i;

  for (let line of lines) {
    const med = line.match(MEDICINE_PATTERN);
    if (med) {
      medicines.push({
        name: med[0],
        dosage: line.match(DOSAGE_PATTERN)?.[0] || "Not specified",
        frequency: line.match(FREQUENCY_PATTERN)?.[0] || "Not specified",
        duration: line.match(DURATION_PATTERN)?.[0] || "Not specified",
        raw: line,
      });
    }
  }

  return medicines;
};
