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
        secure: true,
        sameSite: "none",
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
      const userId = req.user.id;
      const profile = await AuthService.getGameHistory(userId);

      if (!profile) throw new AppError("Không tìm thấy người dùng", 404);

      return success(res, profile, "Lấy lịch sử đấu thành công");
    } catch (err) {
      next(err);
    }
  },

  async googleCallback(req, res, next) {
    try {
      const { idToken } = req.body; // Token này do Frontend gửi lên sau khi user login Google
      const { user, accessToken, sessionToken } = await AuthService.googleLogin(
        idToken
      );

      // Set cookie y hệt như hàm login
      res.cookie("session", sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return success(
        res,
        { userId: user.id, username: user.username, accessToken },
        "Đăng nhập Google thành công"
      );
    } catch (err) {
      next(new AppError(err.message, 400));
    }
  },

  async facebookCallback(req, res, next) {
    try {
      const { accessToken: fbAccessToken } = req.body; // Token từ FE gửi lên

      const { user, accessToken, sessionToken } =
        await AuthService.facebookLogin(fbAccessToken);

      // 🔐 SET HTTP-ONLY COOKIE (Đồng bộ với các hàm login khác)
      res.cookie("session", sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return success(
        res,
        {
          userId: user.id,
          username: user.username,
          accessToken,
        },
        "Đăng nhập Facebook thành công"
      );
    } catch (err) {
      next(new AppError(err.message, 400));
    }
  },
};
