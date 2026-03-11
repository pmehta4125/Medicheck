import { useRef } from "react";

export default function HowItWorks() {
  const demoVideoRef = useRef(null);

  const steps = [
    {
      id: 1,
      title: "1. Upload",
      desc: "Upload one or multiple prescription images securely from your device.",
      icon: "📤",
    },
    {
      id: 2,
      title: "2. AI Reads",
      desc: "Our AI extracts medicine names, dosage, and instructions accurately.",
      icon: "🤖",
    },
    {
      id: 3,
      title: "3. Verification",
      desc: "The extracted medicines are checked for correctness and unsafe drugs.",
      icon: "🛡️",
    },
    {
      id: 4,
      title: "4. Results",
      desc: "Clear, color-coded results show correct, mismatched, and wrong medicines.",
      icon: "📊",
    },
  ];

  const setNormalSpeed = () => {
    if (demoVideoRef.current) {
      demoVideoRef.current.playbackRate = 1;
    }
  };

  return (
    <div className="how-page">
      
      {/* HEADER */}
      <section className="how-hero">
        <h1>How MediCheck Works</h1>
        <p>MediCheck uses AI to extract, verify, and validate prescription medicines for patients.</p>
      </section>

      {/* STEPS */}
      <h2 className="steps-title">Your Prescription, Verified in 4 Simple Steps</h2>

      <div className="steps-grid">
        {steps.map((step) => (
          <div key={step.id} className="step-card">
            <div className="step-icon">{step.icon}</div>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </div>
        ))}
      </div>

      <section className="patient-demo-section">
        <h2 className="patient-demo-title">Quick Demo for Patients</h2>
        <p className="patient-demo-subtitle">
          Watch this short guide to understand how to upload and verify prescriptions.
        </p>

        <div className="patient-demo-box">
          <video
            ref={demoVideoRef}
            className="patient-demo-video"
            controls
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedMetadata={setNormalSpeed}
          >
            <source src="/videos/patient-demo.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <p className="patient-demo-note">
            Tip: Click the play button if the video doesn't start automatically.
          </p>
        </div>
      </section>
    </div>
  );
}