function getWarnings(medicines = [], backendRisks = []) {
  const warnings = [];

  // Use backend/AI-provided risk data first
  if (Array.isArray(backendRisks) && backendRisks.length > 0) {
    backendRisks.forEach((r) => {
      if (r.message && !r.message.includes("No major safety")) {
        warnings.push({ severity: r.severity || "Medium", message: r.message });
      }
    });
  }

  // Additional client-side checks
  const seen = {};
  medicines.forEach((med) => {
    const key = (med.name || "").toLowerCase().trim();
    seen[key] = (seen[key] || 0) + 1;

    const mg = Number((med.dosage || "").match(/(\d+)\s?mg/i)?.[1] || 0);
    if (mg > 650) {
      warnings.push({
        severity: "High",
        message: `High dosage warning for ${med.name}: ${mg}mg exceeds typical limits`,
      });
    }
  });

  Object.entries(seen).forEach(([name, count]) => {
    if (count > 1) {
      warnings.push({
        severity: "Medium",
        message: `Duplicate medicine: ${name} appears ${count} times`,
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
  const medicines = active.medicines || [];
  const warnings = getWarnings(medicines, active.risks);
  const riskScore = active.riskScore;

  const severityOrder = { High: 0, Medium: 1, Low: 2 };
  const sorted = [...warnings].sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3));

  return (
    <div className="feature-page">
      <h1 className="feature-title">Safety Warnings</h1>
      <p className="feature-subtitle">AI-analyzed safety alerts for your prescription</p>

      {medicines.length > 0 && riskScore && (
        <div className="feature-card" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
                Risk Score: {riskScore.score ?? "N/A"} / 100
              </p>
              <p style={{ color: "#666", fontSize: "0.9rem" }}>
                {medicines.length} medicine(s) analyzed
              </p>
            </div>
            <span className={`severity-badge ${
              (riskScore.indicator === "red" || riskScore.level === "High risk") ? "high" :
              (riskScore.indicator === "yellow" || riskScore.level === "Moderate risk") ? "medium" : "low"
            }`}>
              {riskScore.level || "Safe"}
            </span>
          </div>
        </div>
      )}

      {active.doctorName && (
        <div className="feature-card" style={{ marginBottom: "1rem" }}>
          <p><strong>Doctor:</strong> {active.doctorName}</p>
          {active.patientName && <p><strong>Patient:</strong> {active.patientName}</p>}
          {active.diagnosis && active.diagnosis !== "Not specified" && (
            <p><strong>Diagnosis:</strong> {active.diagnosis}</p>
          )}
        </div>
      )}

      <div className="feature-list">
        {sorted.map((warning, index) => (
          <div className="feature-row" key={index}>
            <span className={`severity-badge ${warning.severity.toLowerCase()}`}>{warning.severity}</span>
            <p className="feature-row-title">{warning.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
