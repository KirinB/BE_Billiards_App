import { AuthService } from "../services/auth.service.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES_IN || "10s";

// Helper để tạo token mới và gắn vào header
const attachNewToken = (res, userId) => {
  const newAccessToken = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES,
  });
  res.setHeader("x-access-token", newAccessToken);
  // Quan trọng: Phải expose header này ra thì FE mới đọc được
  res.setHeader("Access-Control-Expose-Headers", "x-access-token");
  return newAccessToken;
};

// 1. Dùng cho các route BẮT BUỘC login (Profile, Join Room...)
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;
    const sessionToken = req.cookies.session;

    const { user, tokenExpired } = await AuthService.authenticate({
      accessToken,
      sessionToken,
    });

    if (tokenExpired && user) {
      attachNewToken(res, user.id);
    }

    req.user = user;
    next();
  } catch (err) {
    next(err); // Ném lỗi 401/403 nếu không có user
  }
};

// 2. Dùng cho các route KHÔNG BẮT BUỘC (Create Room, Home...)
export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;
    const sessionToken = req.cookies.session;

    if (!accessToken && !sessionToken) {
      req.user = null;
      return next();
    }

    try {
      const { user, tokenExpired } = await AuthService.authenticate({
        accessToken,
        sessionToken,
      });

      if (tokenExpired && user) {
        attachNewToken(res, user.id);
      }
      req.user = user;
    } catch (authError) {
      req.user = null; // Token lỗi hoặc hết hạn session thì coi như guest
    }

    next();
  } catch (err) {
    req.user = null;
    next();
  }
};
