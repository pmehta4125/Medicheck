import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

function normalizeName(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

export default function PrescriptionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const history = JSON.parse(localStorage.getItem("prescriptionHistory")) || [];
  const current = JSON.parse(localStorage.getItem("extractedText")) || [];

  const prescription =
    history.find((item) => String(item.id) === String(id)) ||
    current[0] ||
    null;

  const summary = useMemo(() => {
    const meds = prescription?.medicines || [];
    const names = meds.map((m) => normalizeName(m.name));
    const duplicateCount = names.length - new Set(names).size;

    const highDosageCount = meds.filter((m) => {
      const value = Number((m.dosage || "").match(/(\d+)\s?mg/i)?.[1] || 0);
      return value > 650;
    }).length;

    return {
      total: meds.length,
      duplicateCount,
      highDosageCount,
      mismatchRisk: duplicateCount + highDosageCount > 0 ? "Medium" : "Low",
    };
  }, [prescription]);

  if (!prescription) {
    return (
      <div className="feature-page">
        <h1 className="feature-title">Prescription Details</h1>
        <div className="feature-card">No prescription found.</div>
      </div>
    );
  }

  return (
    <div className="feature-page">
      <h1 className="feature-title">Prescription Details</h1>
      <p className="feature-subtitle">Detailed medicine report with dosage and verification summary</p>

      <div className="feature-card">
        <p><strong>File:</strong> {prescription.fileName || "Prescription Image"}</p>
        <p><strong>Uploaded:</strong> {new Date(prescription.uploadedAt || Date.now()).toLocaleString()}</p>
      </div>

      <div className="feature-card">
        <h3 className="feature-section-title">Dosage Table</h3>
        <table className="report-table">
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Dosage</th>
            </tr>
          </thead>
          <tbody>
            {(prescription.medicines || []).map((med, index) => (
              <tr key={`${med.name}-${index}`}>
                <td>{med.name || "Unknown"}</td>
                <td>{med.dosage || "Not specified"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="feature-card">
        <h3 className="feature-section-title">Verification Summary</h3>
        <div className="summary-grid">
          <div className="summary-box"><strong>Total Medicines:</strong> {summary.total}</div>
          <div className="summary-box"><strong>Duplicate Risk:</strong> {summary.duplicateCount}</div>
          <div className="summary-box"><strong>High Dosage Flags:</strong> {summary.highDosageCount}</div>
          <div className="summary-box"><strong>Mismatch Risk:</strong> {summary.mismatchRisk}</div>
        </div>
      </div>

      <div className="feature-actions">
        <button className="secondary-btn" onClick={() => navigate("/results")}>Back to Results</button>
      </div>
    </div>
  );
}
