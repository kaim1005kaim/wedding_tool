# 現在の実装仕様書

最終更新: 2025-11-04
コミット: `1cdfd43`

## システム概要

結婚式パーティー用のインタラクティブゲームシステム。管理画面・投影画面・参加者スマホ画面の3つの画面で構成され、リアルタイム同期でゲームを進行する。

## 実装済み機能

### 1. 基本システム

#### ルーム管理
- ルーム作成・削除機能
- 6桁の参加コード自動生成
- 管理者認証（JWT + Bearer Token）
- リアルタイムデータ同期（Supabase Realtime）

#### モード切替
- **idle**: 待機モード
- **countup**: タップチャレンジモード
- **quiz**: クイズモード
- **lottery**: 抽選モード

### 2. 参加者機能

#### 参加登録
- テーブルナンバー + 名前で参加
- 初回のみ登録モーダル表示
- **2回目以降は自動ログイン**（トークンベース）
  - `localStorage`に保存された有効なトークンで自動認証
  - トークン有効期限チェック
  - ファイル: `apps/web/components/join-room.tsx` (lines 45-80)

#### デバイスフィンガープリント
- UUID生成による重複参加防止
- ファイル: `apps/web/components/join-room.tsx` (lines 85-93)

### 3. タップチャレンジ

#### ゲームフロー
1. 管理画面で「タップチャレンジ」モード選択
2. カウントダウン開始（デフォルト10秒、カスタマイズ可能）
3. 参加者がスマホ画面を連打
4. タップ数がリアルタイムで投影画面に表示
5. 終了後、ランキング表示

#### 投影画面表示
- **待機画面**: SVGタイトル + 「開始まで少々お待ちください」
- **カウントダウン**: 巨大な数字のみ表示（20rem フォント）
- **終了画面**: リーダーボード表示

#### スコアリング
- タップ1回 = 1ポイント
- 重複防止: 300ms以内の連続タップは1回とカウント
- DB関数: `apply_tap_delta(room_id, player_id, delta)`

### 4. クイズ機能

#### クイズ作成・管理
- 質問文（最大280文字）
- 4択の選択肢（各最大120文字）
- 正解インデックス（0-3）
- 画像URL（オプション、投影画面のみ表示）
- 順序番号（ord）

#### クイズテンプレート機能
- `is_template` フラグによるテンプレート管理
- テンプレートは `room_id = NULL`
- ルームクイズは `room_id` 設定
- テンプレートからコピーして使用可能
- ファイル:
  - マイグレーション: `supabase/migrations/20251104_add_quiz_template_support.sql`
  - API: `apps/web/app/api/admin/rooms/[roomId]/manage/quizzes/copy-template/route.ts`

#### クイズ進行
1. 管理画面で「クイズ」モード選択
   - **モード切替時に進行状態をリセット**
   - `awarded_quizzes` テーブルをクリア
   - `answers` テーブルをクリア
   - これにより常に1問目から開始可能
   - ファイル: `apps/web/lib/server/room-engine.ts` (lines 21-25)

2. 「クイズ表示」ボタンで次の問題を表示
3. 参加者がスマホで回答
4. 管理画面で「正解を公開」

#### クイズ表示
- **投影画面**:
  - SVGタイトル + 「開始まで少々お待ちください」（待機時）
  - 質問文 + 4択の選択肢（A, B, C, D）
  - 何問目かを表示
  - 画像がある場合は表示

- **スマホ画面**:
  - 質問文
  - 4択ボタン（縦1カラム配置）
  - 回答後: 選択した回答を青色でハイライト
  - **「回答済みです。正解発表までお待ちください」メッセージを質問の上に表示**
  - 正解発表まで選択状態を維持

#### 正解発表
- **投影画面**:
  - 正解の選択肢に **⭕️ 絵文字** を表示（左上）
  - 正解の選択肢を赤グラデーション背景で強調
  - 各選択肢の回答者数を表示

- **スマホ画面**:
  - 正解: 緑色のグラデーション背景
  - 不正解: **青色のグラデーション背景**（以前は赤）
  - 選択状態を維持

#### クイズ設定
- 代表者制度: テーブル代表者のみ回答可能（ON/OFF）
- 制限時間: デフォルト30秒（ON/OFF可能）
- 獲得ポイント: デフォルト10pt（カスタマイズ可能）

#### 早押しクイズモード
- 通常クイズのオプション機能
- 管理画面でチェックボックスで有効化
- **最速正解者のみが得点**
- 回答時刻を記録（`answered_at` タイムスタンプ）
- 専用DB関数: `reveal_buzzer_quiz(room_id, quiz_id, points)`
- **修正済み**: room_snapshot更新でリアルタイム同期
- ファイル:
  - マイグレーション: `supabase/migrations/20251104_add_buzzer_quiz_functions.sql`
  - API: `apps/web/app/api/admin/rooms/[roomId]/buzzer-quiz/reveal/route.ts`

### 5. 抽選機能

#### 抽選管理
- 候補者登録（表示名 + グループタグ）
- グループタグ: `all`, `groom`, `bride`
- 抽選実行で1名をランダム選出
- 重複抽選防止

#### 投影画面表示
- 当選者の表示名を大きく表示
- アニメーション付き

### 6. 投影画面UI

#### シンプルデザイン
- **ステータスバー/ヘッダーなし**
- モードごとにミニマルな表示

#### 待機画面
- タップチャレンジ: `tap-title.svg` + メッセージ
- クイズ: `quiz-title.svg` + メッセージ
- SVGは中央配置、適切な文字間隔

#### SVGタイトル
- **Tap**: 文字間隔を通常に調整（letter-spacing: 0em）
- **Quiz**: センター揃え（text-anchor: middle）
- フォント: Source Serif Variable (600 weight)
- ファイル:
  - `apps/web/public/tap-title.svg`
  - `apps/web/public/quiz-title.svg`

#### カウントダウン
- 巨大な数字のみ表示（20rem、text-only）
- グラデーション背景

### 7. スマホ画面UI

#### シンプル化
- **接続ステータスバーを削除**
- 必要な情報のみ表示

#### クイズ回答フィードバック
- 回答前: 通常の青いボタン
- 回答後: 選択したボタンを青色でハイライト
- 質問の上に「回答済みです」メッセージ（青背景）
- 正解発表後:
  - 正解: 緑色グラデーション
  - 不正解: 青色グラデーション（選択状態維持）

### 8. リーダーボード

#### リアルタイム更新
- `room_snapshots.leaderboard` (JSONB)
- 自動更新: DB関数 `refresh_room_leaderboard(room_id)`

#### 表示項目
- 順位
- 表示名
- テーブルナンバー
- 総得点
- タップ数（タップチャレンジ後）
- クイズ正解数（クイズ後）

## データベーススキーマ

### 主要テーブル

#### rooms
```sql
id: uuid (PK)
code: text (6桁、unique)
mode: text (idle/countup/quiz/lottery)
phase: text (idle/running/ended)
created_at: timestamptz
```

#### players
```sql
id: uuid (PK)
room_id: uuid (FK)
display_name: text
table_no: text
device_fingerprint: text
created_at: timestamptz
```

#### scores
```sql
id: uuid (PK)
room_id: uuid (FK)
player_id: uuid (FK)
total_points: int
quiz_points: int (正解数)
countup_tap_count: int
last_update_at: timestamptz
unique(room_id, player_id)
```

#### quizzes
```sql
id: uuid (PK)
room_id: uuid (nullable) -- テンプレートはNULL
question: text (max 280)
choices: text[] (length 4, max 120 each)
answer_index: int (0-3)
ord: int
image_url: text (nullable)
is_template: boolean (default false)
created_at: timestamptz

constraint: (is_template=true AND room_id IS NULL) OR (is_template=false AND room_id IS NOT NULL)
```

#### answers
```sql
id: uuid (PK)
room_id: uuid (FK)
quiz_id: uuid (FK)
player_id: uuid (FK)
choice_index: int (0-3)
answered_at: timestamptz (早押し用)
created_at: timestamptz
unique(quiz_id, player_id)
```

#### awarded_quizzes
```sql
id: uuid (PK)
quiz_id: uuid (FK)
room_id: uuid (FK)
awarded_at: timestamptz
```

#### room_snapshots
```sql
room_id: uuid (PK, FK)
mode: text
phase: text
countdown_ms: int
leaderboard: jsonb
current_quiz: jsonb
quiz_result: jsonb
lottery_result: jsonb
updated_at: timestamptz
```

### 主要DB関数

#### refresh_room_leaderboard(room_id)
全プレイヤーのスコアを集計してリーダーボードを更新

#### apply_tap_delta(room_id, player_id, delta)
タップスコアを加算

#### record_quiz_answer(room_id, quiz_id, player_id, choice)
クイズ回答を記録（重複防止付き）

#### reveal_quiz(room_id, quiz_id, points)
- 正解者にポイント付与
- 各選択肢の回答数を集計
- `room_snapshots.quiz_result` を更新
- `awarded_quizzes` に記録
- `admin_audit_logs` に記録

#### reveal_buzzer_quiz(room_id, quiz_id, points)
- **最速正解者のみ**にポイント付与
- `answered_at` タイムスタンプでソート
- `room_snapshots.quiz_result` を更新（リアルタイム同期用）
- `awarded_quizzes` に記録
- `admin_audit_logs` に記録

## 技術スタック

### フロントエンド
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion（アニメーション）
- Zustand（状態管理）

### バックエンド
- Next.js API Routes
- Supabase PostgreSQL
- Supabase Realtime（WebSocket）
- JWT認証（jose）

### 主要ファイル構成

```
apps/web/
├── app/
│   ├── admin/[roomId]/page.tsx          # 管理画面
│   ├── projector/[roomId]/page.tsx      # 投影画面
│   ├── join/[code]/page.tsx             # 参加者画面
│   └── api/
│       ├── admin/rooms/[roomId]/        # 管理API
│       │   ├── mode/route.ts
│       │   ├── game/start/route.ts
│       │   ├── quiz/next/route.ts
│       │   ├── quiz/reveal/route.ts
│       │   ├── buzzer-quiz/reveal/route.ts
│       │   └── manage/quizzes/
│       │       ├── route.ts
│       │       ├── [quizId]/route.ts
│       │       └── copy-template/route.ts
│       └── rooms/[roomId]/              # プレイヤーAPI
│           ├── join/route.ts
│           ├── tap/route.ts
│           └── quiz/answer/route.ts
├── components/
│   ├── admin-room.tsx                   # 管理画面コンポーネント
│   ├── projector-view.tsx               # 投影画面コンポーネント
│   ├── join-room.tsx                    # 参加者画面コンポーネント
│   └── brand.tsx                        # 共通UIコンポーネント
├── lib/
│   ├── store/room-store.ts              # Zustand状態管理
│   ├── server/
│   │   ├── room-engine.ts               # ゲームロジック
│   │   └── rooms.ts                     # ルーム管理
│   └── supabase/
│       ├── client.ts                    # クライアントサイド
│       └── server.ts                    # サーバーサイド
└── public/
    ├── tap-title.svg                    # タップタイトル
    └── quiz-title.svg                   # クイズタイトル

supabase/
└── migrations/                          # DBマイグレーション
    ├── 001_phase2.sql
    ├── 20251104_add_quiz_template_support.sql
    ├── 20251104_add_buzzer_quiz.sql
    └── 20251104_add_buzzer_quiz_functions.sql
```

## 開発・デプロイ

### 環境変数
```env
NEXT_PUBLIC_SUPABASE_URL=<supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
JWT_SECRET=<jwt_secret>
```

### コマンド
```bash
# 開発サーバー
pnpm dev

# ビルド
pnpm build

# マイグレーション実行
pnpm exec supabase db push

# 特定のマイグレーションファイル実行
pnpm exec supabase db execute --file supabase/migrations/<filename>.sql
```

### Git管理
- ブランチ: `main`
- コミット規約: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- 最新コミット: `1cdfd43` - fix: improve UX with answer feedback, auto-login, and quiz reset

## 今後の改善予定

詳細は `NEXT_SESSION_TASKS.md` を参照。

### 優先度高
1. クイズ正解/不正解表示改善（⭕️/❌エフェクト）
2. 管理画面順序変更（クイズ → 早押し → タップ）
3. タップランキング表示改善（TOP3のみ表彰台）

### 優先度中
4. クイズランキング表示機能
5. 表彰用画面作成
6. その他UI/UX改善

### 優先度低
7. タップチャレンジ練習/本番2回
8. その他大規模機能追加

## トラブルシューティング

### よくある問題

**クイズが進まない**
→ クイズモードボタンを押すと進行状態がリセットされ、1問目から再開します

**参加者が登録できない**
→ デバイスフィンガープリント（UUID）による重複参加防止が動作している可能性。別のブラウザまたはシークレットモードで試してください

**リアルタイム同期が遅い**
→ Supabase Realtimeの制限。room_snapshotsテーブルの更新頻度を確認

**ビルドエラー**
→ `pnpm build` で型エラーを確認。主な原因はZustand型定義やAPI型の不一致

## 注意事項

- **重要**: クイズモードに切り替えると進行状態（awarded_quizzes, answers）がクリアされます
- 早押しクイズモードはチェックボックスで有効化する通常クイズのオプション機能です
- テンプレートクイズは `is_template=true` かつ `room_id=NULL` の制約があります
- 自動ログイン機能により、2回目以降は登録モーダルをスキップします
- 投影画面とスマホ画面はヘッダー/ステータスバーなしのシンプルデザインです
