import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { parsePrescription, parsePrescriptionInfo } from "../utils/medicineParser";
import { getAuthSession } from "../utils/auth";
import { markPrescriptionUploaded } from "../utils/prescription";
import { apiUrl } from "../utils/api";

function getQualityStatus(score) {
  if (score >= 75) return "Good";
  if (score >= 45) return "Moderate";
  return "Poor";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRange(value, min, max) {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

async function analyzeImageQuality(file) {
  const { img, url } = await loadImageFromFile(file);

  try {
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const canvas = document.createElement("canvas");
    const sampleWidth = Math.min(320, width);
    const sampleHeight = Math.max(1, Math.round((sampleWidth / Math.max(width, 1)) * height));
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(img, 0, 0, sampleWidth, sampleHeight);

    const pixelData = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const totalPixels = sampleWidth * sampleHeight;
    const gray = new Float32Array(totalPixels);

    let grayIndex = 0;
    let sum = 0;
    let sumSquares = 0;

    for (let i = 0; i < pixelData.length; i += 4) {
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];
      const value = 0.299 * r + 0.587 * g + 0.114 * b;

      gray[grayIndex++] = value;
      sum += value;
      sumSquares += value * value;
    }

    const avgBrightness = sum / totalPixels;
    const variance = Math.max(0, sumSquares / totalPixels - avgBrightness * avgBrightness);
    const contrastStd = Math.sqrt(variance);

    // Compute saturation and white-pixel proportion for document detection
    let saturationSum = 0;
    let whitePixelCount = 0;
    for (let i = 0; i < pixelData.length; i += 4) {
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
      saturationSum += sat;
      if (r > 200 && g > 200 && b > 200) whitePixelCount += 1;
    }
    const avgSaturation = saturationSum / totalPixels;
    const whiteProportion = whitePixelCount / totalPixels;

    let edgeCount = 0;
    let gradientSum = 0;
    let laplacianSum = 0;
    let laplacianSqSum = 0;
    let validKernelPixels = 0;

    for (let y = 1; y < sampleHeight - 1; y += 1) {
      for (let x = 1; x < sampleWidth - 1; x += 1) {
        const idx = y * sampleWidth + x;

        const topLeft = gray[idx - sampleWidth - 1];
        const top = gray[idx - sampleWidth];
        const topRight = gray[idx - sampleWidth + 1];
        const left = gray[idx - 1];
        const right = gray[idx + 1];
        const bottomLeft = gray[idx + sampleWidth - 1];
        const bottom = gray[idx + sampleWidth];
        const bottomRight = gray[idx + sampleWidth + 1];

        const gx = -topLeft - 2 * left - bottomLeft + topRight + 2 * right + bottomRight;
        const gy = -topLeft - 2 * top - topRight + bottomLeft + 2 * bottom + bottomRight;
        const gradient = Math.sqrt(gx * gx + gy * gy);

        gradientSum += gradient;
        if (gradient > 110) edgeCount += 1;

        const laplacian = Math.abs(4 * gray[idx] - left - right - top - bottom);
        laplacianSum += laplacian;
        laplacianSqSum += laplacian * laplacian;

        validKernelPixels += 1;
      }
    }

    const edgeDensity = (edgeCount / Math.max(validKernelPixels, 1)) * 100;
    const gradientMean = gradientSum / Math.max(validKernelPixels, 1);
    const laplacianMean = laplacianSum / Math.max(validKernelPixels, 1);
    const laplacianVariance =
      laplacianSqSum / Math.max(validKernelPixels, 1) - laplacianMean * laplacianMean;

    const minDimension = Math.min(width, height);
    const megaPixels = (width * height) / 1000000;

    const resolutionScore =
      normalizeRange(minDimension, 500, 1400) * 55 + normalizeRange(megaPixels, 0.4, 2.5) * 45;

    const exposureScore = 100 - clamp((Math.abs(avgBrightness - 155) / 120) * 100, 0, 100);
    const contrastScore = normalizeRange(contrastStd, 12, 65) * 100;
    const lightingScore = exposureScore * 0.65 + contrastScore * 0.35;

    const sharpnessScore =
      normalizeRange(laplacianVariance, 40, 1200) * 60 + normalizeRange(gradientMean, 8, 45) * 40;

    const textClarityScore = normalizeRange(edgeDensity, 1.5, 14) * 100;

    // Block only clearly non-document images: highly colorful photos with almost no white/light area.
    // Prescriptions may have colored letterheads or be photographed in warm light, so we use
    // an exclusion rule rather than a strict positive match.
    // Natural/scenic photos: avgSaturation > 0.32 and whiteProportion < 0.12
    // Prescriptions: typically avgSaturation < 0.25 OR whiteProportion > 0.15
    const likelyPrescription = !(avgSaturation > 0.32 && whiteProportion < 0.12);

    const checks = {
      resolutionOk: resolutionScore >= 40,
      brightnessOk: lightingScore >= 45,
      sharpnessOk: sharpnessScore >= 42,
      textClarityOk: textClarityScore >= 45,
    };

    const tips = [];
    if (!checks.resolutionOk)
      tips.push("Image resolution is low. Retake from closer distance and keep full page in frame.");
    if (!checks.brightnessOk && avgBrightness < 85)
      tips.push("Image appears dark. Use better lighting.");
    if (!checks.brightnessOk && avgBrightness > 205)
      tips.push("Image appears overexposed. Reduce flash/light reflection.");
    if (!checks.sharpnessOk)
      tips.push("Image seems blurry. Keep camera steady, tap to focus, and retake.");
    if (!checks.textClarityOk)
      tips.push("Handwriting/text edges are unclear. Capture from top view and avoid shadows.");

    if (tips.length === 0) {
      tips.push("Image quality looks good for OCR processing.");
    }

    let score = Math.round(
      clamp(
        resolutionScore * 0.2 + lightingScore * 0.28 + sharpnessScore * 0.27 + textClarityScore * 0.25,
        0,
        100
      )
    );

    if (textClarityScore > 70 && lightingScore > 60 && score < 55) {
      score = 55;
    }

    return {
      score,
      status: getQualityStatus(score),
      likelyPrescription,
      validationMessage: likelyPrescription
        ? ""
        : "This image does not look like a prescription document. Please upload a clear prescription image.",
      checks,
      tips,
      metrics: {
        width,
        height,
        brightness: Math.round(avgBrightness),
        contrast: Math.round(contrastStd),
        sharpness: Math.round(sharpnessScore),
        textClarity: Math.round(textClarityScore),
      },
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function UploadPrescriptions() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [qualityReport, setQualityReport] = useState(null);
  const [statusMsg, setStatusMsg] = useState("");

  const navigate = useNavigate();
  const location = useLocation();

  const STATUS_MESSAGES = [
    "Uploading image...",
    "AI is reading your prescription...",
    "Detecting medicines...",
    "Checking dosages...",
    "Almost ready...",
  ];
  const uploadMessage = location.state?.uploadMessage;

  useEffect(() => {
    if (!loading) {
      setProgress(0);
      setStatusMsg("");
      return;
    }
    let current = 0;
    const id = setInterval(() => {
      current += current < 40 ? 5 : current < 70 ? 3 : current < 90 ? 1.5 : current < 95 ? 0.5 : 0.2;
      if (current >= 99) current = 99;
      setProgress(Math.round(current));
    }, 200);
    // Cycle through status messages every 2.5s
    let msgIdx = 0;
    setStatusMsg(STATUS_MESSAGES[0]);
    const msgId = setInterval(() => {
      msgIdx = (msgIdx + 1) % STATUS_MESSAGES.length;
      setStatusMsg(STATUS_MESSAGES[msgIdx]);
    }, 2500);
    return () => { clearInterval(id); clearInterval(msgId); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      setSelectedFile(null);
      setPreviewUrl("");
      setQualityReport(null);
      return;
    }

    setError("");

    try {
      const report = await analyzeImageQuality(file);
      if (!report.likelyPrescription) {
        setError(report.validationMessage);
        setSelectedFile(null);
        setPreviewUrl("");
        setQualityReport(null);
        e.target.value = "";
        return;
      }

      setSelectedFile(file);
      const blobUrl = URL.createObjectURL(file);
      setPreviewUrl(blobUrl);
      setQualityReport(report);
    } catch (analysisError) {
      console.error("Quality analysis failed:", analysisError);
      setQualityReport(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setPreviewUrl("");
    setError("");
    setQualityReport(null);
  };

  const normalizeResult = (apiData) => {
    // Prefer Gemini AI analysis (clear readable text) over raw OCR
    const geminiText = apiData?.geminiAnalysis || "";
    const simpleText = apiData?.simpleEnglishText || apiData?.text || "";
    const cleanedText = apiData?.cleanedText || "";
    const originalText = apiData?.rawText || apiData?.raw || apiData?.extractedText || cleanedText || simpleText;
    
    // Use Gemini text as primary display, fallback to simpleText or cleaned
    const rawText = geminiText || simpleText || cleanedText || originalText;

    const medicinesFromApi = Array.isArray(apiData?.medicines)
      ? apiData.medicines.map((med) => ({
          name: med?.name || "Unknown medicine",
          dosage:
            med?.dosage ||
            [med?.strength, med?.frequency, med?.duration]
              .filter(Boolean)
              .join(" | ") ||
            "Not specified",
          frequency: med?.frequency || "As directed",
          duration: med?.duration || "As prescribed",
          instructions: med?.instructions || "",
        }))
      : [];

    // Parse medicines from Gemini text if API didn't detect any
    const medicines =
      medicinesFromApi.length > 0
        ? medicinesFromApi
        : parsePrescription(rawText);

    // Extract prescription info from backend or parse from Gemini text
    const prescriptionInfo = {
      doctorName: apiData?.doctorName || "",
      patientName: apiData?.patientName || "",
      prescriptionDate: apiData?.prescriptionDate || "",
      diagnosis: apiData?.diagnosis || "",
      additionalNotes: apiData?.additionalNotes || "",
    };

    // If backend didn't provide them, parse from Gemini text
    if (!prescriptionInfo.doctorName && geminiText) {
      const parsed = parsePrescriptionInfo(geminiText);
      prescriptionInfo.doctorName = parsed.doctor;
      prescriptionInfo.patientName = parsed.patient;
      prescriptionInfo.prescriptionDate = parsed.date;
      prescriptionInfo.diagnosis = parsed.diagnosis;
      prescriptionInfo.additionalNotes = parsed.additionalNotes;
    }

    return {
      raw: rawText,
      rawOriginal: originalText,
      geminiAnalysis: geminiText,
      processingMessage: apiData?.message || "",
      processingMode: apiData?.processingMode || (geminiText ? "ai_vision" : "ocr_only"),
      usedFallback: Boolean(apiData?.usedFallback),
      fallbackReason: apiData?.fallbackReason || "",
      medicines,
      ...prescriptionInfo,
      riskScore: apiData?.riskScore || null,
      risks: Array.isArray(apiData?.risks) ? apiData.risks : [],
      medicineExplanations: Array.isArray(apiData?.medicineExplanations)
        ? apiData.medicineExplanations
        : [],
      scheduleTimeline: Array.isArray(apiData?.scheduleTimeline) ? apiData.scheduleTimeline : [],
    };
  };

  const handleProcess = async () => {
    if (!selectedFile) {
      setError("Please upload a prescription image first.");
      return;
    }

    setLoading(true);
    setError("");

    // Convert file to data URL for processing page scanning animation
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result || "");
      reader.readAsDataURL(selectedFile);
    });
    if (dataUrl) {
      localStorage.setItem("prescriptionPreview", dataUrl);
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(apiUrl("/analyze"), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to process prescription image.");
      }

      const data = await res.json();
      const normalized = normalizeResult(data);
      const enrichedResult = {
        ...normalized,
        id: Date.now(),
        uploadedAt: new Date().toISOString(),
        fileName: selectedFile.name,
        previewUrl: dataUrl || "",
        ownerEmail: getAuthSession()?.email || "",
      };


      const history = JSON.parse(localStorage.getItem("prescriptionHistory")) || [];
      const updatedHistory = [enrichedResult, ...history].slice(0, 20);

      localStorage.setItem("extractedText", JSON.stringify([enrichedResult]));
      localStorage.setItem("prescriptionHistory", JSON.stringify(updatedHistory));
      markPrescriptionUploaded();

      setProgress(100);
      navigate("/results", { replace: true });
    } catch (err) {
      console.error("Upload error:", err);
      setError("Could not process image. Please check backend and try again.");
    }

    setLoading(false);
  };

  return (
    <div className="upload-container">
      <h1 className="upload-title">Upload Prescription</h1>

      <div className="upload-box">
        {uploadMessage ? (
          <p
            style={{
              marginBottom: "14px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "#fff4e5",
              color: "#9a3412",
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {uploadMessage}
          </p>
        ) : null}

        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="file-input"
          disabled={!!selectedFile || loading}
        />

        {selectedFile && <p className="file-count">Selected: {selectedFile.name}</p>}

        {previewUrl && (
          <div className="upload-preview-wrap">
            <img src={previewUrl} alt="Prescription preview" className="upload-preview" />
            <button
              type="button"
              onClick={clearSelectedFile}
              className="clear-file-btn"
              disabled={loading}
            >
              Remove Image
            </button>
          </div>
        )}

        {qualityReport && (
          <div className="quality-card">
            <div className="quality-header-row">
              <p className="quality-title">Prescription Quality Check</p>
              <span className={`quality-badge ${qualityReport.status.toLowerCase()}`}>
                {qualityReport.status} ({qualityReport.score}/100)
              </span>
            </div>

            <p className="quality-meta">
              Resolution: {qualityReport.metrics.width} × {qualityReport.metrics.height}
            </p>

            <ul className="quality-check-list">
              <li className={qualityReport.checks.resolutionOk ? "ok" : "warn"}>
                {qualityReport.checks.resolutionOk ? "✓" : "⚠"} Resolution quality
              </li>
              <li className={qualityReport.checks.brightnessOk ? "ok" : "warn"}>
                {qualityReport.checks.brightnessOk ? "✓" : "⚠"} Lighting quality
              </li>
              <li className={qualityReport.checks.sharpnessOk ? "ok" : "warn"}>
                {qualityReport.checks.sharpnessOk ? "✓" : "⚠"} Sharpness quality
              </li>
              <li className={qualityReport.checks.textClarityOk ? "ok" : "warn"}>
                {qualityReport.checks.textClarityOk ? "✓" : "⚠"} Text clarity quality
              </li>
            </ul>

            {qualityReport.tips.length > 0 && (
              <ul className="quality-tips-list">
                {qualityReport.tips.map((tip, index) => (
                  <li key={index}>{tip}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="upload-error">{error}</p>}

        <button
          onClick={handleProcess}
          disabled={loading || !selectedFile}
          className="upload-btn"
        >
          {loading ? (
            <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", lineHeight: 1.3 }}>
              <span>{statusMsg || `Analyzing...`} {progress}%</span>
            </span>
          ) : "Analyze Prescription"}
        </button>
      </div>
    </div>
  );
}