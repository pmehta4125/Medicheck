import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      try {
        const extracted = JSON.parse(localStorage.getItem("extractedText")) || [];
        const dismissed = JSON.parse(localStorage.getItem("dismissedNotifications")) || [];
        const active = extracted[0];
        let count = 0;
        if (active) {
          const meds = active.medicines || [];
          count += meds.filter((m) => {
            const f = (m.frequency || "").toLowerCase();
            return f.includes("bd") || f.includes("tds") || f.includes("twice") || f.includes("thrice") || f.includes("1-0-1") || f.includes("1-1-1");
          }).length;
          if ((active.riskScore?.score ?? 100) < 55) count++;
          count += (active.risks || []).filter((r) => r.severity === "High" || r.severity === "Medium").length;
          count++; // analysis complete
        }
        const history = JSON.parse(localStorage.getItem("prescriptionHistory")) || [];
        if (history.length > 0) count++;
        if (history.length >= 3) count++;
        count = Math.max(0, count - dismissed.length);
        setNotifCount(count);
      } catch {
        setNotifCount(0);
      }
    };
    updateCount();
    const interval = setInterval(updateCount, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav>
      <div className="logo">MediCheck</div>

      <div className="nav-menu">
        <Link to="/home">Home</Link>
        <Link to="/how-it-works">How It Works</Link>
        <Link to="/upload">Upload</Link>
        <Link to="/results">Results</Link>
        <Link to="/my-prescriptions">My Prescriptions</Link>
        <Link to="/safety-warnings">Safety</Link>
        <Link to="/reminders">Reminders</Link>
        <Link to="/notifications" style={{ position: "relative" }}>
          🔔
          {notifCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: "-6px",
                right: "-10px",
                background: "#ef4444",
                color: "#fff",
                borderRadius: "50%",
                width: "18px",
                height: "18px",
                fontSize: "0.7rem",
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {notifCount > 9 ? "9+" : notifCount}
            </span>
          )}
        </Link>
        <Link to="/help-faq">Help</Link>
        <Link to="/admin">Admin</Link>
        <Link to="/contact-support">Contact</Link>
      </div>
    </nav>
  );
}