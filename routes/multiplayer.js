const express = require('express');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const { nanoid } = require('nanoid');

const router = express.Router();
const db = admin.firestore();

const JWT_SECRET = process.env.JWT_SECRET;

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

    const roomId = nanoid(6); // 예: 'xYp9Jk'

    const roomData = {
      hostId,
      guestId: null,
      createdAt: koreaDateTime,
      status: 'waiting',
    };

    await db.collection('rooms').doc(roomId).set(roomData);

    const inviteUrl = `https://minimalstudio.diskstation.me:9716/${roomId}`;

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

router.get('/room-status/:roomId', async (req, res) => {
  const { roomId } = req.params;

  try {
    const roomDoc = await db.collection('rooms').doc(roomId).get();

    if (!roomDoc.exists) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const data = roomDoc.data();

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('room-status 오류:', err.message);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});


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

    // 유효한 캐릭터인지 확인
    const validCharacters = ['dog', 'tiger', 'rabbit'];
    if (!validCharacters.includes(character)) {
      return res.status(400).json({ success: false, message: 'Invalid character' });
    }

    // 방 문서에 게스트 정보 업데이트
    await db.collection('rooms').doc(roomId).update({
      guestId,
      guestNickname: nickname,
      guestCharacter: character,
      joinedAt: koreaDateTime,
      status: 'ready'
    });

    res.status(200).json({ success: true });

  } catch (err) {
    console.error('join-room 실패:', err.message);
    res.status(401).json({ success: false, message: 'Invalid token', error: err.message });
  }
});


module.exports = router;
