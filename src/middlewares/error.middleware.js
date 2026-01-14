// src/middlewares/error.middleware.js

export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message;

  // 1. Xử lý các lỗi đặc thù từ thư viện JsonWebToken
  if (err.name === "JsonWebTokenError") {
    // Lỗi sai chữ ký (invalid signature), token bị chỉnh sửa...
    statusCode = 401;
    message = "Phiên làm việc không hợp lệ (Token invalid)";
  } else if (err.name === "TokenExpiredError") {
    // Lỗi token hết hạn
    statusCode = 401;
    message = "Phiên làm việc đã hết hạn, vui lòng đăng nhập lại";
  } else if (err.name === "NotBeforeError") {
    statusCode = 401;
    message = "Token chưa đến thời điểm sử dụng";
  }

  // 2. Log lỗi chi tiết ra console để Debug (PM2 logs)
  console.error("🔥 ERROR LOG:", {
    type: err.name,
    message: err.message,
    statusCode: statusCode,
    path: req.originalUrl,
    method: req.method,
    // stack: err.stack, // Bật lên nếu bạn cần xem chi tiết dòng bị lỗi
  });

  // 3. Trả về cho Client
  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500 ? "Lỗi hệ thống (Internal Server Error)" : message,
  });
};
