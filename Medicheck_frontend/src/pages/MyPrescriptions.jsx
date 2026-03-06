import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

function getStatus(item) {
  const medCount = item?.medicines?.length || 0;
  if (medCount >= 3) return "Verified";
  if (medCount > 0) return "Needs Review";
  return "Uploaded";
}

export default function MyPrescriptions() {
  const navigate = useNavigate();
  const history = JSON.parse(localStorage.getItem("prescriptionHistory")) || [];

  const sortedHistory = useMemo(
    () => [...history].sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0)),
    [history]
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
