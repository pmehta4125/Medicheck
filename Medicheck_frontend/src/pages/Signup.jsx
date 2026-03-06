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
import "./signup.css";

export default function Signup() {
  const navigate = useNavigate();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:8080/auth/signup", {
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
        alert(data.error || "Signup failed. Please try again.");
        return;
      }

      alert("Signup successful! Please login.");
      navigate("/login");
    } catch {
      alert("Unable to connect to the server. Please try again.");
    }
  };

  const handleGoogleSignup = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      alert("Google signup failed. Please try again.");
      return;
    }

    try {
      const res = await fetch("http://localhost:8080/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: credentialResponse.credential }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        alert(data.error || "Google signup failed.");
        return;
      }

      alert("Signup successful!");
      localStorage.setItem("user", JSON.stringify(data));
      navigate("/home");
    } catch {
      alert("Unable to connect to the server. Please try again.");
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

          <button className="auth-btn" type="submit">Sign Up</button>
        </form>

        {googleClientId ? (
          <div style={{ marginTop: "16px", display: "flex", justifyContent: "center" }}>
            <GoogleLogin
              onSuccess={handleGoogleSignup}
              onError={() => alert("Google signup was cancelled or failed.")}
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