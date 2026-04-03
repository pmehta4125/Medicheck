import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Processing() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [prescriptionImage, setPrescriptionImage] = useState(null);

  // Get prescription image from upload preview
  useEffect(() => {
    const stored = localStorage.getItem("prescriptionPreview");
    if (stored) {
      try {
        setPrescriptionImage(stored);
      } catch (e) {
        console.log("Could not load preview image");
      }
    }
  }, []);

  // Fake progress increase
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          navigate("/results"); // go to results page when done
          return 100;
        }
        return prev + 5; // speed
      });
    }, 200);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center text-center px-6">

      <h1 className="text-3xl font-bold text-teal-800 mb-4">
        Processing Prescription...
      </h1>
      <p className="text-gray-600 mb-10 max-w-md">
        Our AI is reading your prescription, detecting medicines, and verifying dosage accuracy.
      </p>

      {/* PRESCRIPTION IMAGE WITH SCANNING OVERLAY */}
      {prescriptionImage ? (
        <div
          className="relative w-80 h-96 rounded-lg overflow-hidden shadow-lg bg-gray-100 mb-8"
          style={{
            backgroundImage: `url(${prescriptionImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* Scanning line animation */}
          <div
            className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-lg"
            style={{
              animation: "scanline 2s ease-in-out infinite",
            }}
          ></div>
          <style>{`
            @keyframes scanline {
              0% { top: 0%; }
              50% { top: 50%; }
              100% { top: 100%; }
            }
          `}</style>
        </div>
      ) : (
        <div className="relative w-64 h-64 border-4 border-teal-700 rounded-full flex items-center justify-center animate-pulse mb-8">
          <div className="text-xl font-semibold text-teal-800">AI Scanning</div>
          <div className="absolute w-full h-full border-t-4 border-teal-400 rounded-full animate-spin"></div>
        </div>
      )}

      {/* PROGRESS BAR */}
      <div className="w-full max-w-md mt-10">
        <div className="h-3 bg-gray-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-700 transition-all"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <p className="mt-3 text-gray-600">{progress}% completed</p>
      </div>
    </div>
  );
}
