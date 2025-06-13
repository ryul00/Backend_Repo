const express = require('express');
const admin = require('firebase-admin');
const https = require('https');
const fs = require('fs');
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

// HTTP 요청을 HTTPS로 리다이렉트하는 미들웨어 추가
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.protocol !== 'https') {
      return res.redirect(301, 'https://' + req.headers.host + req.url);
    }
    next();
  });
}

// 라우팅
app.use('/auth', require('./routes/auth'));
app.use('/single', require('./routes/singleGame'));
app.use('/multi/room', require('./routes/multiplayer'));
app.use('/multi/game', require('./routes/multiGame'));
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// HTTPS 서버 설정
const options = {
  key: fs.readFileSync('path/to/private-key.pem'),  // SSL 인증서 개인키
  cert: fs.readFileSync('path/to/certificate.pem'),  // SSL 인증서
};

// HTTPS 서버 생성
https.createServer(options, app).listen(443, () => {
  console.log('서버 실행 중! https://localhost:443');
});

// **여기만 추가!**
require('./socketServer')(https, db);

// 서버 시작
const PORT = 443;
