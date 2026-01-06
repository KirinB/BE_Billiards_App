import express from "express";
import cors from "cors";
import { createServer } from "http"; // Thêm cái này
import { Server } from "socket.io"; // Thêm cái này
import { PrismaClient } from "@prisma/client";
import roomRoutes from "./routes/room.route.js";

const app = express();
const prisma = new PrismaClient();
const isProduction = process.env.NODE_ENV === "production";

// 1. Cấu hình CORS cho Express
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5173/",
  "https://bida.uynghi.com",
  "https://bida.uynghi.com/",
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

app.use(express.json());

// 2. Tạo HTTP Server và gắn Socket.io
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("socketio", io);

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("join_room", (roomId) => {
    socket.join(roomId.toString());
    console.log(`User ${socket.id} joined room: ${roomId}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected");
  });
});

// Điều hướng Routes
app.use("/api/rooms", roomRoutes);

app.get("/api/ping", (req, res) => {
  res.json({
    status: "active",
    env: process.env.NODE_ENV,
    time: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, async () => {
  if (isProduction) {
    console.log(`🚀 PRODUCTION Server: https://bida.uynghi.com/api/`);
  } else {
    console.log(`🛠️ DEVELOPMENT Server: http://localhost:${PORT}`);
  }

  try {
    await prisma.$connect();
    console.log("✅ Database Connection: SUCCESS");
  } catch (err) {
    console.error("❌ Database Connection: FAILED");
    process.exit(1);
  }
});
