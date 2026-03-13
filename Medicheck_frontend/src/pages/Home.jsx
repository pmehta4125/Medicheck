import { useNavigate } from "react-router-dom";
import { isAdminSession } from "../utils/auth";

export default function Home() {
  const navigate = useNavigate();
  const isAdmin = isAdminSession();

  if (isAdmin) {
    return (
      <>
        <section className="hero">
          <h1>MediCheck<br />Admin Panel</h1>
          <p>Monitor system health, user registrations, and prescription analytics.</p>
          <button onClick={() => navigate("/admin")}>Go to Dashboard</button>
        </section>

        <section className="card-grid">
          <div className="card">
            <h3>👥 User Management</h3>
            <p>Track registered users and account activity.</p>
          </div>

          <div className="card">
            <h3>🖥️ System Health</h3>
            <p>Monitor backend API, Gemini AI, and OCR engine status.</p>
          </div>

          <div className="card">
            <h3>📊 Analytics</h3>
            <p>View prescription upload stats and AI accuracy metrics.</p>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="hero">
        <h1>Verify Your Prescription.<br />Stay Safe with AI.</h1>
        <p>MediCheck helps patients verify medicines dispensed by chemists.</p>
        <a href="/upload"><button>Upload Prescription</button></a>
      </section>

      <section className="card-grid">
        <div className="card">
          <h3>📄 Digital Prescription Reading</h3>
          <p>AI reads medicines and dosage automatically.</p>
        </div>

        <div className="card">
          <h3>💊 Medicine Verification</h3>
          <p>Instantly compare doctor vs chemist medicines.</p>
        </div>

        <div className="card">
          <h3>⚠️ Detect Mismatches</h3>
          <p>Find incorrect or unsafe medicines.</p>
        </div>
      </section>
    </>
  );
}