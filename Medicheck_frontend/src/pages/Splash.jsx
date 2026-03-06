import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./splash.css";

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    setTimeout(() => {
      navigate("/welcome");
    }, 2500); // 2.5 sec splash
  }, []);

  return (
    <div className="splash-container">
      <div className="pulse-circle"></div>

      <h1 className="splash-title">MediCheck</h1>
      <p className="splash-tagline">AI Prescription Safety</p>
    </div>
  );
}