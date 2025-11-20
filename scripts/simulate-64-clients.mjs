#!/usr/bin/env node

import { io } from 'socket.io-client';

const ROOM_ID = process.env.ROOM_ID || 'test-room-64';
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:5050';
const CLIENT_COUNT = parseInt(process.env.CLIENT_COUNT || '64', 10);
const ENABLE_AUTO_TAP = process.env.ENABLE_AUTO_TAP === 'true';
const ENABLE_AUTO_QUIZ = process.env.ENABLE_AUTO_QUIZ === 'true';

// 日本人の名前候補
const FIRST_NAMES = [
  '太郎', '花子', '次郎', '美咲', '健太', '由美', '翔太', '愛', '大輔', '麻衣',
  '拓也', '優子', '隆', '恵', '裕太', '加奈', '和也', '真由美', '浩二', '典子',
  '正樹', '佳奈', '誠', '美穂', '康平', '里奈', '勇気', 'さくら', '陽介', '奈々',
  '賢', '綾', '直樹', '瞳', '慎一', '千春', '智也', '香織', '哲也', '明美',
  '淳', '亜希子', '修', '絵美', '将', '優香', '聡', '梨花', '剛', '友美',
  '学', '理恵', '豊', '詩織', '稔', '舞', '清', '菜々子', '実', '美紀',
  '勝', '恵美', '進', '真理', '博', '智子'
];

const clients = [];
const stats = {
  connected: 0,
  disconnected: 0,
  helloSent: 0,
  tapsSent: 0,
  quizAnswersSent: 0,
  stateUpdatesReceived: 0,
  quizShowReceived: 0,
  quizResultReceived: 0,
  errors: 0
};

function getRandomName() {
  return FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
}

function getRandomTableSeat() {
  const tableNo = Math.floor(Math.random() * 8) + 1; // 1-8テーブル
  const seatNo = Math.floor(Math.random() * 8) + 1; // 1-8席
  return { tableNo: tableNo.toString(), seatNo: seatNo.toString() };
}

function createClient(clientId) {
  const socket = io(SOCKET_URL, {
    transports: ['websocket'],
    query: { roomId: ROOM_ID }
  });

  const { tableNo, seatNo } = getRandomTableSeat();
  const displayName = `${getRandomName()}${clientId}`;

  socket.on('connect', () => {
    stats.connected++;
    console.log(`[Client ${clientId}] Connected (${stats.connected}/${CLIENT_COUNT})`);

    // Send hello event
    socket.emit('event', {
      type: 'hello',
      payload: {
        displayName,
        tableNo,
        seatNo
      }
    });
    stats.helloSent++;

    // Auto tap if enabled
    if (ENABLE_AUTO_TAP) {
      const tapInterval = setInterval(() => {
        socket.emit('event', {
          type: 'tap:delta',
          payload: {
            delta: Math.floor(Math.random() * 10) + 1 // 1-10 random taps
          }
        });
        stats.tapsSent++;
      }, Math.random() * 2000 + 1000); // Random interval 1-3 seconds

      socket.data = { ...socket.data, tapInterval };
    }
  });

  socket.on('state:update', (payload) => {
    stats.stateUpdatesReceived++;
    if (stats.stateUpdatesReceived % 100 === 0) {
      console.log(`[Stats] State updates received: ${stats.stateUpdatesReceived}`);
    }
  });

  socket.on('quiz:show', (payload) => {
    stats.quizShowReceived++;
    console.log(`[Client ${clientId}] Quiz received: ${payload.question}`);

    // Auto answer if enabled
    if (ENABLE_AUTO_QUIZ) {
      const answerDelay = Math.random() * 5000 + 1000; // Random delay 1-6 seconds
      setTimeout(() => {
        const choiceIndex = Math.floor(Math.random() * payload.choices.length);
        socket.emit('event', {
          type: 'quiz:answer',
          payload: {
            quizId: payload.quizId,
            choiceIndex
          }
        });
        stats.quizAnswersSent++;
        console.log(`[Client ${clientId}] Answered quiz with choice ${choiceIndex}`);
      }, answerDelay);
    }
  });

  socket.on('quiz:result', (payload) => {
    stats.quizResultReceived++;
    console.log(`[Client ${clientId}] Quiz result - Correct: ${payload.correctIndex}`);
  });

  socket.on('lottery:result', (payload) => {
    console.log(`[Client ${clientId}] Lottery result - Winner: ${payload.player.name} (${payload.kind})`);
  });

  socket.on('connect_error', (error) => {
    stats.errors++;
    console.error(`[Client ${clientId}] Connection error:`, error.message);
  });

  socket.on('disconnect', (reason) => {
    stats.disconnected++;
    console.log(`[Client ${clientId}] Disconnected: ${reason}`);
    if (socket.data?.tapInterval) {
      clearInterval(socket.data.tapInterval);
    }
  });

  return { socket, clientId, displayName };
}

async function main() {
  console.log('='.repeat(60));
  console.log('64-Client Load Test Simulator');
  console.log('='.repeat(60));
  console.log(`Room ID: ${ROOM_ID}`);
  console.log(`Socket URL: ${SOCKET_URL}`);
  console.log(`Client Count: ${CLIENT_COUNT}`);
  console.log(`Auto Tap: ${ENABLE_AUTO_TAP}`);
  console.log(`Auto Quiz Answer: ${ENABLE_AUTO_QUIZ}`);
  console.log('='.repeat(60));
  console.log('');

  // Create all clients
  console.log(`Creating ${CLIENT_COUNT} clients...`);
  for (let i = 1; i <= CLIENT_COUNT; i++) {
    const client = createClient(i);
    clients.push(client);

    // Stagger connection by 100ms to avoid overwhelming the server
    if (i < CLIENT_COUNT) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\nAll ${CLIENT_COUNT} clients created. Waiting for connections...\n`);

  // Print stats every 5 seconds
  const statsInterval = setInterval(() => {
    console.log('\n' + '='.repeat(60));
    console.log('STATS UPDATE');
    console.log('='.repeat(60));
    console.log(`Connected: ${stats.connected}/${CLIENT_COUNT}`);
    console.log(`Disconnected: ${stats.disconnected}`);
    console.log(`Hello sent: ${stats.helloSent}`);
    console.log(`Taps sent: ${stats.tapsSent}`);
    console.log(`Quiz answers sent: ${stats.quizAnswersSent}`);
    console.log(`State updates received: ${stats.stateUpdatesReceived}`);
    console.log(`Quiz show received: ${stats.quizShowReceived}`);
    console.log(`Quiz result received: ${stats.quizResultReceived}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(60) + '\n');
  }, 5000);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down...');
    clearInterval(statsInterval);

    clients.forEach(({ socket, clientId }) => {
      if (socket.data?.tapInterval) {
        clearInterval(socket.data.tapInterval);
      }
      socket.disconnect();
    });

    console.log('\n' + '='.repeat(60));
    console.log('FINAL STATS');
    console.log('='.repeat(60));
    console.log(`Connected: ${stats.connected}/${CLIENT_COUNT}`);
    console.log(`Disconnected: ${stats.disconnected}`);
    console.log(`Hello sent: ${stats.helloSent}`);
    console.log(`Taps sent: ${stats.tapsSent}`);
    console.log(`Quiz answers sent: ${stats.quizAnswersSent}`);
    console.log(`State updates received: ${stats.stateUpdatesReceived}`);
    console.log(`Quiz show received: ${stats.quizShowReceived}`);
    console.log(`Quiz result received: ${stats.quizResultReceived}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  });
}

main().catch(console.error);
