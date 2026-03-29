import { useNavigate } from "react-router-dom";

import { enableGuestSession } from "../utils/auth";
import "./welcome.css";
import { useEffect, useState } from "react";


export default function Welcome() {
  const navigate = useNavigate();
  const [showIntro, setShowIntro] = useState(true);
  const [typedText, setTypedText] = useState("");
  const welcomeMessage = "Welcome to MediCheck!";

  useEffect(() => {
    if (!showIntro) return;
    let i = 0;
    const type = () => {
      if (i <= welcomeMessage.length) {
        setTypedText(welcomeMessage.slice(0, i));
        i++;
        setTimeout(type, 80); // slower typing
      } else {
        setTimeout(() => setShowIntro(false), 2000); // keep visible for 1.1s
      }
    };
    type();
    // eslint-disable-next-line
  }, [showIntro]);

  return (
    <div className="welcome-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: 48 }}>
      {showIntro ? (
        <div style={{
          width: '100vw',
          height: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'absolute',
          left: 0,
          top: 0,
          background: 'rgba(255,255,255,0.97)',
          zIndex: 10,
          fontSize: 36,
          fontWeight: 700,
          color: '#009688',
          letterSpacing: 1.2,
          fontFamily: 'inherit',
          textShadow: '0 2px 12px #00bcd455',
          userSelect: 'none',
          transition: 'opacity 0.7s',
        }}>
          <span>{typedText}</span>
        </div>
      ) : <>
        {/* Modern animated SVG illustration (AI/health/doctor theme) */}
        <div style={{ minWidth: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="300" height="260" viewBox="0 0 300 260" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="aiGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00bcd4" />
                <stop offset="100%" stopColor="#43e97b" />
              </linearGradient>
              <radialGradient id="glow" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#00bcd4" stopOpacity="0.1" />
              </radialGradient>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#00bcd4" floodOpacity="0.18" />
              </filter>
            </defs>
            {/* Glowing AI circuit background */}
            <ellipse cx="150" cy="130" rx="120" ry="80" fill="url(#glow)" />
            {/* Floating AI shapes */}
            <circle cx="60" cy="60" r="18" fill="url(#aiGradient)" opacity="0.7">
              <animate attributeName="cy" values="60;80;60" dur="3s" repeatCount="indefinite" />
            </circle>
            <rect x="210" y="40" width="28" height="28" rx="8" fill="url(#aiGradient)" opacity="0.6">
              <animate attributeName="y" values="40;60;40" dur="2.5s" repeatCount="indefinite" />
            </rect>
            {/* Doctor figure (stylized, arms crossed, stethoscope) */}
            <g filter="url(#shadow)">
              <ellipse cx="150" cy="200" rx="38" ry="12" fill="#b2ebf2" />
              <ellipse cx="150" cy="110" rx="38" ry="48" fill="#fff" stroke="#00bcd4" strokeWidth="2" />
              {/* Head */}
              <ellipse cx="150" cy="70" rx="22" ry="26" fill="#ffe0b2" />
              {/* Hair */}
              <ellipse cx="150" cy="55" rx="24" ry="14" fill="#795548" />
              {/* Arms (crossed) */}
              <path d="M130 120 Q150 140 170 120 Q160 150 150 140 Q140 150 130 120" fill="#ffe0b2" />
              {/* Coat */}
              <rect x="120" y="110" width="60" height="70" rx="24" fill="#e0f7fa" stroke="#00bcd4" strokeWidth="2" />
              {/* Stethoscope */}
              <path d="M140 120 Q150 160 160 120" stroke="#00bcd4" strokeWidth="4" fill="none" />
              <circle cx="140" cy="120" r="6" fill="#fff" stroke="#00bcd4" strokeWidth="2" />
              <circle cx="160" cy="120" r="6" fill="#fff" stroke="#00bcd4" strokeWidth="2" />
              <ellipse cx="150" cy="170" rx="10" ry="8" fill="#b2ebf2" stroke="#00bcd4" strokeWidth="2" />
            </g>
          </svg>
        </div>
        {/* Right side (UNCHANGED) */}
        <div className="welcome-content" style={{ transition: 'opacity 0.9s', opacity: 1, pointerEvents: 'auto' }}>
          <h1 className="welcome-logo">MediCheck</h1>
          <p className="welcome-sub">
            Your AI-powered prescription safety companion
          </p>
          <div className="welcome-buttons">
            <button className="btn-login" onClick={() => navigate("/login")}>Login</button>
            <button className="btn-signup" onClick={() => navigate("/signup")}>Signup</button>
            <button
              className="btn-guest"
              onClick={() => {
                enableGuestSession();
                navigate("/home", { replace: true });
              }}
            >
              Continue as Guest
            </button>
          </div>
        </div>
      </>}
    </div>
  );
}