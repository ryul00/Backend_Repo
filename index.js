const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const cors = require('cors');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('🧠 Brain Game Server is running!');
});

// WebSocket 연결
io.on('connection', (socket) => {
  console.log('✅ 유저 접속:', socket.id);

  socket.on('disconnect', () => {
    console.log('❌ 유저 연결 종료:', socket.id);
  });
});

// 서버 실행
const PORT = 3000;
http.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중`);
});
