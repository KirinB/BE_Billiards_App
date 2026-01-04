import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import roomRoutes from "./routes/room.route.js";

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use("/api/rooms", roomRoutes);
app.get("/ping", (req, res) => {
  res.json({
    message: "pong",
    time: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);

  try {
    await prisma.$connect();
    console.log("✅ Connected to PostgreSQL successfully!");
  } catch (err) {
    console.error("❌ Failed to connect to PostgreSQL:", err);
    process.exit(1);
  }
});
