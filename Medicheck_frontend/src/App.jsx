/*import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import VerificationPreview from "./components/VerificationPreview";
import Features from "./components/Features";
import WhatWeCheck from "./components/WhatWeCheck";
import Footer from "./components/Footer";
import { Routes, Route } from "react-router-dom";
import HowItWorks from "./pages/HowItWorks";

function App() {
  return(
    <>
      <Navbar />
      <Hero />
      <VerificationPreview />
      <Features />
      <WhatWeCheck />
      <Footer />
    </>
  );
  
}
export default App;*/



/*import "./App.css";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import HowItWorks from "./pages/HowItWorks";
import UploadPrescriptions from "./pages/UploadPrescriptions";
import BatchResults from "./pages/BatchResults";

function App() {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/upload" element={<UploadPrescriptions />} />
        <Route path="/results" element={<BatchResults />} />

      </Routes>
    </>
  );
}

export default App;*/



import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import HowItWorks from "./pages/HowItWorks";
import UploadPrescriptions from "./pages/UploadPrescriptions";
import BatchResults from "./pages/BatchResults";
import Footer from "./components/Footer";
import Processing from "./pages/Processing";
import Splash from "./pages/Splash";
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import MyPrescriptions from "./pages/MyPrescriptions";
import PrescriptionDetails from "./pages/PrescriptionDetails";
import SafetyWarnings from "./pages/SafetyWarnings";
import Reminders from "./pages/Reminders";
import HelpFaq from "./pages/HelpFaq";
import ContactSupport from "./pages/ContactSupport";
import AdminDashboard from "./pages/AdminDashboard";
import Notifications from "./pages/Notifications";

function App() {
  return (
    <BrowserRouter>
      <Navbar />

      <Routes>
        <Route path="/" element={<Splash />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/home" element={<Home />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/upload" element={<UploadPrescriptions />} />
        <Route path="/processing" element={<Processing />} />
        <Route path="/results" element={<BatchResults />} />
        <Route path="/my-prescriptions" element={<MyPrescriptions />} />
        <Route path="/prescriptions/:id" element={<PrescriptionDetails />} />
        <Route path="/safety-warnings" element={<SafetyWarnings />} />
        <Route path="/reminders" element={<Reminders />} />
        <Route path="/help-faq" element={<HelpFaq />} />
        <Route path="/contact-support" element={<ContactSupport />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/notifications" element={<Notifications />} />
      </Routes>

      <Footer />
    </BrowserRouter>
  );
}

export default App;




