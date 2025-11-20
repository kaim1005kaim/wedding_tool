#!/usr/bin/env node

// 本番環境（Supabase）用の64クライアントシミュレーター
// Vercelにデプロイされた投影画面・管理画面と連携してテストします

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const ROOM_ID = process.env.ROOM_ID || '714edbad-0122-48cf-8b1a-0945dcad2611';
const API_BASE_URL = process.env.API_BASE_URL || 'https://weddingtool.vercel.app';
const CLIENT_COUNT = parseInt(process.env.CLIENT_COUNT || '64', 10);
const ENABLE_AUTO_TAP = process.env.ENABLE_AUTO_TAP === 'true';
const ENABLE_AUTO_QUIZ = process.env.ENABLE_AUTO_QUIZ === 'true';

// Supabase configuration (must match production)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qdqywlntdkujepbqjupk.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkcXl3bG50ZGt1amVwYnFqdXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjYyMDM1MjgsImV4cCI6MjA0MTc3OTUyOH0.5DKsIedLNFjPT-wrDQ2NlNZiW1YhBsOc7rSvlwb1gRo';

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
  registered: 0,
  helloSent: 0,
  tapsSent: 0,
  quizAnswersSent: 0,
  errors: 0
};

function getRandomName() {
  return FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
}

function getRandomTableSeat() {
  const tableNo = Math.floor(Math.random() * 12) + 1; // 1-12テーブル (A-L)
  const tableLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
  const seatNo = Math.floor(Math.random() * 8) + 1; // 1-8席
  return {
    tableNo: tableLetters[tableNo - 1],
    seatNo: seatNo.toString()
  };
}

async function joinRoom(roomId, displayName, tableNo, furigana) {
  const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/join`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      displayName,
      furigana,
      tableNo,
      deviceFingerprint: `simulator-${Math.random().toString(36).substring(7)}`
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to join room: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.token;
}

async function sendTap(roomId, token, delta) {
  const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/tap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ delta })
  });

  if (!response.ok) {
    throw new Error(`Failed to send tap: ${response.statusText}`);
  }
}

async function sendQuizAnswer(roomId, token, quizId, choiceIndex) {
  const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/quiz/answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ quizId, choiceIndex })
  });

  if (!response.ok) {
    throw new Error(`Failed to send quiz answer: ${response.statusText}`);
  }
}

async function createClient(clientId) {
  const { tableNo, seatNo } = getRandomTableSeat();
  const displayName = `${getRandomName()}${clientId}`;
  const furigana = `テスト${clientId}`;

  try {
    // Join room and get token
    const token = await joinRoom(ROOM_ID, displayName, tableNo, furigana);

    stats.registered++;
    stats.helloSent++;
    console.log(`[Client ${clientId}] Registered: ${displayName} (Table ${tableNo}, Seat ${seatNo}) [${stats.registered}/${CLIENT_COUNT}]`);

    const client = {
      clientId,
      displayName,
      tableNo,
      seatNo,
      token,
      tapInterval: null,
      active: true
    };

    // Auto tap if enabled
    if (ENABLE_AUTO_TAP) {
      client.tapInterval = setInterval(async () => {
        if (!client.active) {
          clearInterval(client.tapInterval);
          return;
        }

        try {
          const delta = Math.floor(Math.random() * 10) + 1; // 1-10 random taps
          await sendTap(ROOM_ID, token, delta);
          stats.tapsSent++;
        } catch (error) {
          stats.errors++;
          console.error(`[Client ${clientId}] Tap error:`, error.message);
        }
      }, Math.random() * 2000 + 1000); // Random interval 1-3 seconds
    }

    return client;
  } catch (error) {
    stats.errors++;
    console.error(`[Client ${clientId}] Registration error:`, error.message);
    return null;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('64-Client Cloud Simulator (Production)');
  console.log('='.repeat(60));
  console.log(`Room ID: ${ROOM_ID}`);
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Client Count: ${CLIENT_COUNT}`);
  console.log(`Auto Tap: ${ENABLE_AUTO_TAP}`);
  console.log(`Auto Quiz Answer: ${ENABLE_AUTO_QUIZ}`);
  console.log('='.repeat(60));
  console.log('');

  // Create all clients
  console.log(`Creating ${CLIENT_COUNT} clients...`);
  console.log('Note: This sends HTTP requests to the API, so it may take a while.');
  console.log('');

  for (let i = 1; i <= CLIENT_COUNT; i++) {
    const client = await createClient(i);
    if (client) {
      clients.push(client);
    }

    // Stagger requests by 200ms to avoid overwhelming the API
    if (i < CLIENT_COUNT) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Progress indicator every 10 clients
    if (i % 10 === 0) {
      console.log(`Progress: ${i}/${CLIENT_COUNT} clients registered`);
    }
  }

  console.log(`\n✅ All ${stats.registered} clients registered!\n`);

  // Print stats every 5 seconds
  const statsInterval = setInterval(() => {
    console.log('\n' + '='.repeat(60));
    console.log('STATS UPDATE');
    console.log('='.repeat(60));
    console.log(`Registered: ${stats.registered}/${CLIENT_COUNT}`);
    console.log(`Hello sent: ${stats.helloSent}`);
    console.log(`Taps sent: ${stats.tapsSent}`);
    console.log(`Quiz answers sent: ${stats.quizAnswersSent}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(60) + '\n');
  }, 5000);

  // Setup Supabase realtime for quiz monitoring
  if (ENABLE_AUTO_QUIZ) {
    console.log('📡 Setting up quiz auto-answer via Supabase Realtime...\n');

    const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Group clients by table
    const clientsByTable = {};
    clients.forEach(client => {
      if (!clientsByTable[client.tableNo]) {
        clientsByTable[client.tableNo] = [];
      }
      clientsByTable[client.tableNo].push(client);
    });

    // Track which clients have answered per quiz
    const answeredQuizzes = new Set();

    // Subscribe to room_snapshots changes to detect quiz starts
    const channel = supabase.channel(`room:${ROOM_ID}:quiz`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_snapshots',
        filter: `room_id=eq.${ROOM_ID}`
      }, async (payload) => {
        const snapshot = payload.new;

        // Check if a quiz is active
        if (snapshot?.current_quiz?.quizId && snapshot.mode === 'quiz') {
          const quizId = snapshot.current_quiz.quizId;
          const representativeByTable = snapshot.current_quiz.representativeByTable;
          const isBuzzer = snapshot.current_quiz.ord === 6;

          // Skip if we already answered this quiz
          const quizKey = `${quizId}-${snapshot.current_quiz.startTs}`;
          if (answeredQuizzes.has(quizKey)) {
            return;
          }
          answeredQuizzes.add(quizKey);

          console.log(`\n🎯 Quiz detected: ${snapshot.current_quiz.question}`);
          console.log(`   Quiz ID: ${quizId}`);
          console.log(`   Mode: ${isBuzzer ? 'Buzzer (早押し)' : 'Normal'}`);
          console.log(`   Representative by table: ${representativeByTable}`);

          // Wait a bit before answering (simulate human reaction time)
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

          if (representativeByTable) {
            // Only one representative per table answers
            console.log(`   Sending answers from table representatives...`);

            for (const [tableNo, tableClients] of Object.entries(clientsByTable)) {
              // Pick first client from each table as representative
              const representative = tableClients[0];
              if (representative) {
                try {
                  // Random answer (0-3)
                  const choiceIndex = Math.floor(Math.random() * 4);
                  await sendQuizAnswer(ROOM_ID, representative.token, quizId, choiceIndex);
                  stats.quizAnswersSent++;
                  console.log(`   [Table ${tableNo}] ${representative.displayName} answered: ${choiceIndex}`);

                  // Stagger answers slightly
                  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
                } catch (error) {
                  stats.errors++;
                  console.error(`   [Table ${tableNo}] Error:`, error.message);
                }
              }
            }
          } else {
            // All clients can answer (buzzer mode or sudden death)
            console.log(`   Sending answers from all clients...`);

            for (const client of clients) {
              try {
                const choiceIndex = Math.floor(Math.random() * 4);
                await sendQuizAnswer(ROOM_ID, client.token, quizId, choiceIndex);
                stats.quizAnswersSent++;

                // Stagger answers
                await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
              } catch (error) {
                stats.errors++;
                // Don't log every error to avoid spam
              }
            }
            console.log(`   ✅ All clients answered!`);
          }
        }
      })
      .subscribe();

    console.log('✅ Quiz auto-answer ready!\n');
  }

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nShutting down...');
    clearInterval(statsInterval);

    clients.forEach((client) => {
      client.active = false;
      if (client.tapInterval) {
        clearInterval(client.tapInterval);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('FINAL STATS');
    console.log('='.repeat(60));
    console.log(`Registered: ${stats.registered}/${CLIENT_COUNT}`);
    console.log(`Hello sent: ${stats.helloSent}`);
    console.log(`Taps sent: ${stats.tapsSent}`);
    console.log(`Quiz answers sent: ${stats.quizAnswersSent}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  });

  console.log('\n📊 Simulation running. Press Ctrl+C to stop.\n');
  console.log('👀 Check your projector screen: https://weddingtool.vercel.app/projector/' + ROOM_ID);
  console.log('🎮 Check your admin screen: https://weddingtool.vercel.app/admin/' + ROOM_ID);
}

main().catch(console.error);
