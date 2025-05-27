const express = require('express');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const { nanoid } = require('nanoid');

const router = express.Router();
const db = admin.firestore();

const JWT_SECRET = process.env.JWT_SECRET;

// 방 생성
router.post('/create-room', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization header missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const hostId = decoded.browserId;
    const koreaDateTime = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });

    if (!hostId) {
      return res.status(400).json({ success: false, message: 'Invalid token payload' });
    }

    // 🔍 host의 닉네임, 캐릭터 불러오기
    const userDoc = await db.collection('users').doc(hostId).get();
    if (!userDoc.exists) {
      return res.status(400).json({ success: false, message: 'Host user not found' });
    }

    const { nickname: hostNickname, character: hostCharacter } = userDoc.data();

    const validCharacters = ['dog', 'tiger', 'rabbit'];
    if (!validCharacters.includes(hostCharacter)) {
      return res.status(400).json({ success: false, message: 'Invalid host character' });
    }

    const roomId = nanoid(6);

    const roomData = {
      hostId,
      hostNickname,       //  추가
      hostCharacter,      // 추가
      guestId: null,
      guestNickname: null,
      guestCharacter: null,
      createdAt: koreaDateTime,
      status: 'waiting'
    };

    await db.collection('rooms').doc(roomId).set(roomData);

    const inviteUrl = `http://localhost:7456/?roomId=${roomId}`;

    res.status(200).json({
      success: true,
      roomId,
      inviteUrl
    });

  } catch (err) {
    console.error('JWT verification failed:', err.message);
    res.status(401).json({ success: false, message: 'Invalid token', error: err.message });
  }
});

// 방 상태 조회
router.get('/room-status/:roomId', async (req, res) => {
  const { roomId } = req.params;

  try {
    const roomDoc = await db.collection('rooms').doc(roomId).get();

    if (!roomDoc.exists) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const data = roomDoc.data();

    // hostNickname/Character 포함
    let hostInfo = {};
    if (data?.hostId) {
      const hostDoc = await db.collection('users').doc(data.hostId).get();
      if (hostDoc.exists) {
        const { nickname: hostNickname, character: hostCharacter } = hostDoc.data();
        hostInfo = { hostNickname, hostCharacter };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        ...data,
        ...hostInfo
      }
    });

  } catch (err) {
    console.error('room-status 오류:', err.message);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// 방 입장 (게스트)
router.post('/join-room/:roomId', async (req, res) => {
  const authHeader = req.headers.authorization;
  const { roomId } = req.params;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const guestId = decoded.browserId;
    const koreaDateTime = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });

    // 유저 정보 조회
    const userDoc = await db.collection('users').doc(guestId).get();
    if (!userDoc.exists) {
      return res.status(400).json({ success: false, message: 'Guest user not found' });
    }

    const { nickname, character } = userDoc.data();

    const validCharacters = ['dog', 'tiger', 'rabbit'];
    if (!validCharacters.includes(character)) {
      return res.status(400).json({ success: false, message: 'Invalid character' });
    }

    // 방에 게스트 정보, 호스트 정보 업데이트
    await db.collection('rooms').doc(roomId).update({
      guestId,
      guestNickname: nickname,
      guestCharacter: character,
      joinedAt: koreaDateTime,
      status: 'ready'
    });

    // Host 정보도 포함
    const roomDoc = await db.collection('rooms').doc(roomId).get();
    const roomData = roomDoc.data();

    let hostInfo = {};
    if (roomData?.hostId) {
      const hostDoc = await db.collection('users').doc(roomData.hostId).get();
      if (hostDoc.exists) {
        const { nickname: hostNickname, character: hostCharacter } = hostDoc.data();
        hostInfo = { hostNickname, hostCharacter };
      }
    }

    res.status(200).json({
      success: true,
      guestNickname: nickname,
      guestCharacter: character,
      ...hostInfo
    });

  } catch (err) {
    console.error('join-room 실패:', err.message);
    res.status(401).json({ success: false, message: 'Invalid token', error: err.message });
  }
});


// 입장 완료 후 멀티 게임 선택 화면 이동 -> start-game/:roomId
router.post('/start-game/:roomId', async (req, res) => {
  const { roomId } = req.params;

  try {
    await db.collection('rooms').doc(roomId).update({ status: 'started' });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("start-game 실패:", err.message);
    return res.status(500).json({ success: false, message: '서버 에러', error: err.message });
  }
});

module.exports = router;
