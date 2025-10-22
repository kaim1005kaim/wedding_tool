import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * CSRF保護とセキュリティヘッダーを追加するミドルウェア
 */
export function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  // APIルートに対してのみCSRF保護を適用
  if (pathname.startsWith('/api/')) {
    // POSTリクエストのOriginチェック（CSRF保護）
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
      const requestOrigin = request.headers.get('origin');
      const host = request.headers.get('host');

      // Originヘッダーが存在し、かつホストと一致しない場合はブロック
      if (requestOrigin && host) {
        try {
          const requestUrl = new URL(requestOrigin);
          const hostUrl = new URL(`https://${host}`);

          if (requestUrl.host !== hostUrl.host) {
            console.warn(`[CSRF] Blocked request from different origin: ${requestOrigin} to ${host}`);
            return NextResponse.json(
              { error: 'CSRF check failed. Request origin does not match.' },
              { status: 403 }
            );
          }
        } catch (error) {
          console.error('[CSRF] Error parsing URLs:', error);
          return NextResponse.json(
            { error: 'Invalid request' },
            { status: 400 }
          );
        }
      }

      // Refererチェック（Originがない場合のフォールバック）
      if (!requestOrigin) {
        const referer = request.headers.get('referer');
        if (referer && host) {
          try {
            const refererUrl = new URL(referer);
            const hostUrl = new URL(`https://${host}`);

            if (refererUrl.host !== hostUrl.host) {
              console.warn(`[CSRF] Blocked request with mismatched referer: ${referer}`);
              return NextResponse.json(
                { error: 'CSRF check failed.' },
                { status: 403 }
              );
            }
          } catch (error) {
            console.error('[CSRF] Error parsing referer URL:', error);
          }
        }
      }
    }
  }

  // レスポンスヘッダーにセキュリティヘッダーを追加
  const response = NextResponse.next();

  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co; " +
    "frame-ancestors 'none';"
  );

  // その他のセキュリティヘッダー
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // Strict Transport Security (HTTPS強制)
  if (request.nextUrl.protocol === 'https:') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  return response;
}

// ミドルウェアを適用するパス
export const config = {
  matcher: [
    /*
     * 以下を除く全てのパスにマッチ:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
