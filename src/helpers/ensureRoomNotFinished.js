import { RoomService } from "../services/room.service.js";
import { AppError } from "../utils/AppError.js";

async function ensureRoomNotFinished(roomId) {
  const room = await RoomService.getRoomStatus(roomId);
  if (!room) throw new AppError("Không tìm thấy phòng", 404);

  if (room.isFinished) {
    throw new AppError("Ván đấu đã kết thúc", 400);
  }
}
export default ensureRoomNotFinished;
