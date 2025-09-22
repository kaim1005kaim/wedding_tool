import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const encoder = new TextEncoder();

function getJwtSecret() {
  const secret = process.env.APP_JWT_SECRET;
  if (!secret) {
    throw new Error('APP_JWT_SECRET is not set');
  }
  return encoder.encode(secret);
}

export type AdminTokenPayload = JWTPayload & {
  type: 'admin';
  roomId: string;
};

export type PlayerTokenPayload = JWTPayload & {
  type: 'player';
  roomId: string;
  playerId: string;
};

const ADMIN_TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2 hours
const PLAYER_TOKEN_TTL_SECONDS = 8 * 60 * 60; // 8 hours

export async function signAdminToken(roomId: string) {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + ADMIN_TOKEN_TTL_SECONDS;

  const token = await new SignJWT({ type: 'admin', roomId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .setSubject(`admin:${roomId}`)
    .sign(secret);

  return { token, expiresAt: expiresAt * 1000 };
}

export async function verifyAdminToken(token: string): Promise<AdminTokenPayload> {
  const secret = getJwtSecret();
  const { payload } = await jwtVerify(token, secret, {
    requiredClaims: ['exp', 'iat', 'sub']
  });

  if (payload.type !== 'admin' || typeof payload.roomId !== 'string') {
    throw new Error('Invalid admin token');
  }

  return payload as AdminTokenPayload;
}

export async function signPlayerToken(roomId: string, playerId: string) {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + PLAYER_TOKEN_TTL_SECONDS;

  const token = await new SignJWT({ type: 'player', roomId, playerId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(expiresAt)
    .setSubject(`player:${playerId}`)
    .sign(secret);

  return { token, expiresAt: expiresAt * 1000 };
}

export async function verifyPlayerToken(token: string): Promise<PlayerTokenPayload> {
  const secret = getJwtSecret();
  const { payload } = await jwtVerify(token, secret, {
    requiredClaims: ['exp', 'iat', 'sub']
  });

  if (payload.type !== 'player' || typeof payload.roomId !== 'string' || typeof payload.playerId !== 'string') {
    throw new Error('Invalid player token');
  }

  return payload as PlayerTokenPayload;
}
