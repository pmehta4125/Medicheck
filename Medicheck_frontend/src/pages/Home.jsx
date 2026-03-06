export default function Home() {
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