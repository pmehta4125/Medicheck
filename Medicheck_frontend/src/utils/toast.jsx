import { createRoot } from "react-dom/client";
import { useState, useEffect } from "react";

function ToastMessage({ message, type, onDone }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  const bgColor =
    type === "success" ? "#0b6b63" : type === "error" ? "#dc2626" : "#d97706";

  return (
    <div
      style={{
        position: "fixed",
        top: 24,
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? "0" : "-20px"})`,
        opacity: visible ? 1 : 0,
        transition: "all 0.3s ease",
        background: bgColor,
        color: "#fff",
        padding: "12px 28px",
        borderRadius: 10,
        fontSize: 15,
        fontWeight: 600,
        boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
        zIndex: 99999,
        maxWidth: "90vw",
        textAlign: "center",
        pointerEvents: "none",
      }}
    >
      {message}
    </div>
  );
}

let container = null;

export function showToast(message, type = "info") {
  if (!container) {
    container = document.createElement("div");
    document.body.appendChild(container);
  }

  const wrapper = document.createElement("div");
  container.appendChild(wrapper);
  const root = createRoot(wrapper);

  const cleanup = () => {
    root.unmount();
    wrapper.remove();
  };

  root.render(<ToastMessage message={message} type={type} onDone={cleanup} />);
}
