import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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
  "amoxyclav",
  "azithromycin",
  "cetirizine",
  "pantoprazole",
  "metformin",
  "atorvastatin",
  "omeprazole",
  "aspirin",
  "lisinopril",
];

const MEDICINE_FACTS = {
  amoxicillin: {
    usedFor: "Bacterial infections",
    commonSideEffects: "Nausea, diarrhea",
    avoidWith: "Unnecessary antibiotic overlap",
  },
  amoxyclav: {
    usedFor: "Bacterial infections",
    commonSideEffects: "Nausea, loose motions",
    avoidWith: "Unnecessary antibiotic overlap",
  },
  paracetamol: {
    usedFor: "Fever and pain",
    commonSideEffects: "Nausea, mild rash",
    avoidWith: "Alcohol and overdose combinations",
  },
  ibuprofen: {
    usedFor: "Pain and inflammation",
    commonSideEffects: "Acidity, stomach upset",
    avoidWith: "Ulcer history and kidney disease",
  },
  azithromycin: {
    usedFor: "Bacterial infections",
    commonSideEffects: "Loose stools, nausea",
    avoidWith: "Unnecessary antibiotic overlap",
  },
  cetirizine: {
    usedFor: "Allergy symptoms",
    commonSideEffects: "Sleepiness, dry mouth",
    avoidWith: "Sedatives and alcohol",
  },
  pantoprazole: {
    usedFor: "Acidity and reflux",
    commonSideEffects: "Headache, bloating",
    avoidWith: "Long-term unsupervised use",
  },
  metformin: {
    usedFor: "Type 2 diabetes",
    commonSideEffects: "Nausea, stomach upset",
    avoidWith: "Heavy alcohol intake",
  },
  atorvastatin: {
    usedFor: "High cholesterol",
    commonSideEffects: "Muscle ache, nausea",
    avoidWith: "Grapefruit juice excess",
  },
  omeprazole: {
    usedFor: "Acidity and reflux",
    commonSideEffects: "Headache, abdominal discomfort",
    avoidWith: "Long-term unsupervised use",
  },
  aspirin: {
    usedFor: "Blood thinning and heart protection",
    commonSideEffects: "Acidity, easy bruising",
    avoidWith: "Bleeding risk with unsupervised use",
  },
  lisinopril: {
    usedFor: "Blood pressure control",
    commonSideEffects: "Dry cough, dizziness",
    avoidWith: "Potassium supplements without advice",
  },
};

const TIME_BY_SLOT = {
  Morning: "08:00",
  Afternoon: "14:00",
  Night: "22:00",
  "As directed": "10:00",
};

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

function inferTimings(text = "") {
  const value = text.toLowerCase();

  if (value.includes("tds") || value.includes("thrice")) {
    return ["Morning", "Afternoon", "Night"];
  }

  if (value.includes("bd") || value.includes("twice")) {
    return ["Morning", "Night"];
  }

  const timings = [];
  if (value.includes("morning") || value.includes("od") || value.includes("daily")) timings.push("Morning");
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

function buildRiskInsights(medicines = []) {
  let score = 100;
  const risks = [];
  const seen = {};

  medicines.forEach((med) => {
    const key = normalizeName(med.name);
    seen[key] = (seen[key] || 0) + 1;

    const doseValue = Number((med.dosage || "").match(/(\d+)\s?mg/i)?.[1] || 0);
    if (doseValue > 650) {
      score -= 14;
      risks.push({ severity: "High", message: `High dosage detected for ${med.name}: ${doseValue}mg.` });
    }
  });

  Object.entries(seen).forEach(([name, count]) => {
    if (count > 1) {
      score -= 12;
      risks.push({ severity: "Medium", message: `Duplicate ingredient risk: ${name} appears ${count} times.` });
    }
  });

  BRAND_ALIAS_GROUPS.forEach((group) => {
    const found = group.filter((alias) =>
      medicines.some((med) => normalizeName(med.name).includes(normalizeName(alias)))
    );

    if (found.length > 1) {
      score -= 10;
      risks.push({ severity: "Medium", message: `Possible same-drug brand overlap: ${found.join(", ")}.` });
    }
  });

  score = Math.max(0, Math.min(100, score));

  if (risks.length === 0) {
    risks.push({ severity: "Low", message: "No major safety risk patterns detected in basic checks." });
  }

  let level = "Safe";
  let indicator = "green";

  if (score < 55) {
    level = "High risk";
    indicator = "red";
  } else if (score < 80) {
    level = "Moderate risk";
    indicator = "yellow";
  }

  return { riskScore: { score, level, indicator }, risks };
}

function buildMedicineExplanations(medicines = []) {
  return medicines.map((med) => {
    const normalized = normalizeName(med.name);
    const facts = MEDICINE_FACTS[normalized] || {
      usedFor: "Doctor-prescribed treatment",
      commonSideEffects: "Possible nausea or mild dizziness",
      avoidWith: "Self-medication and duplicate brands",
    };

    return {
      name: med.name,
      usedFor: facts.usedFor,
      commonSideEffects: facts.commonSideEffects,
      avoidWith: facts.avoidWith,
    };
  });
}

function buildScheduleTimeline(medicines = []) {
  const items = [];

  medicines.forEach((med) => {
    const slots = inferTimings(`${med.frequency || ""} ${med.dosage || ""}`);
    slots.forEach((slot) => {
      items.push({
        slot,
        time: TIME_BY_SLOT[slot] || "10:00",
        medicine: med.name,
        dosage: med.dosage || "Not specified",
      });
    });
  });

  const slotRank = { Morning: 1, Afternoon: 2, Night: 3, "As directed": 4 };
  return items.sort((a, b) => (slotRank[a.slot] || 5) - (slotRank[b.slot] || 5));
}

function stringifyRiskLevel(value = "") {
  return String(value || "").toLowerCase().replace(/\s+/g, "-");
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
  const hasEdits = prescribedMedicines !== (activeResult?.medicines || []);

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

  const computedRiskInsights = useMemo(() => buildRiskInsights(prescribedMedicines), [prescribedMedicines]);

  const riskInsights = useMemo(() => {
    if (!hasEdits && activeResult?.riskScore && Array.isArray(activeResult?.risks)) {
      return { riskScore: activeResult.riskScore, risks: activeResult.risks };
    }

    return computedRiskInsights;
  }, [activeResult, computedRiskInsights, hasEdits]);

  const medicineExplanations = useMemo(() => {
    if (!hasEdits && Array.isArray(activeResult?.medicineExplanations) && activeResult.medicineExplanations.length > 0) {
      return activeResult.medicineExplanations;
    }

    return buildMedicineExplanations(prescribedMedicines);
  }, [activeResult, hasEdits, prescribedMedicines]);

  const scheduleTimeline = useMemo(() => {
    if (!hasEdits && Array.isArray(activeResult?.scheduleTimeline) && activeResult.scheduleTimeline.length > 0) {
      return activeResult.scheduleTimeline;
    }

    return buildScheduleTimeline(prescribedMedicines);
  }, [activeResult, hasEdits, prescribedMedicines]);

  const comparison = useMemo(() => {
    const dispensed = parseChemistInput(chemistInput);
    const prescribedMap = new Map(prescribedMedicines.map((med) => [normalizeName(med.name), med]));

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

    const missing = prescribedMedicines.filter((med) => !seen.has(normalizeName(med.name)));

    return { matched, wrongDosage, missing, extra };
  }, [chemistInput, prescribedMedicines]);

  const openFromHistory = (entry) => {
    setActiveResult(entry);
    localStorage.setItem("extractedText", JSON.stringify([entry]));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateMedicineField = (index, field, value) => {
    setEditableMedicines((prev) => prev.map((med, i) => (i === index ? { ...med, [field]: value } : med)));
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

          <div className="result-card risk-card">
            <h2 className="result-heading">Prescription Risk Score</h2>
            <div className="risk-score-row">
              <p className="risk-score-value">{riskInsights.riskScore?.score ?? 0} / 100</p>
              <span className={`risk-score-indicator ${stringifyRiskLevel(riskInsights.riskScore?.indicator || riskInsights.riskScore?.level)}`}>
                {riskInsights.riskScore?.level || "Moderate risk"}
              </span>
            </div>
            <p className="risk-score-note">Risks detected:</p>
            <ul className="alerts-list">
              {(riskInsights.risks || []).map((risk, index) => (
                <li key={`risk-${index}`}>
                  <strong>{risk.severity || "Medium"}:</strong> {risk.message}
                </li>
              ))}
            </ul>
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
            <h2 className="result-heading">AI Explanation For Each Medicine</h2>
            {medicineExplanations.length > 0 ? (
              <div className="schedule-grid">
                {medicineExplanations.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="schedule-item">
                    <p className="schedule-name">{item.name}</p>
                    <p className="schedule-meta"><strong>Used for:</strong> {item.usedFor}</p>
                    <p className="schedule-meta"><strong>Common side effects:</strong> {item.commonSideEffects}</p>
                    <p className="schedule-meta"><strong>Avoid with:</strong> {item.avoidWith}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-med">No medicine explanations available.</p>
            )}
          </div>

          <div className="result-card">
            <h2 className="result-heading">Medicine Schedule Visualization</h2>
            {scheduleTimeline.length > 0 ? (
              <div className="timeline-list">
                {scheduleTimeline.map((item, index) => (
                  <div key={`${item.medicine}-${item.slot}-${index}`} className="timeline-row-item">
                    <span className="timeline-time-chip">{item.time}</span>
                    <span className="timeline-slot-chip">{item.slot}</span>
                    <div>
                      <p className="timeline-med-name">{item.medicine}</p>
                      <p className="schedule-meta">{item.dosage}</p>
                    </div>
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
                    <button className="secondary-btn" onClick={() => openFromHistory(entry)}>
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
            {activeResult.rawOriginal && activeResult.rawOriginal !== activeResult.raw ? (
              <details className="ocr-details">
                <summary className="ocr-summary">Show Original Raw OCR (Debug)</summary>
                <pre className="ocr-text">{activeResult.rawOriginal}</pre>
              </details>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
