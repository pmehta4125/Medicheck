import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  AUTH_REQUIRED_MESSAGE,
  clearAuthSession,
  getAuthSession,
  getUserInitials,
  hasActiveSession,
  isAdminSession,
} from "../utils/auth";
import { clearPrescriptionUploadFlag } from "../utils/prescription";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);
  const [notifCount, setNotifCount] = useState(0);
  const [authUser, setAuthUser] = useState(() => getAuthSession());
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const isLoggedIn = Boolean(authUser);
  const isAdmin = isAdminSession();
  const initials = isLoggedIn ? getUserInitials(authUser.name, authUser.email) : "";

  const handleProtectedNavigation = (event) => {
    if (hasActiveSession()) {
      return;
    }

    event.preventDefault();
    navigate("/login", { state: { authMessage: AUTH_REQUIRED_MESSAGE } });
  };

  const handleLogout = () => {
    clearAuthSession();
    clearPrescriptionUploadFlag();
    setAuthUser(null);
    setIsProfileMenuOpen(false);
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    setAuthUser(getAuthSession());
    setIsProfileMenuOpen(false);
  }, [location.pathname]);

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

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileMenuOpen]);

  return (
    <nav>
      <div className="logo">MediCheck</div>

      <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <div className="nav-menu" style={{ display: "flex", alignItems: "center", gap: "2px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link to="/home" onClick={handleProtectedNavigation}>Home</Link>
          <Link to="/how-it-works" onClick={handleProtectedNavigation}>How It Works</Link>
          <Link to="/upload" onClick={handleProtectedNavigation}>Upload</Link>
          <Link to="/my-prescriptions" onClick={handleProtectedNavigation}>My Prescriptions</Link>
          <Link to="/safety-warnings" onClick={handleProtectedNavigation}>Safety</Link>
          <Link to="/reminders" onClick={handleProtectedNavigation}>Reminders</Link>
          <Link to="/notifications" onClick={handleProtectedNavigation} style={{ position: "relative" }}>
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
          <Link to="/help-faq" onClick={handleProtectedNavigation}>Help</Link>
          {isAdmin ? <Link to="/admin" onClick={handleProtectedNavigation}>Admin</Link> : null}
          <Link to="/contact-support" onClick={handleProtectedNavigation}>Contact</Link>
        </div>

        {isLoggedIn ? (
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((open) => !open)}
              style={{
                width: "46px",
                height: "46px",
                borderRadius: "50%",
                border: "none",
                background: "linear-gradient(135deg, #0a6d62 0%, #1db7a6 100%)",
                color: "#ffffff",
                fontWeight: 800,
                letterSpacing: "0.08em",
                cursor: "pointer",
                boxShadow: "0 12px 24px rgba(10, 109, 98, 0.2)",
              }}
              aria-label="Open account menu"
            >
              {initials}
            </button>

            {isProfileMenuOpen ? (
              <div
                style={{
                  position: "absolute",
                  top: "58px",
                  right: 0,
                  width: "280px",
                  background: "#ffffff",
                  borderRadius: "20px",
                  boxShadow: "0 24px 50px rgba(8, 60, 55, 0.16)",
                  border: "1px solid #d7ebe7",
                  padding: "18px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
                  <div
                    style={{
                      width: "50px",
                      height: "50px",
                      borderRadius: "50%",
                      background: "#e6f7f4",
                      color: "#0a6d62",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                    }}
                  >
                    {initials}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "17px", fontWeight: 700, color: "#083c37", marginBottom: "4px" }}>
                      {authUser.name || "MediCheck User"}
                    </p>
                    <p style={{ fontSize: "13px", color: "#5d7470", wordBreak: "break-word" }}>
                      {authUser.email}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    navigate("/profile");
                  }}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    border: "1px solid #d7ebe7",
                    background: "#f4fbfa",
                    color: "#0a6d62",
                    fontWeight: 700,
                    cursor: "pointer",
                    marginBottom: "10px",
                    textAlign: "left",
                  }}
                >
                  View account
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    border: "none",
                    background: "#0a6d62",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </nav>
  );
}