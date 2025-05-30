const express = require('express');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');
const { nanoid } = require('nanoid');

const router = express.Router();
const db = admin.firestore();

const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/multi/submit


router.post('/multi/submit', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { roomId, gameId, score, nickname, character, isHost } = req.body;

  if (!roomId || !gameId || isNaN(score) || typeof isHost !== 'boolean') {
    return res.status(400).send({ success: false, message: 'Missing or invalid parameters' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const browserId = decoded.browserId;
    const role = isHost ? "host" : "guest";

    const saveData = {
      gameId,
      score: Number(score),
      nickname,
      character,
      browserId,
      playedAt: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" })
    };

    // 게임별 하위 컬렉션에 저장 (안전)
    await db
      .collection("multiGames")
      .doc(roomId)
      .collection("results")
      .doc(role)
      .set(saveData);

    res.send({ success: true });
  } catch (err) {
    res.status(401).send({ success: false, message: 'Invalid token', error: err.message });
  }
});


// GET /api/multi/result/:roomId
router.get('/result/:roomId', async (req, res) => {
  const roomId = req.params.roomId;

  try {
    const resultsRef = db.collection("multiGames").doc(roomId).collection("results");
    const [hostDoc, guestDoc] = await Promise.all([
      resultsRef.doc("host").get(),
      resultsRef.doc("guest").get()
    ]);

    const host = hostDoc.exists ? hostDoc.data() : null;
    const guest = guestDoc.exists ? guestDoc.data() : null;

    let winner = null;

    if (host && guest && typeof host.score === 'number' && typeof guest.score === 'number') {
      if (host.score > guest.score) {
        winner = { ...host, role: "host" };
      } else if (host.score < guest.score) {
        winner = { ...guest, role: "guest" };
      } else {
        winner = { isTie: true };
      }
    }

    res.send({
      success: true,
      data: {
        host,
        guest,
        winner
      }
    });
  } catch (err) {
    res.status(500).send({ success: false, error: err.message });
  }
});

module.exports = router;
