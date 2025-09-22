#!/usr/bin/env node

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3002';
const TEST_CODE = 'TEST';
const ADMIN_PIN = '1234';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  console.log('🧪 Integration Test Starting...\n');

  try {
    // 1. Test room lookup
    console.log('1️⃣ Testing room lookup...');
    const lookupRes = await fetch(`${BASE_URL}/api/rooms/lookup?code=${TEST_CODE}`);
    if (!lookupRes.ok) throw new Error('Room lookup failed');
    const { roomId } = await lookupRes.json();
    console.log(`   ✅ Room ID: ${roomId}`);

    // 2. Test player join
    console.log('\n2️⃣ Testing player join...');
    const joinRes = await fetch(`${BASE_URL}/api/rooms/${roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Test Player',
        tableNo: 'A',
        seatNo: '1',
        deviceFingerprint: 'test-device-001'
      })
    });
    if (!joinRes.ok) {
      const error = await joinRes.text();
      throw new Error(`Join failed: ${error}`);
    }
    const joinData = await joinRes.json();
    console.log(`   ✅ Player ID: ${joinData.playerId}`);
    console.log(`   ✅ Token: ${joinData.token.substring(0, 20)}...`);

    // 3. Test admin login
    console.log('\n3️⃣ Testing admin login...');
    const adminRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: roomId,
        pin: ADMIN_PIN
      })
    });
    if (!adminRes.ok) {
      const error = await adminRes.text();
      throw new Error(`Admin login failed: ${error}`);
    }
    const adminData = await adminRes.json();
    console.log(`   ✅ Admin token: ${adminData.token.substring(0, 20)}...`);

    // 4. Test admin mode switch
    console.log('\n4️⃣ Testing admin mode switch...');
    const modeRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomId}/mode`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminData.token}`
      },
      body: JSON.stringify({ to: 'countup' })
    });
    if (!modeRes.ok) {
      const error = await modeRes.text();
      throw new Error(`Mode switch failed: ${error}`);
    }
    console.log('   ✅ Mode switched to countup');

    // 5. Test game start
    console.log('\n5️⃣ Testing game start...');
    const startRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomId}/game/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminData.token}`
      }
    });
    if (!startRes.ok) {
      const error = await startRes.text();
      throw new Error(`Game start failed: ${error}`);
    }
    console.log('   ✅ Game started');

    // 6. Test player tap (countup)
    console.log('\n6️⃣ Testing player tap...');
    const tapRes = await fetch(`${BASE_URL}/api/rooms/${roomId}/tap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${joinData.token}`
      },
      body: JSON.stringify({ delta: 5 })
    });
    if (!tapRes.ok) {
      const error = await tapRes.text();
      throw new Error(`Tap failed: ${error}`);
    }
    console.log('   ✅ Tap recorded');

    // 7. Test game stop
    console.log('\n7️⃣ Testing game stop...');
    await delay(1000);
    const stopRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomId}/game/stop`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminData.token}`
      }
    });
    if (!stopRes.ok) {
      const error = await stopRes.text();
      throw new Error(`Game stop failed: ${error}`);
    }
    console.log('   ✅ Game stopped');

    // 8. Test admin logs
    console.log('\n8️⃣ Testing admin logs...');
    const logsRes = await fetch(`${BASE_URL}/api/admin/rooms/${roomId}/logs`, {
      headers: {
        'Authorization': `Bearer ${adminData.token}`
      }
    });
    if (!logsRes.ok) {
      const error = await logsRes.text();
      throw new Error(`Logs fetch failed: ${error}`);
    }
    const logsData = await logsRes.json();
    console.log(`   ✅ Logs count: ${logsData.logs?.length || 0}`);

    console.log('\n✅ All tests passed!');
    console.log('\n📱 Test Instructions:');
    console.log('1. Open http://localhost:3002 on PC');
    console.log('2. Click "管理画面" and enter code: TEST');
    console.log('3. Login with PIN: 1234');
    console.log('4. Open http://localhost:3002/join/TEST on phone');
    console.log('5. Enter your name and join');
    console.log('6. Try the different game modes from admin panel');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

test();