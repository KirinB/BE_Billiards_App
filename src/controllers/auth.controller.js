import { AuthService } from "../services/auth.service.js";
import { success } from "../middlewares/success.middleware.js";
import { AppError } from "../utils/AppError.js";

export const AuthController = {
  async register(req, res, next) {
    try {
      const { email, username, password } = req.body;
      const user = await AuthService.register({ email, username, password });

      return success(res, { userId: user.id }, "Đăng ký thành công", 201);
    } catch (err) {
      next(new AppError(err.message, 400));
    }
  },

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const { user, accessToken, sessionToken } = await AuthService.login({
        email,
        password,
      });

      // 🔐 SET HTTP-ONLY COOKIE
      res.cookie("session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return success(
        res,
        {
          userId: user.id,
          username: user.username,
          accessToken,
        },
        "Đăng nhập thành công"
      );
    } catch (err) {
      next(new AppError(err.message, 400));
    }
  },

  async logout(req, res, next) {
    try {
      const sessionToken = req.cookies.session;
      if (sessionToken) {
        await AuthService.logout({ sessionToken });
      }

      res.clearCookie("session");
      return success(res, true, "Đăng xuất thành công");
    } catch (err) {
      next(new AppError(err.message, 400));
    }
  },

  async profile(req, res, next) {
    try {
      return success(res, { user: req.user }, "Thông tin người dùng");
    } catch (err) {
      next(err);
    }
  },
};
