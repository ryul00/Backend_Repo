require('dotenv').config(); // .env 파일 로드
const express = require('express');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

const router = express.Router();
const db = admin.firestore();

const JWT_SECRET = process.env.JWT_SECRET;

router.post('/login', async (req, res) => {
  const { browserId } = req.body;

  if (!browserId) {
    return res.status(400).send({ success: false, message: 'Missing browserId' });
  }

  try {
    const token = jwt.sign({ browserId }, JWT_SECRET, { expiresIn: '90d' });

    const koreaDateTime = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }) + "";
    const userRef = db.collection('users').doc(browserId);
    const doc = await userRef.get();

    if (!doc.exists) {
      await userRef.set({
        browserId, // 
        nickname: null,
        character: null,
        createdAt: koreaDateTime
      });
    }

    res.send({ success: true, token });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});


router.post('/set-profile', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const browserId = decoded.browserId;

    const { nickname, character } = req.body;
    const validCharacters = ['rabbit', 'tiger', 'dog'];

    if (!validCharacters.includes(character)) {
      return res.status(400).send({ success: false, message: 'Invalid character selected.' });
    }

    await db.collection('users').doc(browserId).update({
      nickname,
      character
    });

    res.send({ success: true });
  } catch (err) {
    res.status(401).send({ success: false, message: 'Invalid token', error: err.message });
  }
});

//  토큰 유효성 검증 API
router.post('/verify-token', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.status(200).json({ success: true, browserId: decoded.browserId });
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired token', error: err.message });
  }
});

router.get('/user-info', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const browserId = decoded.browserId;

    const userDoc = await db.collection('users').doc(browserId).get();
    if (!userDoc.exists) {
      return res.status(404).send({ success: false, message: 'User not found' });
    }

    const userData = userDoc.data();

    const scoresSnap = await db.collection('users')
      .doc(browserId)
      .collection('singleScores')
      .orderBy('playedAt', 'desc')
      .limit(5)
      .get();

    const recentScores = scoresSnap.docs.map(doc => doc.data());

    res.send({
      success: true,
      nickname: userData.nickname,
      character: userData.character,
      recentSingleScores: recentScores
    });

  } catch (err) {
    res.status(401).send({ success: false, message: 'Invalid token', error: err.message });
  }
});



module.exports = router;
