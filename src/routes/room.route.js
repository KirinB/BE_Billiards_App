// src/routes/room.route.js
import express from "express";
import { RoomController } from "../controllers/room.controller.js";

const router = express.Router();

router.get("/", RoomController.getAll);
router.post("/", RoomController.create);
// router.post("/:roomId/score", RoomController.applyScore);
router.get("/:roomId", RoomController.getById);
router.patch("/", RoomController.updateScore);
router.delete("/undo", RoomController.undoScore);
router.post("/:roomId/finish", RoomController.finish);
export default router;
