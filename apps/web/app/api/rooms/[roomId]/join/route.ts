import { NextResponse } from 'next/server';
import { z } from '@wedding_tool/schema';
import { signPlayerToken } from '@/lib/auth/jwt';
import {
  ensureRoomSnapshot,
  findPlayerSessionByFingerprint,
  recomputeLeaderboard,
  updatePlayer,
  upsertPlayer,
  upsertPlayerSession,
  ensureScoreRecord
} from '@/lib/server/rooms';

const requestSchema = z.object({
  displayName: z.string().trim().min(1).max(30),
  tableNo: z.string().trim().min(1).max(8),
  deviceFingerprint: z.string().max(256).optional() // Increased limit for safety
});

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  try {
    console.log('[Join API] Starting request for room:', params.roomId);

    const json = await request.json();
    console.log('[Join API] Request body:', JSON.stringify(json));

    const { displayName, tableNo, deviceFingerprint } = requestSchema.parse(json);
    const roomId = params.roomId;

    console.log('[Join API] Ensuring room snapshot...');
    await ensureRoomSnapshot(roomId);
    console.log('[Join API] Room snapshot ensured');

    let playerId: string | undefined;

    if (deviceFingerprint) {
      console.log('[Join API] Looking for existing session with fingerprint:', deviceFingerprint);
      playerId = await findPlayerSessionByFingerprint(roomId, deviceFingerprint);
      console.log('[Join API] Found existing player:', playerId);
    }

    if (playerId) {
      console.log('[Join API] Updating existing player...');
      await updatePlayer(playerId, {
        display_name: displayName,
        table_no: tableNo,
        seat_no: null
      });
      console.log('[Join API] Player updated');
    } else {
      console.log('[Join API] Creating new player...');
      const player = await upsertPlayer({ roomId, displayName, tableNo, seatNo: null });
      playerId = player.id;
      console.log('[Join API] New player created:', playerId);
    }

    if (!playerId) {
      return NextResponse.json({ error: 'Failed to register player' }, { status: 500 });
    }

    await upsertPlayerSession({
      room_id: roomId,
      player_id: playerId,
      device_fingerprint: deviceFingerprint ?? null
    });

    await ensureScoreRecord(roomId, playerId);
    await recomputeLeaderboard(roomId);

    const { token, expiresAt } = await signPlayerToken(roomId, playerId);

    return NextResponse.json({ token, playerId, expiresAt });
  } catch (error: any) {
    console.error('Join API error:', error);
    console.error('Full error details:', JSON.stringify(error, null, 2));
    console.error('Error stack:', error?.stack);
    console.error('Error name:', error?.name);
    console.error('Error message:', error?.message);
    console.error('Error code:', error?.code);
    console.error('Error details:', error?.details);
    console.error('Error hint:', error?.hint);

    // Extract error information from various error types
    let errorMessage = 'Failed to join room';
    let errorDetails = null;
    let errorCode = null;
    let errorHint = null;
    let errorStack = null;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;

      // Check for Supabase error format
      if ('code' in error) {
        errorCode = error.code;
      }
      if ('details' in error) {
        errorDetails = error.details;
      }
      if ('hint' in error) {
        errorHint = (error as any).hint;
      }
    } else if (typeof error === 'object' && error !== null) {
      errorMessage = error.message || JSON.stringify(error);
      errorCode = error.code || null;
      errorDetails = error.details || error;
      errorHint = error.hint || null;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        code: errorCode,
        hint: errorHint,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
