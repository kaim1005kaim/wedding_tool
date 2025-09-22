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
  displayName: z.string().min(1).max(32),
  tableNo: z.string().max(8).optional().nullable(),
  seatNo: z.string().max(8).optional().nullable(),
  deviceFingerprint: z.string().max(128).optional()
});

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  try {
    const json = await request.json();
    const { displayName, tableNo, seatNo, deviceFingerprint } = requestSchema.parse(json);
    const roomId = params.roomId;

    await ensureRoomSnapshot(roomId);

    let playerId: string | undefined;

    if (deviceFingerprint) {
      playerId = await findPlayerSessionByFingerprint(roomId, deviceFingerprint);
    }

    if (playerId) {
      await updatePlayer(playerId, {
        display_name: displayName,
        table_no: tableNo ?? null,
        seat_no: seatNo ?? null
      });
    } else {
      const player = await upsertPlayer({ roomId, displayName, tableNo, seatNo });
      playerId = player.id;
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
  } catch (error) {
    console.error('Join API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to join room' },
      { status: 500 }
    );
  }
}
