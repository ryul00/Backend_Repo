const { Server } = require("socket.io");

module.exports = (server, db) => {
  const io = new Server(server, {
    cors: { origin: "*" }
  });

  io.on("connection", (socket) => {
    console.log("클라이언트 소켓 연결됨:", socket.id);

    // 방 입장
    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`${socket.id} → ${roomId} 방 입장`);
    });

    // 게임 이벤트 처리 (move-scene, 점수 저장 등)
    socket.on("game-event", async (data) => {
      const { type, payload, roomId } = data;
      if (!roomId) {
        console.warn("game-event 수신: roomId 누락");
        return;
      }

      switch (type) {
        case "guest-ready":
        case "game-start":
        case "spawn-mole": // 두더지 게임
        case "hit-mole": // 두더지 게임 
        case "score-update":
          socket.to(roomId).emit("game-event", { type, payload, roomId });
          break;

        case "move-scene":
          if (!payload?.sceneName) {
            console.warn("move-scene emit 실패: sceneName 누락");
            return;
          }
          setTimeout(() => {
            io.to(roomId).emit("game-event", {
              type: "move-scene",
              payload,
            });
          }, 1200);
          break;

        case "game-end":
          try {
            const role = payload.isHost ? "host" : "guest";
            const roomRef = db.collection("rooms").doc(roomId);
            const roomDoc = await roomRef.get();
            if (!roomDoc.exists) {
              console.warn(`방 정보 없음: roomId = ${roomId}`);
              return;
            }

            const roomData = roomDoc.data();
            const sequence = roomData.selectedGameSequence || [];
            const currentIndex = roomData.currentIndex || 0;
            const gameId = sequence[currentIndex] || null;

            const resultRef = db
              .collection("multiGames")
              .doc(roomId)
              .collection("results")
              .doc(role);

            const saveData = {
              gameId,
              score: payload.score,
              nickname: payload.nickname,
              character: payload.character,
              playedAt: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }),
            };

            await resultRef.set(saveData);
            console.log(`[${roomId}] ${role} 점수 저장 완료 (gameId: ${gameId})`);

            // 두 플레이어 모두 점수 저장 완료 시 결과씬 이동
            const [hostDoc, guestDoc] = await Promise.all([
              db.collection("multiGames").doc(roomId).collection("results").doc("host").get(),
              db.collection("multiGames").doc(roomId).collection("results").doc("guest").get(),
            ]);

            if (hostDoc.exists && guestDoc.exists) {
              console.log(`[${roomId}] host/guest 점수 모두 저장됨 → 결과씬 emit`);
              await roomRef.update({ currentIndex: currentIndex + 1 });
              io.to(roomId).emit("game-event", {
                type: "move-scene",
                payload: { sceneName: "MultiGameResult" },
                roomId,
              });
            } else {
              console.log(`[${roomId}] 한쪽 점수 미도착 → 대기`);
            }
          } catch (err) {
            console.error(`game-end 처리 중 오류:`, err);
          }
          break;

        default:
          console.warn("알 수 없는 game-event type:", type);
      }
    });

    // 방 퇴장
    socket.on("leave-room", async ({ roomId, playerId }) => {
      console.log("[SERVER] leave-room 수신", { roomId, playerId });
      if (!roomId) {
        console.warn(`[leave-room] 요청에 roomId 누락됨. playerId=${playerId}`);
        return;
      }

      socket.leave(roomId);
      console.log(`[leave-room] ${socket.id} → ${roomId} 방 퇴장 완료`);

      try {
        const roomRef = db.collection("rooms").doc(roomId);
        const doc = await roomRef.get();
        if (!doc.exists) {
          console.warn(`[leave-room] Firestore 방 문서 없음: roomId=${roomId}`);
          return;
        }
        const data = doc.data();
        if (!data.hostId) {
          console.warn(`[leave-room] 방에 hostId 필드 없음`);
          return;
        }
        if (data.hostId === playerId) {
          // 호스트가 나감 → 방 삭제 + 게스트에게 알림
          io.to(roomId).emit("game-event", {
            type: "host-left",
            payload: { message: "Host has left the room" }
          });
          await roomRef.delete();
          console.log(`[leave-room] 호스트(${playerId}) 나감 → 방 삭제 완료`);
        } else if (data.guestId === playerId) {
          // 게스트가 나감 → guestId null 처리
          await roomRef.update({ guestId: null });
          console.log(`[leave-room] 게스트(${playerId}) 나감 → guestId null 처리`);
        } else {
          console.log(`[leave-room] ${playerId}는 hostId/guestId 둘 다 아님 (무시)`);
        }
      } catch (err) {
        console.error(" [leave-room] Firestore 에러:", err.message);
      }
    });

    // 연결 종료
    socket.on("disconnect", () => {
      console.log(` 클라이언트 연결 종료: ${socket.id}`);
    });
  });
};
