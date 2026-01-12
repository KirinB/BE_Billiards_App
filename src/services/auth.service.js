import { prisma } from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sanitizeUser } from "../utils/sanitizeUser.js";

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES_IN || "10s";
const SESSION_DAYS = parseInt(process.env.SESSION_DAYS) || 7;

export const AuthService = {
  async register({ email, username, password }) {
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw new Error("Email đã tồn tại");

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, username, password: hashed },
    });

    return sanitizeUser(user);
  },

  async login({ email, password }) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("Email hoặc mật khẩu không đúng");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error("Email hoặc mật khẩu không đúng");

    // 🔑 Access Token
    const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES,
    });

    // 🔐 Session Token (chỉ backend biết)
    const sessionToken = crypto.randomBytes(32).toString("hex");

    await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    return { user: sanitizeUser(user), accessToken, sessionToken };
  },

  async logout({ sessionToken }) {
    await prisma.session.deleteMany({
      where: { token: sessionToken },
    });
  },

  async authenticate({ accessToken, sessionToken }) {
    if (accessToken) {
      try {
        const payload = jwt.verify(accessToken, JWT_SECRET);
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
        });
        if (user) {
          return { user: sanitizeUser(user), tokenExpired: false };
        }
      } catch (err) {
        if (err.name !== "TokenExpiredError") throw err;
      }
    }

    if (sessionToken) {
      const session = await prisma.session.findFirst({
        where: {
          token: sessionToken,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (!session) throw new Error("Session expired");

      return { user: sanitizeUser(session.user), tokenExpired: true };
    }

    throw new Error("Unauthorized");
  },

  async getGameHistory(userId) {
    return await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true,
        players: {
          orderBy: { createdAt: "desc" },
          include: {
            room: {
              include: {
                players: true, // Để xem những ai khác đã chơi cùng
              },
            },
          },
        },
      },
    });
  },
};
