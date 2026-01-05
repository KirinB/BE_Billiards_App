import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import roomRoutes from "./routes/room.route.js";

const app = express();
const prisma = new PrismaClient();

// Kiểm tra môi trường (mặc định là development nếu không có biến NODE_ENV)
const isProduction = process.env.NODE_ENV === "production";

app.use(cors());
app.use(express.json());

// Điều hướng Routes
app.use("/api/rooms", roomRoutes);

// Route kiểm tra sức khỏe server
app.get("/api/ping", (req, res) => {
  res.json({
    status: "active",
    env: process.env.NODE_ENV,
    time: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  // Thay đổi thông báo log tùy môi trường
  if (isProduction) {
    console.log(
      `🚀 PRODUCTION Server is running at: https://bida.uynghi.com/api/`
    );
  } else {
    console.log(
      `🛠️  DEVELOPMENT Server is running at: http://localhost:${PORT}`
    );
  }

  try {
    await prisma.$connect();
    console.log("✅ Database Connection: SUCCESS");
  } catch (err) {
    console.error("❌ Database Connection: FAILED");
    console.error(err);
    process.exit(1);
  }
});
