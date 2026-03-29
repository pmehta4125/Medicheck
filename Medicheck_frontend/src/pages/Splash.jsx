import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./splash.css";

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    setTimeout(() => {
      navigate("/welcome");
    }, 3000); // 3 sec splash
  }, []);

  return (
    <div className="splash-container">
      <div className="splash-content-center">
        <div className="splash-svg-wrapper">
          {/* Animated Stethoscope Heart with Pulse */}
          <svg className="stethoscope-svg" width="220" height="180" viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="stethGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00eaff" />
                <stop offset="100%" stopColor="#43e97b" />
              </linearGradient>
              <radialGradient id="pulseGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#00eaff" stopOpacity="0.18" />
              </radialGradient>
            </defs>
            {/* Heart shape (stethoscope tube) */}
            <path className="steth-heart" d="M60 90 Q60 50 110 70 Q160 50 160 90 Q160 130 110 160 Q60 130 60 90 Z" stroke="url(#stethGrad)" strokeWidth="7" fill="none" />
            {/* Stethoscope earpieces */}
            <circle cx="60" cy="90" r="8" fill="#fff" stroke="#00eaff" strokeWidth="3" />
            <circle cx="160" cy="90" r="8" fill="#fff" stroke="#00eaff" strokeWidth="3" />
            {/* Stethoscope chestpiece (bottom) */}
            <circle className="steth-pulse" cx="110" cy="160" r="16" fill="url(#pulseGlow)" />
            <circle cx="110" cy="160" r="8" fill="#fff" stroke="#00eaff" strokeWidth="3" />
            {/* Tubes to earpieces */}
            <path d="M110 160 Q80 120 60 90" stroke="#00eaff" strokeWidth="4" fill="none" />
            <path d="M110 160 Q140 120 160 90" stroke="#00eaff" strokeWidth="4" fill="none" />
          </svg>
        </div>
        <h1 className="splash-title">MediCheck</h1>
        <p className="splash-tagline">AI Prescription Safety</p>
      </div>
    </div>
  );
}