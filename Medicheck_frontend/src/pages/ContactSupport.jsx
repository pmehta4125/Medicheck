import { useState } from "react";

export default function ContactSupport() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  const submitSupport = (e) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    setSuccess("Support request submitted. Our team will contact you soon.");
    setName("");
    setMessage("");

    setTimeout(() => setSuccess(""), 2500);
  };

  return (
    <div className="feature-page">
      <h1 className="feature-title">Contact Pharmacist / Doctor</h1>
      <p className="feature-subtitle">Basic support form for medicine or prescription clarification</p>

      <div className="feature-card form-card">
        <form onSubmit={submitSupport}>
          <label>Your Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" />

          <label>Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your question or issue"
            rows={4}
          />

          <button className="upload-btn" type="submit">Send Request</button>
        </form>

        <a className="secondary-btn call-btn" href="tel:+911234567890">Call Support</a>
        {success && <p className="save-msg">{success}</p>}
      </div>
    </div>
  );
}
