export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  // Log lỗi ra server (PM2 logs)
  console.error("🔥 ERROR:", {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? "Internal Server Error" : err.message,
  });
};
