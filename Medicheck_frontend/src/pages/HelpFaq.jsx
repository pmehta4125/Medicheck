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
    a: "Use the verification section to compare and consult doctor/chemist before taking any medicine.",
  },
  {
    q: "Can I upload multiple prescriptions?",
    a: "Yes, each upload is saved in My Prescriptions and can be reopened anytime.",
  },
];

export default function HelpFaq() {
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
    </div>
  );
}
