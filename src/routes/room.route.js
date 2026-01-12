// src/routes/room.route.js
import express from "express";
import { RoomController } from "../controllers/room.controller.js";
import {
  authenticate,
  optionalAuthenticate,
} from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", RoomController.getAll);
router.post("/", optionalAuthenticate, RoomController.create);
// router.post("/:roomId/score", RoomController.applyScore);
router.get("/:id", RoomController.getById);
router.patch("/", RoomController.updateScore);
router.delete("/undo", RoomController.undoScore);
router.post("/:roomId/finish", RoomController.finish);
router.post("/:roomId/claim", authenticate, RoomController.claim);

export default router;
