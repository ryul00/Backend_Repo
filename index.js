const express = require('express');
const admin = require('firebase-admin');
const app = express();

const serviceAccount = require('./firebase/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
app.use(express.json());

// 🔄 테스트용 라우트 (Firestore 동작 확인용)
// app.post('/test-firebase', async (req, res) => {
//   try {
//     const docRef = await db.collection('testData').add({
//       message: 'Hello Firebase!',
//       timestamp: Date.now()
//     });

//     res.send({ success: true, id: docRef.id });
//   } catch (err) {
//     res.status(500).send({ error: err.message });
//   }
// });



// cors 설정
const cors = require('cors');
app.use(cors()); // 기본 설정으로 모든 출처 허용

// 라우트 연결 (항상 app.listen() 전에 위치)
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);

// 싱글 게임 점수 저장 라우트
const scoreRoutes = require('./routes/singleGame');
app.use('/score', scoreRoutes); //  클라이언트 요청 주소와 일치시킴

// 추가할 멀티플레이 라우트
const multiplayerRoutes = require('./routes/multiplayer'); 
app.use('/api', multiplayerRoutes);

// 서버 실행 (가장 마지막에 위치!)
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`서버 실행 중! http://localhost:${PORT}`);
});



