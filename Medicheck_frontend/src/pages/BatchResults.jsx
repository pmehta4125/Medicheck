import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const BRAND_ALIAS_GROUPS = [
  ["paracetamol", "dolo", "calpol", "crocin"],
  ["cetirizine", "cetzine"],
  ["pantoprazole", "pantocid"],
  ["amoxicillin", "amoxyclav"],
];

const KNOWN_MEDICINES = [
  "paracetamol",
  "dolo",
  "crocin",
  "calpol",
  "ibuprofen",
  "amoxicillin",
  "azithromycin",
  "cetirizine",
  "pantoprazole",
  "metformin",
  "atorvastatin",
  "omeprazole",
];

function normalizeName(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function parseChemistInput(inputText) {
  return inputText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart, ...rest] = line.split("-");
      return {
        name: namePart.trim(),
        dosage: rest.join("-").trim() || "Not provided",
      };
    });
}

function extractDuration(text = "") {
  return text.match(/(\d+\s?(day|days|week|weeks|month|months))/i)?.[0] || "As prescribed";
}

function inferTimings(text = "") {
  const value = text.toLowerCase();

  if (value.includes("tds") || value.includes("thrice")) {
    return ["Morning", "Afternoon", "Night"];
  }

  if (value.includes("bd") || value.includes("twice")) {
    return ["Morning", "Night"];
  }

  const timings = [];
  if (value.includes("morning")) timings.push("Morning");
  if (value.includes("afternoon")) timings.push("Afternoon");
  if (value.includes("night") || value.includes("evening")) timings.push("Night");

  return timings.length > 0 ? timings : ["As directed"];
}

function getConfidence(medicine = {}) {
  const rawName = medicine.name || "";
  const normalized = normalizeName(rawName);
  const dosage = medicine.dosage || "";

  let score = 35;

  if (normalized.length >= 5) score += 15;

  const knownMatch = KNOWN_MEDICINES.some(
    (item) => normalized === normalizeName(item) || normalized.includes(normalizeName(item))
  );
  if (knownMatch) score += 35;

  if (/\d+\s?(mg|ml)/i.test(dosage)) score += 10;
  if (/once|twice|thrice|od|bd|tds|morning|night|evening|daily/i.test(dosage)) score += 5;

  const hasMixedCharacters = /[a-z]/i.test(rawName) && /[^a-z\s\-\d]/i.test(rawName);
  if (hasMixedCharacters) score -= 20;

  score = Math.max(0, Math.min(100, score));

  if (score >= 80) return { score, label: "High" };
  if (score >= 55) return { score, label: "Medium" };
  return { score, label: "Low" };
}

export default function BatchResults() {
  const navigate = useNavigate();
  const location = useLocation();

  const getExtracted = () => JSON.parse(localStorage.getItem("extractedText")) || [];
  const getHistory = () => JSON.parse(localStorage.getItem("prescriptionHistory")) || [];

  const [extracted, setExtracted] = useState(getExtracted);
  const [savedHistory, setSavedHistory] = useState(getHistory);
  const [activeResult, setActiveResult] = useState(extracted[0] || null);
  const [editableMedicines, setEditableMedicines] = useState(extracted[0]?.medicines || []);

  // Re-read localStorage whenever we navigate to this page
  useEffect(() => {
    const fresh = getExtracted();
    const freshHistory = getHistory();
    setExtracted(fresh);
    setSavedHistory(freshHistory);
    setActiveResult(fresh[0] || null);
  }, [location.key]);
  const [chemistInput, setChemistInput] = useState("");

  useEffect(() => {
    setEditableMedicines(activeResult?.medicines || []);
  }, [activeResult]);

  const prescribedMedicines = editableMedicines;

  const medicinesWithConfidence = useMemo(
    () =>
      prescribedMedicines.map((med) => ({
        ...med,
        confidence: getConfidence(med),
      })),
    [prescribedMedicines]
  );

  const confidenceSummary = useMemo(() => {
    const summary = { high: 0, medium: 0, low: 0 };

    medicinesWithConfidence.forEach((med) => {
      if (med.confidence.label === "High") summary.high += 1;
      else if (med.confidence.label === "Medium") summary.medium += 1;
      else summary.low += 1;
    });

    return summary;
  }, [medicinesWithConfidence]);

  const dosageSchedule = useMemo(
    () =>
      prescribedMedicines.map((med) => ({
        name: med.name,
        dosage: med.dosage || "Not specified",
        timings: inferTimings(med.dosage),
        duration: extractDuration(med.dosage),
      })),
    [prescribedMedicines]
  );

  const comparison = useMemo(() => {
    const dispensed = parseChemistInput(chemistInput);
    const prescribedMap = new Map(
      prescribedMedicines.map((med) => [normalizeName(med.name), med])
    );

    const matched = [];
    const wrongDosage = [];
    const extra = [];
    const seen = new Set();

    for (const item of dispensed) {
      const key = normalizeName(item.name);
      const prescribed = prescribedMap.get(key);

      if (!prescribed) {
        extra.push(item);
        continue;
      }

      seen.add(key);

      const expectedDose = (prescribed.dosage || "").toLowerCase().trim();
      const givenDose = (item.dosage || "").toLowerCase().trim();

      if (
        !expectedDose ||
        !givenDose ||
        expectedDose === "not specified" ||
        givenDose === "not provided" ||
        expectedDose.includes(givenDose) ||
        givenDose.includes(expectedDose)
      ) {
        matched.push({ ...item, expectedDose: prescribed.dosage || "Not specified" });
      } else {
        wrongDosage.push({
          name: item.name,
          expectedDose: prescribed.dosage || "Not specified",
          givenDose: item.dosage,
        });
      }
    }

    const missing = prescribedMedicines.filter(
      (med) => !seen.has(normalizeName(med.name))
    );

    return { matched, wrongDosage, missing, extra };
  }, [chemistInput, prescribedMedicines]);

  const safetyAlerts = useMemo(() => {
    const alerts = [];
    const counter = {};

    prescribedMedicines.forEach((med) => {
      const key = normalizeName(med.name);
      counter[key] = (counter[key] || 0) + 1;
    });

    Object.entries(counter).forEach(([name, count]) => {
      if (count > 1) {
        alerts.push(`Duplicate medicine detected: ${name} appears ${count} times.`);
      }
    });

    BRAND_ALIAS_GROUPS.forEach((group) => {
      const found = group.filter((alias) =>
        prescribedMedicines.some((med) => normalizeName(med.name).includes(normalizeName(alias)))
      );

      if (found.length > 1) {
        alerts.push(`Possible same-drug brand/generic overlap: ${found.join(", ")}.`);
      }
    });

    prescribedMedicines.forEach((med) => {
      const doseValue = Number((med.dosage || "").match(/(\d+)\s?mg/i)?.[1] || 0);
      if (doseValue > 650) {
        alerts.push(`High dosage flag for ${med.name}: ${doseValue}mg.`);
      }
    });

    return alerts;
  }, [prescribedMedicines]);

  const openFromHistory = (entry) => {
    setActiveResult(entry);
    localStorage.setItem("extractedText", JSON.stringify([entry]));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateMedicineField = (index, field, value) => {
    setEditableMedicines((prev) =>
      prev.map((med, i) => (i === index ? { ...med, [field]: value } : med))
    );
  };

  return (
    <div className="results-container">
      <h1 className="results-title">Prescription Analysis Results</h1>

      {!activeResult ? (
        <p className="no-data">No data found.</p>
      ) : (
        <>
          <div className="result-card timeline-card">
            <h2 className="result-heading">Prescription Status</h2>
            <div className="status-timeline">
              <span className="timeline-step done">Uploaded</span>
              <span className="timeline-sep">→</span>
              <span className="timeline-step done">Processing</span>
              <span className="timeline-sep">→</span>
              <span className="timeline-step active">Verified</span>
            </div>
            <div className="result-actions">
              <button className="secondary-btn" onClick={() => navigate("/upload")}>Re-upload</button>
              <button className="secondary-btn" onClick={() => window.print()}>Download / Share Report</button>
            </div>
          </div>

          <div className="result-card">
            <h2 className="result-heading">Detected Medicines</h2>
            {medicinesWithConfidence.length > 0 ? (
              <>
                <div className="confidence-summary">
                  <span className="confidence-chip high">High: {confidenceSummary.high}</span>
                  <span className="confidence-chip medium">Medium: {confidenceSummary.medium}</span>
                  <span className="confidence-chip low">Needs Review: {confidenceSummary.low}</span>
                </div>

              <ul className="medicine-list">
                {medicinesWithConfidence.map((med, i) => (
                  <li key={`${med.name}-${i}`} className="medicine-item">
                    <div className="med-main-row">
                      <span className="med-name">{med.name}</span>
                      <span className={`confidence-badge ${med.confidence.label.toLowerCase()}`}>
                        {med.confidence.label} ({med.confidence.score})
                      </span>
                    </div>

                    <span className="med-dose">Dose: {med.dosage || "Not specified"}</span>

                    {med.confidence.label === "Low" && (
                      <div className="review-edit-wrap">
                        <p className="review-text">Needs review: update medicine and dose</p>
                        <input
                          className="review-input"
                          value={med.name || ""}
                          onChange={(e) => updateMedicineField(i, "name", e.target.value)}
                          placeholder="Correct medicine name"
                        />
                        <input
                          className="review-input"
                          value={med.dosage || ""}
                          onChange={(e) => updateMedicineField(i, "dosage", e.target.value)}
                          placeholder="Correct dosage"
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              </>
            ) : (
              <p className="no-med">No medicines detected.</p>
            )}
          </div>

          <div className="result-card">
            <h2 className="result-heading">Dosage Schedule</h2>
            {dosageSchedule.length > 0 ? (
              <div className="schedule-grid">
                {dosageSchedule.map((med, index) => (
                  <div key={`${med.name}-${index}`} className="schedule-item">
                    <p className="schedule-name">{med.name}</p>
                    <p className="schedule-meta">Timings: {med.timings.join(", ")}</p>
                    <p className="schedule-meta">Duration: {med.duration}</p>
                    <p className="schedule-meta">Dose: {med.dosage}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-med">No dosage schedule available.</p>
            )}
          </div>

          <div className="result-card">
            <h2 className="result-heading">Medicine Verification</h2>
            <p className="verify-helper">
              Enter chemist medicines, one per line. Format: Medicine Name - Dosage
            </p>
            <textarea
              className="verify-input"
              value={chemistInput}
              onChange={(e) => setChemistInput(e.target.value)}
              placeholder="Paracetamol - 500mg twice daily"
            />

            <div className="verify-grid">
              <div className="verify-box matched-box">
                <h3>Matched ({comparison.matched.length})</h3>
                {comparison.matched.map((item, idx) => (
                  <p key={`m-${idx}`}>{item.name}</p>
                ))}
              </div>

              <div className="verify-box missing-box">
                <h3>Missing ({comparison.missing.length})</h3>
                {comparison.missing.map((item, idx) => (
                  <p key={`ms-${idx}`}>{item.name}</p>
                ))}
              </div>

              <div className="verify-box extra-box">
                <h3>Extra ({comparison.extra.length})</h3>
                {comparison.extra.map((item, idx) => (
                  <p key={`e-${idx}`}>{item.name}</p>
                ))}
              </div>

              <div className="verify-box wrong-box">
                <h3>Wrong Dosage ({comparison.wrongDosage.length})</h3>
                {comparison.wrongDosage.map((item, idx) => (
                  <p key={`w-${idx}`}>
                    {item.name} (Expected: {item.expectedDose}, Given: {item.givenDose})
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="result-card">
            <h2 className="result-heading">Drug Safety Alerts</h2>
            {safetyAlerts.length > 0 ? (
              <ul className="alerts-list">
                {safetyAlerts.map((alert, index) => (
                  <li key={`alert-${index}`}>{alert}</li>
                ))}
              </ul>
            ) : (
              <p className="no-med">No safety alerts detected in basic checks.</p>
            )}
          </div>

          <div className="result-card">
            <h2 className="result-heading">Re-upload History</h2>
            {savedHistory.length > 0 ? (
              <ul className="history-list">
                {savedHistory.map((entry) => (
                  <li key={entry.id} className="history-item">
                    <div>
                      <p className="history-title">{entry.fileName || "Prescription image"}</p>
                      <p className="history-meta">
                        {new Date(entry.uploadedAt || Date.now()).toLocaleString()} • {entry.member || "Self"}
                      </p>
                    </div>
                    <button
                      className="secondary-btn"
                      onClick={() => openFromHistory(entry)}
                    >
                      View Result Again
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-med">No history yet.</p>
            )}
          </div>

          <div className="result-card">
            <h2 className="result-heading">Full OCR Text</h2>
            <pre className="ocr-text">{activeResult.raw || "No OCR text available."}</pre>
          </div>
        </>
      )}
    </div>
  );
}