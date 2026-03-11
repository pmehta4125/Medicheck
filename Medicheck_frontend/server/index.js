import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
dotenv.config();
import process from "process";

const app = express();
app.use(cors());
app.use(express.json());

// Multer setup
const upload = multer({ dest: "uploads/" });

// Gemini Init
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ----------- ANALYZE PRESCRIPTION ROUTE -----------
app.post("/analyze", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No file uploaded" });

    const file = req.file;
    const imageBuffer = fs.readFileSync(file.path);

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });

    const prompt = `
      You are a medical OCR assistant. Extract ONLY medicine names and dosages.

      Return STRICT JSON:

      {
        "medicines": [
          { "name": "Paracetamol", "dosage": "500 mg" }
        ]
      }
    `;

    const aiResult = await model.generateContent([
      {
        inlineData: {
          data: imageBuffer.toString("base64"),
          mimeType: file.mimetype,
        },
      },
      { text: prompt },
    ]);

    const responseText = aiResult.response.text();

    let json;
    try {
      json = JSON.parse(responseText);
    } catch {
      json = { medicines: [], raw: responseText };
    }

    // Remove temporary file
    fs.unlinkSync(file.path);

    res.json(json);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


// ---------------- START SERVER ----------------
app.listen(5000, () => console.log("Server running on port 5000"));
