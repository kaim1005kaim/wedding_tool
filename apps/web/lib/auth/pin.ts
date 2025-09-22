import bcrypt from 'bcryptjs';

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(pin, hash);
  } catch (error) {
    console.error('[Auth] Failed to verify PIN hash', error);
    return false;
  }
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}
