import { NextResponse } from 'next/server';
import { z } from '@wedding_tool/schema';
import { fetchRoomAdmin } from '@/lib/server/rooms';
import { signAdminToken } from '@/lib/auth/jwt';
import { verifyPin } from '@/lib/auth/pin';

const requestSchema = z.object({
  roomId: z.string().uuid(),
  pin: z.string().min(1)
});

export async function POST(request: Request) {
  const json = await request.json();
  const { roomId, pin } = requestSchema.parse(json);

  const adminRecord = await fetchRoomAdmin(roomId);

  if (adminRecord?.disabled) {
    return NextResponse.json({ error: 'Admin access disabled for this room.' }, { status: 403 });
  }

  let pinValid = false;

  if (adminRecord) {
    pinValid = await verifyPin(pin, adminRecord.pin_hash);
  }

  if (!pinValid) {
    const fallbackPin = process.env.ADMIN_SHARED_PASSCODE;
    if (fallbackPin && fallbackPin === pin) {
      pinValid = true;
    }
  }

  if (!pinValid) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }

  const { token, expiresAt } = await signAdminToken(roomId);

  return NextResponse.json({ token, expiresAt });
}
