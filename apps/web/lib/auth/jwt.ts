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

// JWT有効期限を延長（披露宴は通常2-3時間なので12時間あれば十分）
const ADMIN_TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12時間
const PLAYER_TOKEN_TTL_SECONDS = 12 * 60 * 60; // 12時間
const REFRESH_THRESHOLD_SECONDS = 30 * 60; // リフレッシュ可能になるまでの残り時間（30分）

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

/**
 * 管理者トークンをリフレッシュ
 * @param oldToken - 既存のトークン
 * @returns 新しいトークンと有効期限（リフレッシュ可能な場合）、またはnull
 */
export async function refreshAdminToken(oldToken: string): Promise<{ token: string; expiresAt: number } | null> {
  try {
    const payload = await verifyAdminToken(oldToken);
    const now = Math.floor(Date.now() / 1000);

    // 有効期限が近い場合のみリフレッシュ可能
    if (payload.exp && payload.exp - now < REFRESH_THRESHOLD_SECONDS) {
      return signAdminToken(payload.roomId);
    }

    return null;
  } catch (error) {
    // トークンが無効な場合はnullを返す
    return null;
  }
}

/**
 * プレイヤートークンをリフレッシュ
 * @param oldToken - 既存のトークン
 * @returns 新しいトークンと有効期限（リフレッシュ可能な場合）、またはnull
 */
export async function refreshPlayerToken(oldToken: string): Promise<{ token: string; expiresAt: number } | null> {
  try {
    const payload = await verifyPlayerToken(oldToken);
    const now = Math.floor(Date.now() / 1000);

    // 有効期限が近い場合のみリフレッシュ可能
    if (payload.exp && payload.exp - now < REFRESH_THRESHOLD_SECONDS) {
      return signPlayerToken(payload.roomId, payload.playerId);
    }

    return null;
  } catch (error) {
    // トークンが無効な場合はnullを返す
    return null;
  }
}

/**
 * トークンの残り有効期限（秒）を取得
 * @param token - JWTトークン
 * @returns 残り秒数、または-1（無効なトークン）
 */
export async function getTokenTimeRemaining(token: string): Promise<number> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);

    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      return Math.max(0, payload.exp - now);
    }

    return -1;
  } catch (error) {
    return -1;
  }
}
