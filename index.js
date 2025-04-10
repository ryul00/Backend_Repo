const express = require('express');
const admin = require('firebase-admin');
const app = express();

const serviceAccount = require('./firebase/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

app.use(express.json());

app.post('/test-firebase', async (req, res) => {
  try {
    const docRef = await db.collection('testData').add({
      message: 'Hello Firebase!',
      timestamp: Date.now()
    });

    res.send({ success: true, id: docRef.id });
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중! http://localhost:${PORT}`);
});
