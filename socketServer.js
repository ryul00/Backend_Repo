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

    // 게임 이벤트 처리
    socket.on("game-event", async (data) => {
      const { type, payload, roomId } = data;
      if (!roomId) {
        console.warn("game-event 수신: roomId 누락");
        return;
      }

      switch (type) {
        case "guest-ready":
        case "game-start":
        case "spawn-mole": 
        case "hit-mole": 
        case "sequence-generated": 
        case "user-input": 
        case "input-result": 
        case "level-up": 
        case "spawn-question":
        case "answer-result":
        case "score-update":
          socket.to(roomId).emit("game-event", { type, payload, roomId });
          break;

        case "move-scene":
          if (!payload?.sceneName) {
            console.warn("move-scene emit 실패: sceneName 누락");
            return;
          }

          // Firestore에 현재 씬 저장
          try {
            const roomRef = db.collection("rooms").doc(roomId);
            await roomRef.set({ currentSceneName: payload.sceneName }, { merge: true });
          } catch (err) {
            console.warn(`Firestore currentSceneName 저장 실패:`, err.message);
          }

          // 1.2초 후 씬 이동 브로드캐스트
          setTimeout(() => {
            io.to(roomId).emit("game-event", {
              type: "move-scene",
              payload,
              roomId,
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
            const gameId = roomData.currentSceneName || "UnknownGame"; // 현재 씬 이름이 곧 게임 ID

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

            // 양측 점수 도착 시 결과 씬 전송
            const [hostDoc, guestDoc] = await Promise.all([
              db.collection("multiGames").doc(roomId).collection("results").doc("host").get(),
              db.collection("multiGames").doc(roomId).collection("results").doc("guest").get(),
            ]);

            if (hostDoc.exists && guestDoc.exists) {
              console.log(`[${roomId}] host/guest 점수 모두 저장됨 → 결과씬 emit`);
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
          io.to(roomId).emit("game-event", {
            type: "host-left",
            payload: { message: "Host has left the room" }
          });
          await roomRef.delete();
          console.log(`[leave-room] 호스트(${playerId}) 나감 → 방 삭제 완료`);
        } else if (data.guestId === playerId) {
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
