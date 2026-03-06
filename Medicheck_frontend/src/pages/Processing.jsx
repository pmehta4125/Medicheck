import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Processing() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

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

      {/* LOADING ANIMATION */}
      <div className="relative w-64 h-64 border-4 border-teal-700 rounded-full flex items-center justify-center animate-pulse">
        <div className="text-xl font-semibold text-teal-800">AI Scanning</div>
        <div className="absolute w-full h-full border-t-4 border-teal-400 rounded-full animate-spin"></div>
      </div>

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
