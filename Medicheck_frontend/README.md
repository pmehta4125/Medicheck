# Medicheck

Medicheck is a digital prescription reader and medicine verification system.

It allows patients to upload prescription images provided by doctors. After upload, the application:
- extracts and converts prescription content into readable text,
- identifies and lists medicines from the prescription,
- extracts dosage-related information (for example: strength, frequency, and duration when available),
- compares the extracted medicine list with medicines dispensed by the chemist,
- helps users verify whether the given medicines match the prescribed ones.

## Project Scope

- **Frontend (this repository):** React-based user interface for upload, processing, and result display.
- **Backend (separate service):** Built in IntelliJ IDEA, responsible for OCR/text extraction, medicine parsing, and verification logic.

## App Features

- User authentication flow (signup/login/logout) so patients can securely access their account.
- Prescription upload and processing in an app-like user experience.
- Structured output showing medicine name and dosage details.
- Verification view to compare prescribed medicines with chemist-dispensed medicines.

## Core Workflow

1. User signs up or logs in.
2. User uploads a prescription image.
3. Image is processed and converted to text.
4. Prescribed medicines and dosage details are extracted from the text.
5. Extracted list is compared with chemist-provided medicines.
6. User receives verification results in a readable format.
