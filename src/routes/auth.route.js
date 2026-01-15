import express from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", AuthController.register);
router.post("/login", AuthController.login);
router.post("/logout", AuthController.logout);
router.get("/profile", authenticate, AuthController.profile);
router.post("/google", AuthController.googleCallback);
router.post("/facebook", AuthController.facebookCallback);

export default router;
