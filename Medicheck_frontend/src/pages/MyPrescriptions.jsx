import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthSession } from "../utils/auth";

function getStatus(item) {
  if (item?.geminiAnalysis) return "AI Analyzed";
  if (item?.raw || item?.medicines?.length > 0) return "OCR Only";
  return "No Data";
}

export default function MyPrescriptions() {
  const navigate = useNavigate();
  const currentUser = getAuthSession();
  const currentEmail = currentUser?.email || "";
  const history = JSON.parse(localStorage.getItem("prescriptionHistory")) || [];

  const userHistory = useMemo(
    () => history.filter((entry) => (entry?.ownerEmail || "").toLowerCase() === currentEmail.toLowerCase()),
    [history, currentEmail]
  );

  const sortedHistory = useMemo(
    () => [...userHistory].sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)),
    [userHistory]
  );

  const openResult = (entry) => {
    localStorage.setItem("extractedText", JSON.stringify([entry]));
    navigate("/results");
  };

  const openDetails = (entry) => {
    navigate(`/prescriptions/${entry.id}`);
  };

  return (
    <div className="feature-page">
      <h1 className="feature-title">My Prescriptions</h1>
      <p className="feature-subtitle">All uploaded prescriptions with quick actions</p>

      {sortedHistory.length === 0 ? (
        <div className="feature-card">
          <p>No prescriptions uploaded yet.</p>
        </div>
      ) : (
        <div className="feature-list">
          {sortedHistory.map((entry) => {
            const status = getStatus(entry);
            return (
              <div className="feature-row" key={entry.id}>
                <div>
                  <p className="feature-row-title">{entry.fileName || "Prescription Image"}</p>
                  <p className="feature-row-meta">
                    {new Date(entry.uploadedAt || Date.now()).toLocaleString()} • Medicines: {entry?.medicines?.length || 0}
                  </p>
                </div>

                <div className="feature-row-actions">
                  <span className={`status-pill ${status.toLowerCase().replace(/\s+/g, "-")}`}>{status}</span>
                  <button className="secondary-btn" onClick={() => openResult(entry)}>View Result Again</button>
                  <button className="secondary-btn" onClick={() => openDetails(entry)}>Open Details</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
