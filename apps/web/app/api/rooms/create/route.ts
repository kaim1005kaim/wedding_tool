import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Generate a random room code (4 characters, alphanumeric)
function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST() {
  try {
    // Generate a unique room code
    let roomCode = generateRoomCode();
    let attempts = 0;
    const maxAttempts = 10;

    // Check if code already exists, regenerate if needed
    while (attempts < maxAttempts) {
      const { data: existing } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', roomCode)
        .single();

      if (!existing) break;

      roomCode = generateRoomCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique room code' },
        { status: 500 }
      );
    }

    // Create the room
    const { data: room, error } = await supabase
      .from('rooms')
      .insert({
        code: roomCode,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create room:', error);
      return NextResponse.json(
        { error: 'Failed to create room', details: error.message },
        { status: 500 }
      );
    }

    // Initialize room snapshot
    await supabase
      .from('room_snapshots')
      .insert({
        room_id: room.id,
        mode: 'idle',
        phase: 'idle',
        countdown_ms: 0,
        leaderboard: [],
        updated_at: new Date().toISOString()
      });

    return NextResponse.json({
      roomId: room.id,
      code: room.code,
      message: 'Room created successfully'
    });
  } catch (err) {
    console.error('Room creation error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
