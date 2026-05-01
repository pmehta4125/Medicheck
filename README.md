# 🏥 MediCheck – AI Prescription Verification System

## 🚀 Overview

MediCheck is a full-stack **AI-powered healthcare application** that analyzes medical prescriptions, extracts medicines, detects risks, and improves patient safety using advanced AI models.

---

## ✨ Features

* 📄 Upload prescription images
* 🤖 AI-based medicine extraction
* 💊 Medicine verification & comparison
* ⚠️ Safety warnings & risk detection
* ⏰ Medicine reminders
* 🔔 Notifications system
* 👤 User authentication (Login/Signup/Google)
* 📊 Admin dashboard
* 🔐 Secure API & JWT authentication

---

## 🛠️ Tech Stack

### 🔹 Frontend

* React, CSS, React Router
* Google OAuth (Authentication)
* localStorage / sessionStorage

### 🔹 Backend

* Spring Boot (Java)
* PostgreSQL / MySQL
* JWT Authentication

### 🔹 AI & OCR

* Google Gemini AI (Primary model)
* Hugging Face (Fallback AI)
* Tesseract OCR
* Google Vision API

---

## ⚙️ How It Works

1. User uploads prescription image
2. AI (Gemini) analyzes and extracts medicines
3. If needed → fallback AI/OCR models are used
4. System verifies medicines and detects risks
5. Results displayed with warnings and suggestions

---

## 🔐 Authentication

* Email/Password login (JWT-based)
* Google OAuth login
* Guest mode supported

---

## 📂 Project Structure (Backend)

* **Controller** → API handling
* **Service** → Business logic
* **Repository** → Database operations
* **Model** → Data structure
* **Security** → JWT & filters
* **Config** → App configuration

---

## 🔄 AI Processing Flow

1. Gemini AI (Primary analysis)
2. Hugging Face (Fallback)
3. OCR (Tesseract / Google Vision)
4. Final structured output

---


---



## 🌍 Deployment

* Frontend: Vercel
* Backend: Render

---

## 🎯 Purpose

To reduce medical errors and provide **AI-assisted prescription verification** for safer healthcare decisions.

---

## 🔐 Security

* Password hashing (BCrypt)
* JWT authentication
* Secure API handling

---

## 📌 Future Improvements

* Real-time doctor consultation
* Drug interaction database
* Mobile application
* Push notifications

---

## 👨‍💻 Developed By

**MediCheck Team**

---

## 📌 Final Summary

MediCheck is a **secure, scalable, AI-driven full-stack system** that combines React frontend, Spring Boot backend, and advanced AI models (Gemini + OCR) to automate prescription analysis and improve patient safety.
