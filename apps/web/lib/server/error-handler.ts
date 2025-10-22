import { NextResponse } from 'next/server';
import { z } from '@wedding_tool/schema';

type ZodError = z.ZodError;

/**
 * ユーザーフレンドリーなエラーメッセージマップ
 */
const ERROR_MESSAGES: Record<string, string> = {
  // 認証エラー
  'Unauthorized': '認証が必要です。再度ログインしてください。',
  'Invalid token': 'トークンが無効です。再度ログインしてください。',
  'Token mismatch': 'アクセス権限がありません。',
  'Invalid admin token': '管理者トークンが無効です。',
  'Invalid player token': 'プレイヤートークンが無効です。',

  // レート制限
  'Too many taps': 'タップが速すぎます。少し待ってからお試しください。',
  'Too many requests': 'リクエストが多すぎます。しばらく待ってから再試行してください。',

  // クイズ関連
  'Quiz not found': 'クイズが見つかりません。',
  'Quiz already revealed': 'このクイズは既に採点済みです。',
  'Already answered': '既に回答済みです。',
  'このテーブルは既に回答済みです': 'このテーブルは既に回答済みです。代表者が回答しました。',
  'テーブル番号が必要です': 'テーブル番号が設定されていません。再度参加登録してください。',

  // 抽選関連
  'No eligible players for lottery': '抽選対象のプレイヤーがいません。',
  'Lottery % already drawn': 'この抽選は既に実施済みです。',

  // ルーム関連
  'Room not found': 'ルームが見つかりません。',
  'ルームが見つかりません': 'ルームが見つかりません。ルームコードを確認してください。',

  // その他
  'No quizzes available': '利用可能なクイズがありません。',
  'All quizzes have been revealed': '全てのクイズが終了しました。'
};

/**
 * エラーの種類を判定
 */
function getErrorType(error: unknown): {
  statusCode: number;
  message: string;
  details?: unknown;
} {
  // Zodバリデーションエラー
  if (error instanceof z.ZodError) {
    return {
      statusCode: 400,
      message: '入力データが正しくありません。',
      details: error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
        code: e.code
      }))
    };
  }

  // 通常のErrorオブジェクト
  if (error instanceof Error) {
    // エラーメッセージから対応する日本語メッセージを検索
    const friendlyMessage = Object.entries(ERROR_MESSAGES).find(([key]) =>
      error.message.includes(key)
    )?.[1];

    // ステータスコードの判定
    let statusCode = 500;
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      statusCode = 401;
    } else if (error.message.includes('Token mismatch') || error.message.includes('権限')) {
      statusCode = 403;
    } else if (error.message.includes('not found') || error.message.includes('見つかりません')) {
      statusCode = 404;
    } else if (error.message.includes('Too many') || error.message.includes('多すぎます')) {
      statusCode = 429;
    } else if (error.message.includes('already') || error.message.includes('既に')) {
      statusCode = 409;
    }

    return {
      statusCode,
      message: friendlyMessage || error.message || 'エラーが発生しました。'
    };
  }

  // PostgreSQLエラー（Supabaseから返される）
  if (typeof error === 'object' && error !== null) {
    const pgError = error as { code?: string; message?: string; details?: string };

    if (pgError.code) {
      // PostgreSQLエラーコード
      const pgErrorMessages: Record<string, string> = {
        '23505': 'データが重複しています。',
        '23503': '関連するデータが見つかりません。',
        '23502': '必須項目が入力されていません。',
        '42501': 'データベースへのアクセス権限がありません。',
        'PGRST116': 'データが見つかりません。'
      };

      return {
        statusCode: pgError.code === '23505' ? 409 : 500,
        message: pgErrorMessages[pgError.code] || 'データベースエラーが発生しました。',
        details: process.env.NODE_ENV === 'development' ? pgError.details : undefined
      };
    }
  }

  // 不明なエラー
  return {
    statusCode: 500,
    message: '予期しないエラーが発生しました。しばらくしてから再度お試しください。'
  };
}

/**
 * API エラーハンドラー
 * @param error - キャッチされたエラーオブジェクト
 * @param context - エラーコンテキスト（ログ用）
 * @returns NextResponse with error details
 */
export function handleApiError(error: unknown, context?: string): NextResponse {
  // エラーログ出力
  const timestamp = new Date().toISOString();
  const logContext = context ? `[${context}]` : '';

  console.error(`${timestamp} ${logContext} API Error:`, error);

  // エラー情報を取得
  const { statusCode, message, details } = getErrorType(error);

  // レスポンス作成
  const responseBody: {
    error: string;
    details?: unknown;
    timestamp: string;
  } = {
    error: message,
    timestamp
  };

  // 開発環境のみ詳細を含める
  if (details && process.env.NODE_ENV === 'development') {
    responseBody.details = details;
  }

  return NextResponse.json(responseBody, { status: statusCode });
}

/**
 * 非同期関数用のエラーハンドラーラッパー
 * @param handler - APIルートハンドラー関数
 * @param context - エラーコンテキスト
 * @returns ラップされたハンドラー
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  context?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error, context);
    }
  }) as T;
}

/**
 * バリデーションエラーのレスポンスを作成
 * @param message - エラーメッセージ
 * @param field - フィールド名（オプション）
 * @returns NextResponse with validation error
 */
export function validationError(message: string, field?: string): NextResponse {
  return NextResponse.json(
    {
      error: message,
      details: field ? { field } : undefined,
      timestamp: new Date().toISOString()
    },
    { status: 400 }
  );
}

/**
 * 認証エラーのレスポンスを作成
 * @param message - エラーメッセージ（オプション）
 * @returns NextResponse with authentication error
 */
export function authError(message = '認証が必要です'): NextResponse {
  return NextResponse.json(
    {
      error: message,
      timestamp: new Date().toISOString()
    },
    { status: 401 }
  );
}

/**
 * 権限エラーのレスポンスを作成
 * @param message - エラーメッセージ（オプション）
 * @returns NextResponse with authorization error
 */
export function forbiddenError(message = 'アクセス権限がありません'): NextResponse {
  return NextResponse.json(
    {
      error: message,
      timestamp: new Date().toISOString()
    },
    { status: 403 }
  );
}

/**
 * レート制限エラーのレスポンスを作成
 * @param message - エラーメッセージ（オプション）
 * @param retryAfter - 再試行までの秒数（オプション）
 * @returns NextResponse with rate limit error
 */
export function rateLimitError(
  message = 'リクエストが多すぎます。しばらく待ってから再試行してください。',
  retryAfter?: number
): NextResponse {
  const response = NextResponse.json(
    {
      error: message,
      timestamp: new Date().toISOString()
    },
    { status: 429 }
  );

  if (retryAfter) {
    response.headers.set('Retry-After', retryAfter.toString());
  }

  return response;
}
