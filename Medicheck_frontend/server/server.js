import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./db.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();
connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// ROUTES
app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("MediCheck Backend Running ✔");
});

app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});