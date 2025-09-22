#!/usr/bin/env node
/* eslint-disable no-console */
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error('Supabase credentials are missing. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const client = createClient(url, serviceRole, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function main() {
  const roomCode = process.env.SEED_ROOM_CODE ?? 'TEST';
  const roomId = randomUUID();

  console.log('Seeding room', roomCode);

  const { error: roomError } = await client.from('rooms').upsert({
    id: roomId,
    code: roomCode,
    mode: 'idle',
    phase: 'idle'
  });

  if (roomError) {
    throw roomError;
  }

  const pin = process.env.SEED_ADMIN_PIN ?? '1234';
  const pinHash = await bcrypt.hash(pin, 10);

  await client.from('room_admins').upsert({
    room_id: roomId,
    pin_hash: pinHash,
    disabled: false
  });

  const players = Array.from({ length: 5 }, (_, index) => ({
    id: randomUUID(),
    room_id: roomId,
    display_name: `Guest ${index + 1}`,
    table_no: ['A', 'B', 'C', 'D', 'E'][index] ?? null,
    seat_no: String(index + 1)
  }));

  await client.from('players').insert(players);

  await client.from('player_sessions').insert(
    players.map((player) => ({
      room_id: roomId,
      player_id: player.id,
      device_fingerprint: null
    }))
  );

  await client.from('scores').insert(
    players.map((player) => ({
      room_id: roomId,
      player_id: player.id,
      total_points: 0
    }))
  );

  const quizzes = [
    {
      id: randomUUID(),
      room_id: roomId,
      question: '新郎の出身地はどこ？',
      choices: ['北海道', '東京', '大阪', '福岡'],
      answer_index: 1,
      ord: 1
    },
    {
      id: randomUUID(),
      room_id: roomId,
      question: '新婦の好きな食べ物は？',
      choices: ['寿司', 'ステーキ', 'パスタ', 'パンケーキ'],
      answer_index: 3,
      ord: 2
    },
    {
      id: randomUUID(),
      room_id: roomId,
      question: 'ふたりの初デートはどこ？',
      choices: ['映画館', '水族館', 'カフェ', '遊園地'],
      answer_index: 0,
      ord: 3
    }
  ];

  await client.from('quizzes').insert(quizzes);

  await client.from('room_snapshots').upsert({
    room_id: roomId,
    mode: 'idle',
    phase: 'idle',
    countdown_ms: 0,
    leaderboard: players.map((player, index) => ({
      playerId: player.id,
      name: player.display_name,
      points: 0,
      rank: index + 1
    })),
    current_quiz: null,
    lottery_result: null
  });

  console.log('Seed completed. Room ID:', roomId);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
