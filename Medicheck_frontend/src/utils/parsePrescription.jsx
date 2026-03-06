export function parsePrescriptionText(text) {
  if (!text) return [];

  return text.split("\n").map((line) => {
    const parts = line.trim().split(" ");

    return {
      name: parts[0],
      dosage: parts.slice(1).join(" "),
      status:
        Math.random() > 0.7
          ? "Mismatch"
          : Math.random() > 0.85
          ? "Wrong"
          : "Correct",
    };
  });
}
