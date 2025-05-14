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
    const token = jwt.sign({ browserId }, JWT_SECRET, { expiresIn: '30d' });

    const koreaDateTime = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }) + "";
    const userRef = db.collection('users').doc(browserId);
    const doc = await userRef.get();
    if (!doc.exists) {
      await userRef.set({
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

module.exports = router;
