import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useLocation, useNavigate } from "react-router-dom";
import { saveAuthSession } from "../utils/auth";
import { clearPrescriptionUploadFlag } from "../utils/prescription";
import "./login.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const authMessage = location.state?.authMessage;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        alert(data.error || "Login failed. Please check your credentials.");
        return;
      }

      alert("Login successful!");
      clearPrescriptionUploadFlag();
      saveAuthSession(data);
      navigate("/home");
    } catch {
      alert("Unable to connect to the server. Please try again.");
    }
  };

  const handleGoogleLogin = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      alert("Google login failed. Please try again.");
      return;
    }

    try {
      const res = await fetch("/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: credentialResponse.credential }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        alert(data.error || "Google login failed.");
        return;
      }

      alert("Login successful!");
      clearPrescriptionUploadFlag();
      saveAuthSession(data);
      navigate("/home");
    } catch {
      alert("Unable to connect to the server. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Login to continue using MediCheck</p>

        {authMessage ? (
          <p
            style={{
              marginBottom: "16px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "#fff4e5",
              color: "#9a3412",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {authMessage}
          </p>
        ) : null}

        <form onSubmit={handleLogin}>
          <label>Email</label>
          <input 
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />

          <label>Password</label>
          <input 
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />

          <button className="auth-btn" type="submit">Login</button>
        </form>

        {googleClientId ? (
          <div style={{ marginTop: "16px", display: "flex", justifyContent: "center" }}>
            <GoogleLogin
              onSuccess={handleGoogleLogin}
              onError={() => alert("Google login was cancelled or failed.")}
            />
          </div>
        ) : null}

        <p className="auth-footer">
          Don’t have an account? <a href="/signup">Sign up</a>
        </p>
      </div>
    </div>
  );
}