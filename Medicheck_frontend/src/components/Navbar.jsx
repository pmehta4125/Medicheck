import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav>
      <div className="logo">MediCheck</div>

      <div className="nav-menu">
        <Link to="/home">Home</Link>
        <Link to="/how-it-works">How It Works</Link>
        <Link to="/upload">Upload</Link>
        <Link to="/results">Results</Link>
        <Link to="/my-prescriptions">My Prescriptions</Link>
        <Link to="/safety-warnings">Safety</Link>
        <Link to="/reminders">Reminders</Link>
        <Link to="/help-faq">Help</Link>
        <Link to="/contact-support">Contact</Link>
      </div>
    </nav>
  );
}