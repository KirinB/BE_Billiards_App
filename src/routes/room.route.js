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
router.post("/:roomId/claim", optionalAuthenticate, RoomController.claim);
// Endpoint mới cho BIDA_BAI
router.post("/:roomId/draw", optionalAuthenticate, RoomController.drawCard);
router.post("/:roomId/start", optionalAuthenticate, RoomController.start);
router.post("/:roomId/discard", optionalAuthenticate, RoomController.discard);
router.post("/:roomId/reset", optionalAuthenticate, RoomController.reset);
export default router;
