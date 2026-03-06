import { useNavigate } from "react-router-dom";
import "./welcome.css";

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="welcome-wrapper">

      <div className="welcome-content">
        <h1 className="welcome-logo">MediCheck</h1>
        <p className="welcome-sub">
          Your AI-powered prescription safety companion
        </p>

        <div className="welcome-buttons">
          <button className="btn-login" onClick={() => navigate("/login")}>
            Login
          </button>

          <button className="btn-signup" onClick={() => navigate("/signup")}>
            Signup
          </button>

          <button className="btn-guest" onClick={() => navigate("/home")}>
            Continue as Guest
          </button>
        </div>
      </div>

    </div>
  );
}