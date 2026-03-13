/*import { useState } from "react";
import "./signup.css";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // VALIDATIONS
  const nameValid = name.trim().length >= 3;
  const emailValid = email.includes("@") && email.includes(".");
  const passwordValid = password.length >= 6;

  const formValid = nameValid && emailValid && passwordValid;

  const handleSignup = async (e) => {
    e.preventDefault();

    const res = await fetch("/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (data.error) {
      alert(data.error);
    } else {
      alert("Signup successful!");
      window.location.href = "/login";
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Join MediCheck and start verifying prescriptions</p>

        <form onSubmit={handleSignup}>
          <label>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

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

          {/* ENABLED ONLY IF FORM VALID} */
          /*<button
            className="auth-btn"
            type="submit"
            disabled={!formValid}
            style={{
              opacity: formValid ? 1 : 0.5,
              cursor: formValid ? "pointer" : "not-allowed",
            }}
          >
            Sign Up
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <a href="/login">Login</a>
        </p>
      </div>
    </div>
  );
}*/

import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { saveAuthSession } from "../utils/auth";
import { clearPrescriptionUploadFlag } from "../utils/prescription";
import { showToast } from "../utils/toast";
import "./signup.css";

export default function Signup() {
  const navigate = useNavigate();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }

    try {
      const res = await fetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        showToast(data.error || "Signup failed. Please try again.", "error");
        return;
      }

      showToast("Signup successful! Please login.", "success");
      navigate("/login");
    } catch {
      showToast("Unable to connect to the server. Please try again.", "error");
    }
  };

  const handleGoogleSignup = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      showToast("Google signup failed. Please try again.", "error");
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
        showToast(data.error || "Google signup failed.", "error");
        return;
      }

      showToast("Signup successful!", "success");
      clearPrescriptionUploadFlag();
      saveAuthSession(data);
      navigate("/home");
    } catch {
      showToast("Unable to connect to the server. Please try again.", "error");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Join MediCheck and start verifying prescriptions</p>

        <form onSubmit={handleSignup}>
          <label>Name</label>
          <input 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required 
          />

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

          <label>Confirm Password</label>
          <input 
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required 
          />

          <button className="auth-btn" type="submit">Sign Up</button>
        </form>

        {googleClientId ? (
          <div style={{ marginTop: "16px", display: "flex", justifyContent: "center" }}>
            <GoogleLogin
              onSuccess={handleGoogleSignup}
              onError={() => showToast("Google signup was cancelled or failed.", "error")}
            />
          </div>
        ) : null}

        <p className="auth-footer">
          Already have an account? <a href="/login">Login</a>
        </p>
      </div>
    </div>
  );
}