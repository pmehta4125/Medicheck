import { useEffect, useState } from "react";

export default function ContactSupport() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [recipient, setRecipient] = useState("pharmacist");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [pendingConfirmRequestId, setPendingConfirmRequestId] = useState(null);
  const [currentRequest, setCurrentRequest] = useState(null);

  const recipientEmails = {
    pharmacist: "pharmacist@medicheck.com",
    doctor: "doctor@medicheck.com",
  };

  const markCurrentRequestAsSent = (successMessage = "Email sent successfully for this request.") => {
    setCurrentRequest((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: "sent",
        sentAt: new Date().toISOString(),
      };
    });
    setSuccess(successMessage);
    setTimeout(() => setSuccess(""), 3000);
  };

  useEffect(() => {
    if (!pendingConfirmRequestId) {
      return;
    }

    const onWindowFocus = () => {
      const target = currentRequest && currentRequest.id === pendingConfirmRequestId
        ? currentRequest
        : null;
      if (!target || target.status !== "draft_opened") {
        setPendingConfirmRequestId(null);
        return;
      }

      const didSend = window.confirm("Did you send this email from your email app?");
      if (didSend) {
        markCurrentRequestAsSent();
      }

      setPendingConfirmRequestId(null);
    };

    window.addEventListener("focus", onWindowFocus);
    return () => window.removeEventListener("focus", onWindowFocus);
  }, [pendingConfirmRequestId, currentRequest]);

  const submitSupport = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    const to = recipientEmails[recipient];
    const subjectLine = subject.trim()
      ? subject
      : `MediCheck Inquiry from ${name}`;
    const body = `Name: ${name}\nEmail: ${email}\nRecipient Type: ${recipient === "doctor" ? "Doctor" : "Pharmacist"}\n\n${message}`;

    const requestEntry = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      recipient,
      to,
      name: name.trim(),
      email: email.trim(),
      subject: subjectLine,
      message: message.trim(),
      createdAt: new Date().toISOString(),
      status: "draft_opened",
      sentAt: null,
    };
    setCurrentRequest(requestEntry);
    setPendingConfirmRequestId(requestEntry.id);

    const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink, "_blank");

    setSuccess(`Email draft prepared for the ${recipient}. When you return to this page, we will confirm sent status for this request.`);
    setTimeout(() => setSuccess(""), 4000);

    setSubject("");
    setMessage("");
  };

  return (
    <div className="feature-page">
      <h1 className="feature-title">Contact Pharmacist / Doctor</h1>
      <p className="feature-subtitle">Prepare an email to a doctor or pharmacist for medicine or prescription clarification</p>

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

          <button className="upload-btn" type="submit">Open Email Draft</button>
        </form>

        <p style={{ marginTop: "12px", color: "#5b6b73", fontSize: "0.95rem", lineHeight: 1.5 }}>
          MediCheck opens your email app with a prepared message. Delivery and replies happen outside MediCheck.
        </p>

        <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
          <a className="secondary-btn call-btn" href="tel:+911234567890">Call Support</a>
          <a className="secondary-btn call-btn" href="https://wa.me/911234567890" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        </div>
        {success && <p className="save-msg">{success}</p>}

        {currentRequest && (
          <div
            style={{
              marginTop: "18px",
              border: "1px solid #d1d5db",
              borderRadius: "10px",
              padding: "12px",
              background: "#ffffff",
            }}
          >
            <p style={{ margin: "0 0 6px", fontWeight: 600 }}>
              {currentRequest.subject}
            </p>
            <p style={{ margin: "0 0 6px", color: "#475569", fontSize: "0.92rem" }}>
              To: {currentRequest.recipient === "doctor" ? "Doctor" : "Pharmacist"} ({currentRequest.to})
            </p>
            <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: "0.86rem" }}>
              Draft opened: {new Date(currentRequest.createdAt).toLocaleString()}
            </p>

            {currentRequest.status === "sent" ? (
              <p style={{ margin: 0, color: "#047857", fontWeight: 600 }}>
                Email sent successfully at {new Date(currentRequest.sentAt).toLocaleString()}
              </p>
            ) : (
              <p style={{ margin: 0, color: "#b45309", fontWeight: 600 }}>
                Pending send confirmation
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
