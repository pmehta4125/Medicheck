import { useEffect, useState } from "react";

function generateNotifications() {
  const notifications = [];
  const now = Date.now();

  try {
    // From prescription history
    const history = JSON.parse(localStorage.getItem("prescriptionHistory")) || [];
    const extracted = JSON.parse(localStorage.getItem("extractedText")) || [];
    const active = extracted[0];

    if (active) {
      const medicines = active.medicines || [];

      // Medicine reminders
      medicines.forEach((med) => {
        const freq = (med.frequency || "").toLowerCase();
        if (freq.includes("twice") || freq.includes("bd") || freq.includes("1-0-1")) {
          notifications.push({
            id: `rem-${med.name}`,
            type: "reminder",
            icon: "🔔",
            title: `Take ${med.name}`,
            message: `${med.dosage || ""} — ${med.frequency || "as directed"}`,
            time: now - Math.floor(Math.random() * 3600000),
          });
        } else if (freq.includes("thrice") || freq.includes("tds") || freq.includes("1-1-1")) {
          notifications.push({
            id: `rem-${med.name}`,
            type: "reminder",
            icon: "🔔",
            title: `Take ${med.name}`,
            message: `${med.dosage || ""} — three times daily`,
            time: now - Math.floor(Math.random() * 1800000),
          });
        }
      });

      // Risk alerts
      const riskScore = active.riskScore?.score ?? 100;
      if (riskScore < 55) {
        notifications.push({
          id: "risk-high",
          type: "warning",
          icon: "⚠️",
          title: "High Risk Prescription Detected",
          message: "Your latest prescription has potential safety concerns. Please review Safety Warnings.",
          time: now - 600000,
        });
      }

      // Interaction warnings from risks
      const risks = active.risks || [];
      risks.forEach((risk, i) => {
        if (risk.severity === "High" || risk.severity === "Medium") {
          notifications.push({
            id: `int-${i}`,
            type: "warning",
            icon: "⚠️",
            title: "Interaction Warning",
            message: risk.message,
            time: now - 300000 * (i + 1),
          });
        }
      });

      // Analysis complete notification
      notifications.push({
        id: "analysis-done",
        type: "success",
        icon: "📄",
        title: "Prescription Analyzed Successfully",
        message: `${medicines.length} medicine(s) detected from your latest upload.`,
        time: now - 120000,
      });
    }

    // History-based notifications
    if (history.length > 0) {
      notifications.push({
        id: "history-saved",
        type: "info",
        icon: "✅",
        title: "Prescription Saved",
        message: `${history.length} prescription(s) saved in your history.`,
        time: now - 1800000,
      });
    }

    if (history.length >= 3) {
      notifications.push({
        id: "report-ready",
        type: "success",
        icon: "📊",
        title: "Health Report Available",
        message: "You have enough prescriptions to generate a summary report.",
        time: now - 7200000,
      });
    }
  } catch {
    // ignore parsing errors
  }

  // Always show a welcome notification
  if (notifications.length === 0) {
    notifications.push({
      id: "welcome",
      type: "info",
      icon: "👋",
      title: "Welcome to MediCheck",
      message: "Upload a prescription to start getting smart notifications about your medicines.",
      time: now - 60000,
    });
  }

  // Sort by time (newest first)
  return notifications.sort((a, b) => b.time - a.time);
}

const TYPE_STYLES = {
  reminder: { bg: "#eff6ff", border: "#3b82f6" },
  warning: { bg: "#fef3c7", border: "#f59e0b" },
  success: { bg: "#d1fae5", border: "#059669" },
  info: { bg: "#f0fdf4", border: "#0d9488" },
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("dismissedNotifications")) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    setNotifications(generateNotifications());
  }, []);

  const dismiss = (id) => {
    const updated = [...dismissed, id];
    setDismissed(updated);
    localStorage.setItem("dismissedNotifications", JSON.stringify(updated));
  };

  const clearAll = () => {
    const allIds = notifications.map((n) => n.id);
    setDismissed(allIds);
    localStorage.setItem("dismissedNotifications", JSON.stringify(allIds));
  };

  const visible = notifications.filter((n) => !dismissed.includes(n.id));

  const formatTime = (ts) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="feature-page">
      <h1 className="feature-title">Notifications</h1>
      <p className="feature-subtitle">Stay updated with your prescription activity</p>

      <div style={{ maxWidth: "700px", margin: "0 auto" }}>
        {/* Header with clear all */}
        {visible.length > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <span style={{ fontSize: "0.9rem", color: "#666", fontWeight: 500 }}>
              {visible.length} notification{visible.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={clearAll}
              style={{
                background: "none",
                border: "none",
                color: "#0d9488",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Clear All
            </button>
          </div>
        )}

        {/* Notification List */}
        {visible.length > 0 ? (
          visible.map((notification) => {
            const style = TYPE_STYLES[notification.type] || TYPE_STYLES.info;
            return (
              <div
                key={notification.id}
                style={{
                  background: style.bg,
                  borderLeft: `4px solid ${style.border}`,
                  borderRadius: "12px",
                  padding: "14px 18px",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  animation: "fadeIn 0.3s ease",
                }}
              >
                <span style={{ fontSize: "1.5rem", flexShrink: 0, marginTop: "2px" }}>
                  {notification.icon}
                </span>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 700,
                      fontSize: "0.95rem",
                      color: "#1a1a1a",
                    }}
                  >
                    {notification.title}
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "0.85rem",
                      color: "#555",
                      lineHeight: "1.4",
                    }}
                  >
                    {notification.message}
                  </p>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: "0.75rem",
                      color: "#999",
                    }}
                  >
                    {formatTime(notification.time)}
                  </p>
                </div>
                <button
                  onClick={() => dismiss(notification.id)}
                  title="Dismiss"
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "1.1rem",
                    color: "#aaa",
                    cursor: "pointer",
                    padding: "4px",
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "3rem",
              color: "#999",
              background: "#fff",
              borderRadius: "14px",
              border: "1px solid #e0e0e0",
            }}
          >
            <p style={{ fontSize: "2.5rem", margin: "0 0 8px" }}>🔔</p>
            <p style={{ fontWeight: 600, fontSize: "1.1rem", color: "#666" }}>All caught up!</p>
            <p style={{ fontSize: "0.85rem" }}>No new notifications right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}
