import { RoomService } from "../services/room.service.js";
import { success } from "../middlewares/success.middleware.js";
import { AppError } from "../utils/AppError.js";
import ensureRoomNotFinished from "../helpers/ensureRoomNotFinished.js";

export const RoomController = {
  async getAll(req, res, next) {
    try {
      const { roomId } = req.query;

      if (roomId) {
        const room = await RoomService.getRoomDetail(roomId);
        if (!room) throw new AppError("Không tìm thấy phòng", 404);
        return success(res, room, "Lấy phòng thành công");
      }

      const rooms = await RoomService.getAllRooms();
      return success(res, rooms, "Lấy danh sách phòng thành công");
    } catch (err) {
      next(err);
    }
  },

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const { pin } = req.query;

      const room = await RoomService.getRoomDetail(id, pin);
      if (!room) throw new AppError("Không tìm thấy phòng", 404);

      return success(res, room, "Lấy dữ liệu phòng thành công");
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      // Lấy userId từ user đã được optionalAuthenticate giải mã (nếu có)
      const creatorId = req.user?.id || null;

      const room = await RoomService.createRoom({
        ...req.body,
        creatorId,
      });

      return success(res, room, "Tạo phòng thành công", 201);
    } catch (err) {
      next(new AppError(err.message, 400));
    }
  },

  async updateScore(req, res, next) {
    try {
      const { roomId, pin, currentPlayerId, loserIds, events, winnerId } =
        req.body;

      if (!roomId || !pin) throw new AppError("Thiếu roomId hoặc mã PIN", 400);

      // 🔥 CHẶN PHÒNG ĐÃ KẾT THÚC
      await ensureRoomNotFinished(roomId);

      const result = await RoomService.calculateAndApplyScore(roomId, {
        pin,
        currentPlayerId,
        loserIds,
        events,
        winnerId,
      });

      const io = req.app.get("socketio");
      io.to(roomId.toString()).emit("room_updated", result);

      return success(res, result, "Cập nhật điểm thành công");
    } catch (err) {
      next(err);
    }
  },

  async undoScore(req, res, next) {
    try {
      const { roomId, historyId, pin } = req.body;

      if (!roomId || !historyId || !pin)
        throw new AppError("Thiếu thông tin hoàn tác", 400);

      // 🔥 CHẶN PHÒNG ĐÃ KẾT THÚC
      await ensureRoomNotFinished(roomId);

      const result = await RoomService.undoScore(roomId, {
        historyId,
        pin,
      });

      const io = req.app.get("socketio");
      io.to(roomId.toString()).emit("room_updated", result);

      return success(res, result, "Hoàn tác thành công");
    } catch (err) {
      next(err);
    }
  },

  async finish(req, res, next) {
    try {
      const { roomId } = req.params;
      const { pin } = req.body;

      if (!pin) throw new AppError("Vui lòng nhập mã PIN", 400);

      // 🔥 KHÔNG CHO FINISH LẠI
      await ensureRoomNotFinished(roomId);

      const result = await RoomService.finishRoom(roomId, pin);

      const io = req.app.get("socketio");
      io.to(roomId.toString()).emit("room_finished", { roomId });

      return success(res, result, "Kết thúc ván đấu thành công");
    } catch (err) {
      next(err);
    }
  },

  async claim(req, res, next) {
    try {
      const { roomId } = req.params;
      const { playerId } = req.body;
      const user = req.user;
      if (!playerId) throw new AppError("Thiếu playerId", 400);

      const result = await RoomService.claimPlayer(roomId, {
        playerId,
        userId: user.id,
        username: user.username,
      });

      const io = req.app.get("socketio");
      io.to(roomId.toString()).emit("room_updated", result);

      return success(res, result, "Nhận nhân vật thành công");
    } catch (err) {
      next(err);
    }
  },

  async drawCard(req, res, next) {
    try {
      const { roomId } = req.params;
      const { playerId } = req.body;
      const user = req.user; // Đã qua middleware authenticate

      if (!playerId) throw new AppError("Thiếu playerId", 400);

      const result = await RoomService.drawCard(roomId, {
        playerId,
        userId: user.id,
      });

      const io = req.app.get("socketio");
      io.to(roomId.toString()).emit("room_updated", result);

      return success(res, result, "Rút bài thành công");
    } catch (err) {
      next(err);
    }
  },

  // Bắt đầu game
  async start(req, res, next) {
    try {
      const { roomId } = req.params;
      const { pin } = req.body;
      if (!pin) throw new AppError("Vui lòng nhập mã PIN để bắt đầu", 400);

      const result = await RoomService.startGame(roomId, { pin });

      const io = req.app.get("socketio");
      io.to(roomId.toString()).emit("room_updated", result);

      return success(res, result, "Ván đấu bắt đầu!");
    } catch (err) {
      next(err);
    }
  },

  // Đánh trúng bi - Bỏ bài
  async discard(req, res, next) {
    try {
      const { roomId } = req.params;
      const { playerId, ballValue } = req.body;
      const user = req.user;

      if (!playerId || !ballValue)
        throw new AppError("Thiếu thông tin bỏ bài", 400);

      const result = await RoomService.discardCard(roomId, {
        playerId,
        userId: user.id,
        ballValue,
      });

      const io = req.app.get("socketio");
      io.to(roomId.toString()).emit("room_updated", result);

      return success(res, result, `Đã bỏ lá bài số ${ballValue}`);
    } catch (err) {
      next(err);
    }
  },

  async reset(req, res, next) {
    try {
      const { roomId } = req.params;
      const { pin } = req.body;
      const user = req.user;

      if (!pin)
        throw new AppError("Vui lòng nhập mã PIN để reset ván đấu", 400);

      const result = await RoomService.resetGame(roomId, {
        pin,
        userId: user.id,
      });

      const io = req.app.get("socketio");
      io.to(roomId.toString()).emit("room_updated", result);

      return success(res, result, "Đã reset ván đấu, mời bắt đầu lại!");
    } catch (err) {
      next(err);
    }
  },
};
