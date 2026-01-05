import { prisma } from "../db.js";

export const RoomService = {
  // 1. Lấy danh sách phòng cho trang chủ (ẩn PIN)
  async getAllRooms() {
    return await prisma.room.findMany({
      where: {
        isFinished: false,
      },
      select: { id: true, name: true, type: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
  },

  // 2. Tạo phòng mới kèm người chơi
  async createRoom(data) {
    const { name, pin, type, playerNames, valBi3, valBi6, valBi9 } = data;

    if (!playerNames || !Array.isArray(playerNames) || playerNames.length < 2) {
      throw new Error("Phòng phải có ít nhất 2 người chơi");
    }

    if (type === "BIDA_1VS1" && playerNames.length !== 2) {
      throw new Error("Chế độ 1vs1 phải có đúng 2 người chơi");
    }

    const isDiemDen = type === "BIDA_DIEM_DEN";

    const roomData = {
      name,
      pin: String(pin),
      type,
      isFinished: false,
      valBi3: isDiemDen ? valBi3 ?? 1 : 0,
      valBi6: isDiemDen ? valBi6 ?? 2 : 0,
      valBi9: isDiemDen ? valBi9 ?? 3 : 0,
      players: {
        create: playerNames
          .filter((n) => n && n.trim() !== "")
          .map((n) => ({ name: n.trim(), score: 0 })),
      },
    };

    return await prisma.room.create({
      data: roomData,
      include: {
        players: true,
        history: { take: 50, orderBy: { createdAt: "desc" } },
      },
    });
  },

  // 3. Lấy chi tiết phòng (Dùng +roomId)
  async getRoomDetail(roomId) {
    const room = await prisma.room.findUnique({
      where: { id: +roomId }, // Ép kiểu số
      include: {
        players: { orderBy: { id: "asc" } },
        history: {
          take: 50,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!room) return null;
    return room;
  },

  // 4. Tính toán và áp dụng điểm
  async calculateAndApplyScore(roomId, data) {
    const { pin, currentPlayerId, loserIds, events, winnerId } = data;

    // Ép kiểu ID chính
    const numericRoomId = +roomId;

    const room = await prisma.room.findUnique({
      where: { id: numericRoomId },
      include: { players: true },
    });

    if (!room) throw new Error("Phòng không tồn tại");
    if (room.pin !== String(pin)) throw new Error("Mã PIN không chính xác");

    let updateOps = [];
    let logData = {};

    if (room.type === "BIDA_DIEM_DEN") {
      const pointsPerLoser = events.reduce((sum, ev) => {
        const val =
          ev.bi === 3 ? room.valBi3 : ev.bi === 6 ? room.valBi6 : room.valBi9;
        return sum + val * ev.count;
      }, 0);
      const totalEarned = pointsPerLoser * loserIds.length;

      updateOps = [
        prisma.player.update({
          where: { id: +currentPlayerId }, // Ép kiểu số
          data: { score: { increment: totalEarned } },
        }),
        ...loserIds.map((id) =>
          prisma.player.update({
            where: { id: +id }, // Ép kiểu số
            data: { score: { decrement: pointsPerLoser } },
          })
        ),
      ];

      logData = {
        type: "DIEM_DEN",
        totalEarned,
        pointsPerLoser,
        currentPlayerId: +currentPlayerId, // Lưu dưới dạng số trong JSON log
        loserIds: loserIds.map((id) => +id), // Lưu danh sách số
        events,
      };
    } else {
      // Logic cho BIDA_1VS1
      updateOps = [
        prisma.player.update({
          where: { id: +winnerId }, // Ép kiểu số
          data: { score: { increment: 1 } },
        }),
      ];
      logData = { type: "1VS1", winnerId: +winnerId };
    }

    return await prisma.$transaction(async (tx) => {
      await Promise.all(updateOps);
      await tx.history.create({
        data: {
          roomId: numericRoomId, // Đã được ép kiểu ở trên
          content:
            room.type === "BIDA_DIEM_DEN" ? "Ghi điểm bi" : "Thắng ván mới",
          rawLog: logData,
        },
      });

      return await tx.room.findUnique({
        where: { id: numericRoomId },
        include: {
          players: { orderBy: { id: "asc" } },
          history: {
            take: 50,
            orderBy: { createdAt: "desc" },
          },
        },
      });
    });
  },

  // 5. Hoàn tác điểm số (Undo)
  async undoScore(roomId, { historyId, pin }) {
    const numericRoomId = +roomId;

    const room = await prisma.room.findUnique({
      where: { id: numericRoomId },
      include: { history: { where: { id: +historyId } } }, // Ép kiểu historyId
    });

    if (!room) throw new Error("Phòng không tồn tại");
    if (room.pin !== String(pin)) throw new Error("Mã PIN không chính xác");

    const logEntry = room.history[0];
    if (!logEntry) throw new Error("Không tìm thấy bản ghi lịch sử");

    const log = logEntry.rawLog;

    return await prisma.$transaction(async (tx) => {
      if (log.type === "DIEM_DEN") {
        await tx.player.update({
          where: { id: +log.currentPlayerId },
          data: { score: { decrement: log.totalEarned } },
        });

        await Promise.all(
          log.loserIds.map((id) =>
            tx.player.update({
              where: { id: +id },
              data: { score: { increment: log.pointsPerLoser } },
            })
          )
        );
      } else if (log.type === "1VS1") {
        await tx.player.update({
          where: { id: +log.winnerId },
          data: { score: { decrement: 1 } },
        });
      }

      await tx.history.delete({ where: { id: +historyId } });

      return await tx.room.findUnique({
        where: { id: numericRoomId },
        include: {
          players: { orderBy: { id: "asc" } },
          history: { take: 50, orderBy: { createdAt: "desc" } },
        },
      });
    });
  },

  async finishRoom(roomId, pin) {
    const numericRoomId = +roomId;
    const room = await prisma.room.findUnique({
      where: { id: numericRoomId },
    });

    if (!room) throw new Error("Phòng không tồn tại");
    if (room.pin !== String(pin)) throw new Error("Mã PIN không chính xác");

    return await prisma.room.update({
      where: { id: numericRoomId },
      data: { isFinished: true },
      include: {
        players: { orderBy: { score: "desc" } },
      },
    });
  },
};
