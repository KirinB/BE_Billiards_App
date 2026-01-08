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
      const room = await RoomService.createRoom(req.body);
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
};
