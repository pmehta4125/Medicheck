import { useState } from "react";

export default function ContactSupport() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [recipient, setRecipient] = useState("pharmacist");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");

  const recipientEmails = {
    pharmacist: "pharmacist@medicheck.com",
    doctor: "doctor@medicheck.com",
  };

  const submitSupport = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    const to = recipientEmails[recipient];
    const subjectLine = subject.trim()
      ? subject
      : `MediCheck Inquiry from ${name}`;
    const body = `Name: ${name}\nEmail: ${email}\nRecipient Type: ${recipient === "doctor" ? "Doctor" : "Pharmacist"}\n\n${message}`;

    const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, "_blank");

    setSuccess(`Your request has been prepared for the ${recipient}. Your email client should open shortly.`);
    setTimeout(() => setSuccess(""), 4000);
  };

  return (
    <div className="feature-page">
      <h1 className="feature-title">Contact Pharmacist / Doctor</h1>
      <p className="feature-subtitle">Send a message to a doctor or pharmacist for medicine or prescription clarification</p>

      <div className="feature-card form-card">
        <form onSubmit={submitSupport}>
          <label>Send To</label>
          <select value={recipient} onChange={(e) => setRecipient(e.target.value)}>
            <option value="pharmacist">Pharmacist</option>
            <option value="doctor">Doctor</option>
          </select>

          <label>Your Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" required />

          <label>Your Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required />

          <label>Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Prescription clarification" />

          <label>Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe your question or issue about your prescription or medicines"
            rows={5}
            required
          />

          <button className="upload-btn" type="submit">Send Request</button>
        </form>

        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          <a className="secondary-btn call-btn" href="tel:+911234567890">Call Support</a>
          <a className="secondary-btn call-btn" href="https://wa.me/911234567890" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
        {success && <p className="save-msg">{success}</p>}
      </div>
    </div>
  );
}
