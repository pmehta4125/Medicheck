# Backend Deployment Env Checklist

Set these environment variables in your backend host and, for local IntelliJ/terminal runs, in the process that starts Spring Boot.

Required:
- `DATABASE_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `CORS_ALLOWED_ORIGIN_PATTERNS`

Strongly recommended:
- `GEMINI_API_KEY_BACKUP`
- `HUGGINGFACE_API_TOKEN`
- `GOOGLE_VISION_API_KEY`

Examples:
- `CORS_ALLOWED_ORIGIN_PATTERNS=https://your-app.vercel.app,https://your-preview.vercel.app,http://localhost:5173`
- `PORT=8080`

Frontend host env:
- `VITE_API_URL=https://your-backend-host.example.com`

Local PowerShell run example:
```powershell
$env:GEMINI_API_KEY="your-primary-key"
$env:GEMINI_API_KEY_BACKUP="your-backup-key"
$env:CORS_ALLOWED_ORIGIN_PATTERNS="http://localhost:5173"
Set-Location "c:\Users\HP\OneDrive\Desktop\React\prescription-reader\Medicheck\Medicheck_backend"
.\mvnw.cmd spring-boot:run
```

Notes:
- Do not commit real secret values into source control.
- Restart the backend after changing environment variables.
- The Docker image now installs Tesseract so OCR fallback can still work if AI providers fail.
