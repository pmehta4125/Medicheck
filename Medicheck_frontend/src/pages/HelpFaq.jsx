import { useState } from "react";

const FAQS = [
  {
    q: "How to capture a clear prescription image?",
    a: "Use good lighting, avoid shadows, keep the full page in frame, and hold the phone steady.",
  },
  {
    q: "Why are medicines not detected correctly?",
    a: "Handwritten text quality can affect OCR. Try re-uploading a sharper image or use manual correction in results.",
  },
  {
    q: "What if chemist medicines do not match?",
    a: "Consult your doctor or chemist before taking any medicine if something doesn't look right.",
  },
  {
    q: "Can I upload multiple prescriptions?",
    a: "Yes, each upload is saved in My Prescriptions and can be reopened anytime.",
  },
  {
    q: "Is my prescription data secure?",
    a: "Your prescription data stays on your device. We only send the image to AI for analysis and don't store it on any server.",
  },
];

const SUGGESTED_QUESTIONS = [
  "What are the side effects of my medicines?",
  "Can I take these medicines with food?",
  "Are there any drug interactions I should worry about?",
  "What should I do if I miss a dose?",
  "Can I take these medicines during pregnancy?",
];

export default function HelpFaq() {
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const getPrescriptionContext = () => {
    try {
      const stored = JSON.parse(localStorage.getItem("extractedText")) || [];
      const active = stored[0];
      if (!active) return "";

      const medicines = (active.medicines || [])
        .map((m) => `${m.name} ${m.dosage || ""} ${m.frequency || ""}`)
        .join(", ");

      return [
        active.geminiAnalysis || active.text || "",
        medicines ? `Detected medicines: ${medicines}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    } catch {
      return "";
    }
  };

  const askAI = async (q) => {
    const userQuestion = q || question.trim();
    if (!userQuestion || loading) return;

    setChatHistory((prev) => [...prev, { role: "user", text: userQuestion }]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await fetch("/analyze/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userQuestion,
          prescriptionContext: getPrescriptionContext(),
        }),
      });

      const data = await res.json();
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", text: data.answer || "Sorry, I couldn't get an answer right now." },
      ]);
    } catch {
      setChatHistory((prev) => [
        ...prev,
        { role: "ai", text: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="feature-page">
      <h1 className="feature-title">Help / FAQ</h1>
      <p className="feature-subtitle">Quick help and common troubleshooting steps</p>

      <div className="feature-list">
        {FAQS.map((item, index) => (
          <details className="faq-item" key={index}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>

      {/* Ask AI Section */}
      <div style={{ marginTop: "2rem" }}>
        <h2 className="feature-title" style={{ fontSize: "1.5rem" }}>
          Ask AI About Your Prescription
        </h2>
        <p className="feature-subtitle" style={{ marginBottom: "1rem" }}>
          Have a question about your medicines? Ask our AI assistant.
        </p>

        {/* Suggested Questions */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "1rem" }}>
          {SUGGESTED_QUESTIONS.map((sq, i) => (
            <button
              key={i}
              onClick={() => askAI(sq)}
              disabled={loading}
              style={{
                padding: "6px 14px",
                borderRadius: "20px",
                border: "1.5px solid #0d9488",
                background: "#f0fdfa",
                color: "#0d9488",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "0.85rem",
                fontWeight: 500,
                transition: "all 0.2s",
              }}
            >
              {sq}
            </button>
          ))}
        </div>

        {/* Chat History */}
        {chatHistory.length > 0 && (
          <div
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              marginBottom: "1rem",
              padding: "1rem",
              background: "#f8fffe",
              borderRadius: "12px",
              border: "1px solid #e0f2f1",
            }}
          >
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: "10px",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "10px 16px",
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: msg.role === "user" ? "#0d9488" : "#ffffff",
                    color: msg.role === "user" ? "#fff" : "#1a1a1a",
                    border: msg.role === "ai" ? "1px solid #e0e0e0" : "none",
                    fontSize: "0.92rem",
                    lineHeight: "1.5",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {msg.role === "ai" && (
                    <span style={{ fontWeight: 600, color: "#0d9488", display: "block", marginBottom: "4px", fontSize: "0.8rem" }}>
                      AI Assistant
                    </span>
                  )}
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "10px" }}>
                <div
                  style={{
                    padding: "10px 16px",
                    borderRadius: "16px 16px 16px 4px",
                    background: "#ffffff",
                    border: "1px solid #e0e0e0",
                    fontSize: "0.92rem",
                    color: "#888",
                  }}
                >
                  Thinking...
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && askAI()}
            placeholder="Type your question here..."
            disabled={loading}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "12px",
              border: "1.5px solid #d1d5db",
              fontSize: "0.95rem",
              outline: "none",
              transition: "border-color 0.2s",
            }}
          />
          <button
            onClick={() => askAI()}
            disabled={loading || !question.trim()}
            style={{
              padding: "12px 24px",
              borderRadius: "12px",
              border: "none",
              background: loading || !question.trim() ? "#9ca3af" : "#0d9488",
              color: "#fff",
              fontWeight: 600,
              cursor: loading || !question.trim() ? "not-allowed" : "pointer",
              fontSize: "0.95rem",
              transition: "background 0.2s",
            }}
          >
            {loading ? "Asking..." : "Ask AI"}
          </button>
        </div>

        <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "8px" }}>
          Disclaimer: AI answers are for informational purposes only. Always consult your doctor for medical advice.
        </p>
      </div>
    </div>
  );
}
