export function extractBearerToken(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }
  return token.trim();
}
