const express = require('express');
const admin = require('firebase-admin');
const http = require('http');
const cors = require('cors');

// Firebase 초기화
const serviceAccount = require('./firebase/serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Express 앱 및 미들웨어
const app = express();
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
  res.send('서버가 정상적으로 작동 중입니다!');
});

// 라우팅
app.use('/auth', require('./routes/auth'));
app.use('/single', require('./routes/singleGame'));
app.use('/multi/room', require('./routes/multiplayer'));
app.use('/multi/game', require('./routes/multiGame'));
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});


// HTTP 서버 생성
const server = http.createServer(app);

// **여기만 추가!**
require('./socketServer')(server, db);

// 서버 시작
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`서버 실행 중! http://localhost:${PORT}`);
});
