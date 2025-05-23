require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

const router = express.Router();
const db = admin.firestore();
const JWT_SECRET = process.env.JWT_SECRET;

// 점수 저장 (싱글 / 멀티 구분 지원)
router.post('/submit', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { gameId, score, mode } = req.body;

  if (!gameId || typeof score !== 'number' || !['single', 'multi'].includes(mode)) {
    return res.status(400).send({ success: false, message: 'Missing or invalid parameters' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const browserId = decoded.browserId;

    const koreaDateTime = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" });
    const collectionName = mode === 'single' ? 'singleScores' : 'multiScores';

    await db
      .collection('users')
      .doc(browserId)
      .collection(collectionName)
      .add({
        gameId,
        score,
        playedAt: koreaDateTime
      });

    res.send({ success: true });
  } catch (err) {
    res.status(401).send({ success: false, message: 'Invalid token', error: err.message });
  }
});

module.exports = router;
