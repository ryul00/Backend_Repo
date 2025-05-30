const express = require('express');
const admin = require('firebase-admin');
const http = require('http');
const cors = require('cors');
const { Server } = require("socket.io");

// Firebase 초기화
const serviceAccount = require('./firebase/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Express 앱 및 미들웨어
const app = express();
app.use(express.json());
app.use(cors());

// 라우팅
app.use('/auth', require('./routes/auth'));
app.use('/score', require('./routes/singleGame'));
app.use('/api', require('./routes/multiplayer'));          // 방 생성/입장 등 멀티플레이어 핵심
app.use('/game', require('./routes/multiGame'));  



// HTTP 서버 생성 및 소켓 서버 붙이기
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

// Socket.IO 이벤트 정의
io.on("connection", (socket) => {
  console.log("🟢 클라이언트 소켓 연결됨:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`👥 ${socket.id} → ${roomId} 방 입장`);
  });

socket.on("game-event", async (data) => {
  const { type, payload, roomId } = data;

  if (!roomId) {
    console.warn("❌ game-event 수신: roomId 누락");
    return;
  }

  switch (type) {
    case "guest-ready":
    case "game-start":
    case "spawn-mole":
    case "hit-mole":
    case "score-update":
      io.to(roomId).emit("game-event", { type, payload, roomId });
      break;

    case "move-scene":
      if (!payload?.sceneName) {
        console.warn("❌ move-scene emit 실패: sceneName 누락");
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

    const roomRef = admin.firestore().collection("rooms").doc(roomId);
    const roomDoc = await roomRef.get();

    if (!roomDoc.exists) {
      console.warn(`❌ 방 정보 없음: roomId = ${roomId}`);
      return;
    }

    const roomData = roomDoc.data();
    const sequence = roomData.selectedGameSequence || [];
    const currentIndex = roomData.currentIndex || 0;

    const gameId = sequence[currentIndex] || null;

    const resultRef = admin.firestore()
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
    console.log(`✅ [${roomId}] ${role} 점수 저장 완료 (gameId: ${gameId})`);

    const [hostDoc, guestDoc] = await Promise.all([
      admin.firestore().collection("multiGames").doc(roomId).collection("results").doc("host").get(),
      admin.firestore().collection("multiGames").doc(roomId).collection("results").doc("guest").get(),
    ]);

    if (hostDoc.exists && guestDoc.exists) {
      console.log(`🎯 [${roomId}] host/guest 점수 모두 저장됨 → 결과씬 emit`);

      // ✅ currentIndex +1로 업데이트
      await roomRef.update({ currentIndex: currentIndex + 1 });

      io.to(roomId).emit("game-event", {
        type: "move-scene",
        payload: { sceneName: "MultiGameResult" },
      });
    } else {
      console.log(`⏳ [${roomId}] 한쪽 점수 미도착 → 대기`);
    }

  } catch (err) {
    console.error(`❌ game-end 처리 중 오류:`, err);
  }
  break;


    default:
      console.warn("⚠️ 알 수 없는 game-event type:", type);
  }
});


socket.on("leave-room", ({ roomId, playerId }) => {
  if (!roomId) {
    console.warn(`❌ [leave-room] 요청에 roomId 누락됨. playerId=${playerId}`);
    return;
  }

  console.log(`📤 [leave-room] 요청 수신: socket=${socket.id}, roomId=${roomId}, playerId=${playerId}`);

  socket.leave(roomId);
  console.log(`🚪 [leave-room] ${socket.id} → ${roomId} 방 퇴장 완료`);

  db.collection("rooms").doc(roomId).get().then(doc => {
    if (!doc.exists) {
      console.warn(`⚠️ [leave-room] Firestore 방 문서 없음: roomId=${roomId}`);
      return;
    }

    const data = doc.data();
    console.log(`🗂️ [leave-room] 방 데이터:`, data);

    if (!data.hostId) {
      console.warn(`⚠️ [leave-room] 방에 hostId 필드 없음`);
      return;
    }

    if (data.hostId === playerId) {
      console.log(`🔴 [leave-room] 호스트(${playerId}) 나감 → 게스트에게 알림`);
      io.to(roomId).emit("game-event", {
        type: "host-left",
        payload: { message: "Host has left the room" }
      });
    } else {
      console.log(`👤 [leave-room] 게스트(${playerId}) 나감. 별도 알림 없음`);
    }

  }).catch(err => {
    console.error("❌ [leave-room] Firestore 에러:", err.message);
  });
});




  socket.on("disconnect", () => {
    console.log(`🔴 클라이언트 연결 종료: ${socket.id}`);
  });
});


// 서버 시작
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`✅ 서버 실행 중! http://localhost:${PORT}`);
});
