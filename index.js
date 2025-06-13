const express = require('express');
const http = require('http');
const cors = require('cors');

// Express 앱 및 미들웨어
const app = express();
app.use(express.json());
app.use(cors());

// 기본 경로
app.get('/', (req, res) => {
  res.send('서버가 정상적으로 작동 중입니다!');
});

// 라우팅 설정
app.use('/auth', require('./routes/auth'));
app.use('/single', require('./routes/singleGame'));
app.use('/multi/room', require('./routes/multiplayer'));
app.use('/multi/game', require('./routes/multiGame'));
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// HTTP 서버 생성 (ALB가 HTTPS를 처리하므로 80번 포트에서 리스닝)
const server = http.createServer(app);

// 서버 시작 (80번 포트에서 HTTP 리스닝)
server.listen(80, () => {
  console.log('서버 실행 중! http://localhost:80');
});

// 소켓 서버 연결
require('./socketServer')(server);
