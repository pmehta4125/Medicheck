import { useEffect, useState } from "react";

const STAT_CARD_COLORS = {
  users: { bg: "#e0f2f1", border: "#0d9488", icon: "👥" },
  prescriptions: { bg: "#fef3c7", border: "#f59e0b", icon: "📄" },
  accuracy: { bg: "#ede9fe", border: "#7c3aed", icon: "🎯" },
  highrisk: { bg: "#fee2e2", border: "#ef4444", icon: "⚠️" },
  aiQueries: { bg: "#dbeafe", border: "#3b82f6", icon: "🤖" },
  avgMeds: { bg: "#fce7f3", border: "#ec4899", icon: "💊" },
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats(true);
  }, []);

  const loadStats = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const history = JSON.parse(localStorage.getItem("prescriptionHistory")) || [];
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      const totalPrescriptions = history.length;
      const highRiskCount = history.filter((h) => (h.riskScore?.score ?? 100) < 55).length;
      const totalMeds = history.reduce((sum, h) => sum + (h.medicines?.length || 0), 0);
      const avgMeds = totalPrescriptions > 0 ? (totalMeds / totalPrescriptions).toFixed(1) : 0;
      const geminiCount = history.filter((h) => h.geminiAnalysis).length;
      const ocrCount = Math.max(0, totalPrescriptions - geminiCount);
      const accuracyPercent = totalPrescriptions > 0 ? Math.round((geminiCount / totalPrescriptions) * 100) : 0;
      const uploadsToday = history.filter((h) => now - new Date(h.uploadedAt || 0).getTime() <= oneDayMs).length;
      const failedToday = history.filter((h) => {
        const uploadedAt = new Date(h.uploadedAt || 0).getTime();
        const isToday = now - uploadedAt <= oneDayMs;
        const looksFailed = !h.geminiAnalysis && (!h.medicines || h.medicines.length === 0);
        return isToday && looksFailed;
      }).length;

      let userCount = 0;
      try {
        const res = await fetch("/analyze/stats");
        if (res.ok) {
          const data = await res.json();
          userCount = data.userCount || 0;
        }
      } catch { /* backend may be offline */ }

      setStats({
        users: userCount,
        prescriptions: totalPrescriptions,
        accuracy: accuracyPercent,
        highRisk: highRiskCount,
        aiQueries: geminiCount,
        avgMeds: avgMeds,
        ocrQueries: ocrCount,
        uploadsToday,
        failedToday,
      });
    } catch {
      setStats({ users: 0, prescriptions: 0, accuracy: 0, highRisk: 0, aiQueries: 0, avgMeds: 0, ocrQueries: 0, uploadsToday: 0, failedToday: 0 });
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="feature-page">
        <h1 className="feature-title">Admin Dashboard</h1>
        <p style={{ textAlign: "center", color: "#888", marginTop: "3rem" }}>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="feature-page">
      <h1 className="feature-title">Admin Dashboard</h1>
      <p className="feature-subtitle">Analytics overview and system metrics</p>

      {/* Stats Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          maxWidth: "1000px",
          margin: "0 auto 2rem",
        }}
      >
        <StatCard
          label="Total Users"
          value={stats.users}
          color={STAT_CARD_COLORS.users}
        />
        <StatCard
          label="Prescriptions Uploaded"
          value={stats.prescriptions}
          color={STAT_CARD_COLORS.prescriptions}
        />
        <StatCard
          label="AI Accuracy"
          value={`${stats.accuracy}%`}
          color={STAT_CARD_COLORS.accuracy}
        />
        <StatCard
          label="High Risk Prescriptions"
          value={stats.highRisk}
          color={STAT_CARD_COLORS.highrisk}
        />
        <StatCard
          label="AI Queries Processed"
          value={stats.aiQueries}
          color={STAT_CARD_COLORS.aiQueries}
        />
        <StatCard
          label="Avg Medicines / Prescription"
          value={stats.avgMeds}
          color={STAT_CARD_COLORS.avgMeds}
        />
      </div>

      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto 2rem",
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          padding: "14px 18px",
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          justifyContent: "space-between",
        }}
      >
        <SnapshotItem label="New Users Today" value={0} />
        <SnapshotItem label="Uploads Today" value={stats.uploadsToday} />
        <SnapshotItem label="Failures Today" value={stats.failedToday} />
      </div>

      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto 2rem",
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          padding: "16px 18px",
        }}
      >
        <p style={{ margin: 0, fontWeight: 800, fontSize: "1.05rem", color: "#0f172a" }}>Attention Needed</p>
        <p style={{ margin: "6px 0 0", color: stats.failedToday > 0 ? "#b91c1c" : "#166534", fontWeight: 600 }}>
          {stats.failedToday > 0
            ? `${stats.failedToday} analyses failed in last 24h.`
            : "No critical issues in the last 24h."}
        </p>
      </div>

      <div
        style={{
          maxWidth: "1000px",
          margin: "0 auto",
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          padding: "16px 18px",
        }}
      >
        <p style={{ margin: 0, fontWeight: 800, fontSize: "1.05rem", color: "#0f172a" }}>AI vs OCR Split</p>
        <div style={{ marginTop: "10px", width: "100%", height: "14px", borderRadius: "999px", overflow: "hidden", display: "flex", background: "#e5e7eb" }}>
          <div
            style={{
              width: `${stats.accuracy}%`,
              background: "linear-gradient(90deg, #10b981, #059669)",
            }}
          />
          <div
            style={{
              width: `${Math.max(0, 100 - Number(stats.accuracy || 0))}%`,
              background: "#f59e0b",
            }}
          />
        </div>
        <p style={{ margin: "8px 0 0", color: "#475569", fontWeight: 600, fontSize: "0.9rem" }}>
          AI: {stats.aiQueries} | OCR: {stats.ocrQueries}
        </p>
      </div>
    </div>
  );
}

function SnapshotItem({ label, value }) {
  return (
    <div style={{ minWidth: "180px" }}>
      <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", fontWeight: 600 }}>{label}</p>
      <p style={{ margin: "2px 0 0", fontSize: "1.25rem", color: "#0f172a", fontWeight: 800 }}>{value}</p>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div
      style={{
        background: color.bg,
        borderLeft: `4px solid ${color.border}`,
        borderRadius: "12px",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <span style={{ fontSize: "2rem" }}>{color.icon}</span>
      <div>
        <p style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800, color: "#1a1a1a" }}>{value}</p>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#666", fontWeight: 500 }}>{label}</p>
      </div>
    </div>
  );
}

