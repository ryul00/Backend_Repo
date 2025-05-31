require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

const router = express.Router();
const db = admin.firestore();
const JWT_SECRET = process.env.JWT_SECRET;

// 점수 저장 (싱글)
router.post('/submit', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn("[score/submit] 인증 헤더 없음/형식 오류");
    return res.status(401).send({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  // nickname, character도 받기
  const { gameId, score, mode, nickname, character } = req.body;

  // nickname, character가 없으면 400 반환
  if (!gameId || typeof score !== 'number' || !['single', 'multi'].includes(mode)
    || !nickname || !character) {
    return res.status(400).send({ success: false, message: 'Missing or invalid parameters' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const browserId = decoded.browserId;

    const koreaDateTime = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });

    // singleGames 컬렉션에 저장 (자동 ID)
    await db.collection('singleGames').add({
      gameId,
      score,
      nickname,     // body에서 온 값
      character,    // body에서 온 값
      browserId,
      playedAt: koreaDateTime
    });

    res.send({ success: true });
  } catch (err) {
    console.error("[score/submit] JWT 인증 실패:", err.message);
    res.status(401).send({ success: false, message: 'Invalid token', error: err.message });
  }
});

module.exports = router;
