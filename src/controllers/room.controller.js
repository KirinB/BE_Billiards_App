import { RoomService } from "../services/room.service.js";

export const RoomController = {
  async getAll(req, res) {
    try {
      const { roomId } = req.query; // Lấy giá trị sau dấu ?roomId=

      if (roomId) {
        // TRƯỜNG HỢP 1: Có truyền ID (?roomId=abc) -> Trả về chi tiết 1 phòng
        const room = await RoomService.getRoomDetail(roomId);
        if (!room)
          return res.status(404).json({ message: "Không tìm thấy phòng" });
        return res.json(room);
      }

      // TRƯỜNG HỢP 2: Không truyền ID -> Trả về danh sách tất cả các phòng
      const rooms = await RoomService.getAllRooms();
      return res.json(rooms);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async create(req, res) {
    try {
      const room = await RoomService.createRoom(req.body);
      res.status(201).json(room);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async applyScore(req, res) {
    const { roomId } = req.params;
    const { pin, ...scoreData } = req.body;

    try {
      // 1. Kiểm tra PIN trước khi cho phép ghi điểm
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (room.pin !== pin) {
        return res.status(403).json({ message: "Mã PIN không đúng!" });
      }

      // 2. Gọi service xử lý
      const result = await RoomService.updateScoreDenDiem(roomId, scoreData);
      res.json({ message: "Cập nhật thành công", result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const { pin } = req.query;
      console.log("ID nhận được:", id);

      const result = await RoomService.getRoomDetail(id, pin);
      return res.json({
        message: "Lấy thành công dữ liệu",
        room: result,
      });
    } catch (error) {
      console.error("Lỗi Controller:", error.message);
      // Trả về error.status nếu có (403), không thì mặc định 500
      const status = error.status || 500;
      return res.status(status).json({ message: error.message });
    }
  },

  async updateScore(req, res) {
    try {
      const { roomId, pin, currentPlayerId, loserIds, events, winnerId } =
        req.body;

      if (!roomId || !pin) {
        return res.status(400).json({ message: "Thiếu roomId hoặc mã PIN" });
      }

      // Gọi service xử lý chung
      const result = await RoomService.calculateAndApplyScore(roomId, {
        pin,
        currentPlayerId, // dùng cho Điểm Đến
        loserIds, // dùng cho Điểm Đến
        events, // dùng cho Điểm Đến
        winnerId, // dùng cho 1vs1
      });

      const io = req.app.get("socketio");
      // Gửi dữ liệu phòng mới nhất cho mọi người trong roomId
      // result thường chứa thông tin room sau khi update
      io.to(roomId.toString()).emit("room_updated", result);

      return res.status(200).json({
        message: "Cập nhật thành công",
        data: result,
      });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  },

  async undoScore(req, res) {
    try {
      const { roomId, historyId, pin } = req.body;
      if (!roomId || !historyId || !pin) {
        return res.status(400).json({ message: "Thiếu thông tin hoàn tác" });
      }

      // Gọi service xử lý logic hoàn trả điểm
      const result = await RoomService.undoScore(roomId, { historyId, pin });

      const io = req.app.get("socketio");
      io.to(roomId.toString()).emit("room_updated", result);

      return res.status(200).json({
        message: "Hoàn tác thành công",
        data: result,
      });
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  },

  async finish(req, res) {
    try {
      const { roomId } = req.params;
      const { pin } = req.body;

      if (!pin) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập mã PIN để kết thúc ván" });
      }

      const result = await RoomService.finishRoom(roomId, pin);

      const io = req.app.get("socketio");
      io.to(roomId.toString()).emit("room_finished", { roomId });

      return res.status(200).json({
        message: "Ván đấu đã kết thúc thành công",
        data: result,
      });
    } catch (error) {
      // Xử lý lỗi sai PIN hoặc không tìm thấy phòng
      const status = error.message.includes("PIN") ? 403 : 400;
      return res.status(status).json({ message: error.message });
    }
  },
};
