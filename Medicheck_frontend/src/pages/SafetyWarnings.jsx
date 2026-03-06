function normalizeName(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function getWarnings(medicines = []) {
  const warnings = [];
  const seen = {};

  medicines.forEach((med) => {
    const key = normalizeName(med.name);
    seen[key] = (seen[key] || 0) + 1;

    const mg = Number((med.dosage || "").match(/(\d+)\s?mg/i)?.[1] || 0);
    if (mg > 650) {
      warnings.push({
        severity: "High",
        message: `High dosage warning for ${med.name}: ${mg}mg`,
      });
    }
  });

  Object.entries(seen).forEach(([name, count]) => {
    if (count > 1) {
      warnings.push({
        severity: "Medium",
        message: `Duplicate medicine risk: ${name} appears ${count} times`,
      });
    }
  });

  if (warnings.length === 0) {
    warnings.push({ severity: "Low", message: "No major safety warnings detected." });
  }

  return warnings;
}

export default function SafetyWarnings() {
  const extracted = JSON.parse(localStorage.getItem("extractedText")) || [];
  const active = extracted[0] || {};
  const warnings = getWarnings(active.medicines || []);

  return (
    <div className="feature-page">
      <h1 className="feature-title">Safety Warnings</h1>
      <p className="feature-subtitle">Grouped safety alerts with severity badges</p>

      <div className="feature-list">
        {warnings.map((warning, index) => (
          <div className="feature-row" key={index}>
            <span className={`severity-badge ${warning.severity.toLowerCase()}`}>{warning.severity}</span>
            <p className="feature-row-title">{warning.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
