import { prisma } from "../db.js";
import { AppError } from "../utils/AppError.js";

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
    const {
      name,
      pin,
      type,
      playerNames,
      valBi3,
      valBi6,
      valBi9,
      creatorId,
      playerCount,
      cardsPerPlayer,
    } = data;

    // if (
    //   !playerNames ||
    //   !Array.isArray(playerNames) ||
    //   playerNames.length <= 2
    // ) {
    //   throw new Error("Phòng phải có ít nhất 2 người chơi");
    // }

    if (type === "BIDA_1VS1" && playerNames.length !== 2) {
      throw new Error("Chế độ 1vs1 phải có đúng 2 người chơi");
    }

    const isDiemDen = type === "BIDA_DIEM_DEN";
    const isBidaBai = type === "BIDA_BAI";

    //Kiểm tra số lượng người chơi và bài mỗi người
    const actualPlayerCount = isBidaBai
      ? playerCount || 4
      : playerNames?.length || 0;
    const finalCardsPerPlayer = isBidaBai ? Number(cardsPerPlayer) || 5 : 5;

    if (isBidaBai && finalCardsPerPlayer * actualPlayerCount > 52) {
      throw new Error(
        `Không đủ bài! Tổng bài cần (${finalCardsPerPlayer * actualPlayerCount}) vượt quá 52 lá.`
      );
    }

    let initialDeck = null;
    if (isBidaBai) {
      const suits = ["Cơ", "Rô", "Chuồn", "Bích"];
      initialDeck = [];

      // Tạo 52 lá bài có đầy đủ Chất và Giá trị
      for (let s of suits) {
        for (let v = 1; v <= 13; v++) {
          initialDeck.push({ value: v, suit: s });
        }
      }

      // Xào bài Fisher-Yates
      for (let i = initialDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [initialDeck[i], initialDeck[j]] = [initialDeck[j], initialDeck[i]];
      }
    }

    const roomData = {
      name,
      pin: String(pin),
      type,
      isFinished: false,
      currentDeck: initialDeck,
      cardsPerPlayer: finalCardsPerPlayer,
      valBi3: isDiemDen ? (valBi3 ?? 1) : 0,
      valBi6: isDiemDen ? (valBi6 ?? 2) : 0,
      valBi9: isDiemDen ? (valBi9 ?? 3) : 0,
      players: {
        create: isBidaBai
          ? Array.from({ length: playerCount || 4 }).map((_, index) => ({
              name: `Slot ${index + 1}`,
              score: 0,
              cards: [],
              userId: index === 0 && creatorId ? creatorId : null,
            }))
          : playerNames
              .filter((n) => n && n.trim() !== "")
              .map((n, index) => ({
                name: n.trim(),
                score: 0,
                userId: index === 0 && creatorId ? creatorId : null,
              })),
      },
    };

    const room = await prisma.room.create({
      data: roomData,
      include: {
        players: true,
        history: { take: 50, orderBy: { createdAt: "desc" } },
      },
    });

    const { currentDeck: _, ...roomWithoutDeck } = room;
    return roomWithoutDeck;
  },

  // 3. Lấy chi tiết phòng (Dùng +roomId)

  // async getRoomDetail(roomId, pin) {
  //   const room = await prisma.room.findUnique({
  //     where: { id: +roomId },
  //     include: {
  //       players: { orderBy: { id: "asc" } },
  //       history: {
  //         take: 50,
  //         orderBy: { createdAt: "desc" },
  //       },
  //     },
  //   });

  //   if (!room) {
  //     throw new Error("Phòng không tồn tại");
  //   }

  //   // TRƯỜNG HỢP 1: Người dùng chỉ vào xem (Không gửi PIN)
  //   if (!pin) {
  //     // Trả về dữ liệu nhưng ẩn PIN của phòng để tránh bị lộ ở phía Client
  //     const { pin: _, ...viewableRoom } = room;
  //     return {
  //       ...viewableRoom,
  //       isViewer: true, // Gắn flag để Frontend biết đây là chế độ xem
  //     };
  //   }

  //   // TRƯỜNG HỢP 2: Người dùng nhập PIN để quản lý
  //   if (String(room.pin) !== String(pin)) {
  //     // Nếu có gửi PIN nhưng sai -> Báo lỗi 403 hoặc 401
  //     const error = new Error("Mã PIN không chính xác");
  //     error.status = 403;
  //     throw error;
  //   }

  //   // Nếu PIN đúng
  //   return {
  //     ...room,
  //     isViewer: false,
  //   };
  // },
  async getRoomDetail(roomId, pin) {
    const room = await prisma.room.findUnique({
      where: { id: Number(roomId) },
      include: {
        players: { orderBy: { id: "asc" } },
        history: {
          take: 50,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!room) {
      const err = new Error("Phòng không tồn tại");
      err.status = 404;
      throw err;
    }

    // 🔥 PHÒNG ĐÃ KẾT THÚC → ÉP READ ONLY
    if (room.isFinished) {
      const { pin: _, ...archivedRoom } = room;
      return {
        ...archivedRoom,
        isFinished: true,
        isViewer: true,
        readOnly: true,
      };
    }

    // 👀 VIEW MODE (không gửi PIN)
    if (!pin) {
      const { pin: _, ...viewableRoom } = room;
      return {
        ...viewableRoom,
        isViewer: true,
        readOnly: true,
      };
    }

    // 🔐 PIN SAI
    if (String(room.pin) !== String(pin)) {
      const err = new Error("Mã PIN không chính xác");
      err.status = 403;
      throw err;
    }

    // ✅ PLAYER / CHỦ PHÒNG
    return {
      ...room,
      isViewer: false,
      readOnly: false,
    };
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

  async getRoomStatus(roomId) {
    return await prisma.room.findUnique({
      where: { id: +roomId },
      select: { isFinished: true },
    });
  },

  async claimPlayer(roomId, { playerId, userId, username }) {
    const numericRoomId = Number(roomId);
    const numericPlayerId = Number(playerId);

    return await prisma.$transaction(async (tx) => {
      // 1. Kiểm tra xem người chơi này đã bị gán userId chưa
      const targetPlayer = await tx.player.findUnique({
        where: { id: numericPlayerId },
      });

      if (!targetPlayer) throw new Error("Không tìm thấy người chơi này");
      if (targetPlayer.roomId !== numericRoomId)
        throw new Error("Người chơi không thuộc phòng này");
      if (targetPlayer.userId !== null)
        throw new Error("Người chơi này đã được tài khoản khác nhận");

      // 2. (Optional) Kiểm tra xem User này đã nhận Player nào khác trong phòng này chưa
      const existingClaim = await tx.player.findFirst({
        where: {
          roomId: numericRoomId,
          userId: userId,
        },
      });
      if (existingClaim)
        throw new Error("Bạn đã nhận một nhân vật khác trong phòng này rồi");

      // 3. Update Player: Gán userId và đổi tên thành username
      const updatedPlayer = await tx.player.update({
        where: { id: Number(playerId) },
        data: { userId, name: username },
      });

      // 4. Lấy lại toàn bộ dữ liệu phòng để broadcast qua Socket.io
      const room = await tx.room.findUnique({
        where: { id: numericRoomId },
        include: {
          players: { orderBy: { id: "asc" } },
          history: { take: 50, orderBy: { createdAt: "desc" } },
        },
      });

      return { ...room, currentUserId: userId };
    });
  },

  async drawCard(roomId, { playerId, userId }) {
    return await prisma.$transaction(async (tx) => {
      // 1. Lấy thông tin phòng và kiểm tra bài
      const room = await tx.room.findUnique({ where: { id: +roomId } });
      if (!room || room.isFinished) throw new Error("Phòng không khả dụng");

      let deck = room.currentDeck || [];
      if (deck.length === 0) throw new Error("Hết bài!");

      // 2. Lấy thông tin người chơi
      const player = await tx.player.findUnique({ where: { id: +playerId } });
      if (!player) throw new Error("Không tìm thấy người chơi");

      // 🔥 SỬA LỖI: So sánh userId của player với userId của người đang gọi API
      if (player.userId !== userId) {
        console.log({ player });
        console.log({ userId });
        // Nếu bạn chưa có AppError thì dùng Error tạm, nhưng nên dùng AppError
        const err = new Error("Bạn không có quyền rút bài cho nhân vật này");
        err.statusCode = 403;
        throw err;
      }

      // 3. Rút bài
      const cardFromDeck = deck.shift();
      const newCard = {
        id: `card-${Date.now()}-${Math.random()}`,
        value: cardFromDeck.value,
        suit: cardFromDeck.suit,
        isFlipped: true,
      };

      // 4. Cập nhật Player (Thêm lá bài mới vào mảng cards)
      // Đảm bảo cards được gán mảng mới hoàn toàn để Prisma nhận diện thay đổi JSON
      const updatedCards = Array.isArray(player.cards)
        ? [...player.cards, newCard]
        : [newCard];

      await tx.player.update({
        where: { id: +playerId },
        data: { cards: updatedCards },
      });

      // 5. Cập nhật Room (Xóa lá bài đã rút khỏi Deck)
      const updatedRoom = await tx.room.update({
        where: { id: +roomId },
        data: { currentDeck: deck },
        include: {
          players: { orderBy: { id: "asc" } },
          history: { take: 50, orderBy: { createdAt: "desc" } },
        },
      });

      const deckCount = updatedRoom.currentDeck
        ? updatedRoom.currentDeck.length
        : 0;

      const { currentDeck: _, ...safeRoom } = updatedRoom;
      return { ...safeRoom, deckCount };
    });
  },

  // 6. Bắt đầu game và chia bài (5 lá)
  async startGame(roomId, { pin }) {
    const numericRoomId = Number(roomId);
    return await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { id: numericRoomId },
        include: { players: true },
      });

      if (!room) throw new AppError("Phòng không tồn tại", 404);
      if (room.pin !== String(pin))
        throw new AppError("Mã PIN không chính xác", 403);
      if (room.type !== "BIDA_BAI")
        throw new AppError("Chế độ này không hỗ trợ chia bài", 400);

      // Kiểm tra xem đã claim hết slot chưa
      const hasUnclaimed = room.players.some((p) => p.userId === null);
      if (hasUnclaimed)
        throw new AppError(
          "Cần đủ người chơi (đã nhận slot) mới có thể bắt đầu",
          400
        );

      // Tạo bộ bài mới 52 lá và xào
      const suits = ["Cơ", "Rô", "Chuồn", "Bích"];
      let deck = [];
      for (let s of suits) {
        for (let v = 1; v <= 13; v++) deck.push({ value: v, suit: s });
      }
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      const numCards = room.cardsPerPlayer || 5;

      if (numCards * room.players.length > 52) {
        throw new AppError(
          "Số lượng người chơi và số lá bài quá lớn so với bộ bài 52 lá",
          400
        );
      }

      // Chia mỗi người theo numCards
      for (let player of room.players) {
        const playerCards = [];
        for (let i = 0; i < numCards; i++) {
          const card = deck.shift();
          if (!card) break;
          playerCards.push({
            id: `card-${Date.now()}-${Math.random()}`,
            value: card.value,
            suit: card.suit,
            isFlipped: true,
          });
        }
        await tx.player.update({
          where: { id: player.id },
          data: { cards: playerCards, score: 0 },
        });
      }

      const updatedRoom = await tx.room.update({
        where: { id: numericRoomId },
        data: { currentDeck: deck },
        include: {
          players: { orderBy: { id: "asc" } },
          history: { take: 50, orderBy: { createdAt: "desc" } },
        },
      });

      await tx.history.create({
        data: {
          roomId: numericRoomId,
          content: `Bắt đầu ván mới - Chia ${numCards} lá`,
          rawLog: { type: "START", cardsDealt: numCards },
        },
      });

      const deckCount = updatedRoom.currentDeck
        ? updatedRoom.currentDeck.length
        : 0;

      const { currentDeck: _, ...safeRoom } = updatedRoom;
      return { ...safeRoom, deckCount };
    });
  },

  // 7. Đánh bi trúng - Bỏ bài (Discard tất cả lá trùng giá trị)
  async discardCard(roomId, { playerId, userId, ballValue }) {
    return await prisma.$transaction(async (tx) => {
      const player = await tx.player.findUnique({ where: { id: +playerId } });
      if (!player) throw new AppError("Không tìm thấy người chơi", 404);
      if (player.userId !== userId) throw new AppError("Không có quyền", 403);

      const cards = player.cards || [];
      const targetValue = Number(ballValue);

      const remainingCards = cards.filter(
        (c) => Number(c.value) !== targetValue
      );
      const removedCards = cards.filter((c) => Number(c.value) === targetValue);

      if (removedCards.length === 0) {
        throw new AppError(`Trong tay không có lá bài số ${targetValue}`, 400);
      }

      // 1. Cập nhật bài của người chơi trước
      await tx.player.update({
        where: { id: +playerId },
        data: { cards: remainingCards },
      });

      // 🔥 2. QUAN TRỌNG: Tạo lịch sử TRƯỚC khi lấy dữ liệu Room
      await tx.history.create({
        data: {
          roomId: +roomId,
          content: `${player.name} đã bỏ ${removedCards.length} lá số ${targetValue}`,
          rawLog: {
            type: "DISCARD",
            ballValue: targetValue,
            count: removedCards.length,
            removedCards,
          },
        },
      });

      // 🔥 3. Bây giờ mới lấy dữ liệu Room (Lúc này include: history sẽ có cả cái vừa tạo)
      const updatedRoom = await tx.room.update({
        where: { id: +roomId },
        data: { updatedAt: new Date() },
        include: {
          players: { orderBy: { id: "asc" } },
          history: {
            take: 50,
            orderBy: { createdAt: "desc" },
          },
        },
      });

      const deckCount = updatedRoom.currentDeck
        ? updatedRoom.currentDeck.length
        : 0;
      const { currentDeck: _, ...safeRoom } = updatedRoom;

      return { ...safeRoom, deckCount };
    });
  },

  async resetGame(roomId, { pin, userId }) {
    const numericRoomId = Number(roomId);

    return await prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { id: numericRoomId },
        include: { players: true },
      });

      if (!room) throw new AppError("Phòng không tồn tại", 404);
      if (room.pin !== String(pin))
        throw new AppError("Mã PIN không chính xác", 403);
      if (room.type !== "BIDA_BAI")
        throw new AppError("Chế độ này không hỗ trợ reset bài", 400);

      // 1. Tạo bộ bài mới 52 lá
      const suits = ["Cơ", "Rô", "Chuồn", "Bích"];
      let deck = [];
      for (let s of suits) {
        for (let v = 1; v <= 13; v++) deck.push({ value: v, suit: s });
      }

      // Xào bài
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }

      // 2. Thu hồi toàn bộ bài trên tay người chơi và reset điểm về 0
      await tx.player.updateMany({
        where: { roomId: numericRoomId },
        data: {
          cards: [],
          score: 0,
        },
      });

      // 3. Xóa lịch sử cũ (tùy chọn - nếu muốn sạch sẽ ván mới) hoặc thêm log reset
      await tx.history.create({
        data: {
          roomId: numericRoomId,
          content: "Ván đấu đã được reset bởi quản trị viên",
          rawLog: { type: "RESET", byUserId: userId },
        },
      });

      // 4. Cập nhật room với deck mới
      const updatedRoom = await tx.room.update({
        where: { id: numericRoomId },
        data: {
          currentDeck: deck,
          updatedAt: new Date(),
        },
        include: {
          players: { orderBy: { id: "asc" } },
          history: { take: 50, orderBy: { createdAt: "desc" } },
        },
      });

      const deckCount = updatedRoom.currentDeck
        ? updatedRoom.currentDeck.length
        : 0;
      const { currentDeck: _, ...safeRoom } = updatedRoom;

      return { ...safeRoom, deckCount };
    });
  },
};
