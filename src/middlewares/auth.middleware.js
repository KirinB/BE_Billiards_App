import { AuthService } from "../services/auth.service.js";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

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

    // 🔄 refresh access token nếu cần
    if (tokenExpired) {
      const newAccessToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
        expiresIn: "5m",
      });

      res.setHeader("x-access-token", newAccessToken);
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
