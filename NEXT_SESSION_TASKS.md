# 次セッション作業指示書

## 現在の状況

### 完了済みタスク (8/19)
1. ✅ 参加登録モーダルの文言修正（テーブルナンバー、例A、小文字→大文字変換）
2. ✅ モーダル上の背景見切れ修正
3. ✅ スマホ画面クイズ選択肢を1カラム縦配置に変更
4. ✅ 投影画面クイズ表示改善（質問と回答候補表示、何問目か表示）
5. ✅ タップエフェクト位置修正
6. ✅ スマホ画面に順位とタップ数表示
7. ✅ SVGタイトル画面追加（Quiz/Tap）
8. ✅ クイズ代表者表示機能（投影画面にテーブル代表者リスト表示）

### 残りタスク (11/19)

#### 優先度: 高（比較的シンプル）
1. **クイズ正解/不正解表示改善**
   - 正解時: ⭕️表示、グリーン系エフェクト
   - 不正解時: ❌表示、レッド系エフェクト
   - スマホ画面で自分の結果を表示
   - ファイル: `apps/web/components/join-room.tsx` (QuizOverlay関数)
   - 現在の実装: 正解は赤グラデーション、不正解はエラー色

2. **管理画面順序変更**
   - 現在: モード切替 → タップチャレンジ → クイズ
   - 変更後: モード切替 → クイズ → 早押しクイズ → タップチャレンジ
   - ファイル: `apps/web/components/admin-room.tsx`
   - 簡単なレイアウト変更のみ

3. **タップチャレンジランキング表示改善**
   - 現在: TOP3は横並び、4位以降は4カラムグリッド、最終的に表彰台表示
   - 要望: TOP3のみ表彰台スタイルで表示
   - ファイル: `apps/web/components/projector-view.tsx` (CountupBoard関数)

#### 優先度: 中（中規模の機能追加）
4. **クイズ解答制限時間30秒、ON/OFF機能追加**
   - 現在: 固定20秒 (`apps/web/app/api/admin/rooms/[roomId]/quiz/show/route.ts` line 30)
   - 変更内容:
     - デフォルトを30秒に変更
     - 管理画面にチェックボックスを追加（制限時間ON/OFF）
     - ONの場合のみタイマー表示
   - 関連ファイル:
     - `apps/web/components/admin-room.tsx` (UI)
     - `apps/web/app/api/admin/rooms/[roomId]/quiz/show/route.ts` (API)
     - `apps/web/components/join-room.tsx` (スマホ画面タイマー表示制御)

5. **クイズランキング表示機能追加**
   - クイズ終了後、正解数ランキングを表示
   - タップチャレンジと同じ形式（スクロール → TOP3 → 表彰台）
   - ファイル: `apps/web/components/projector-view.tsx`
   - leaderboardの`quizPoints`を使用

6. **表彰用画面作成**
   - 新規ページ: `/awards/[roomId]`
   - タップチャレンジとクイズの総合ランキング表示
   - 印刷可能なレイアウト
   - 参考: `apps/web/app/projector/[roomId]/page.tsx`

7. **クイズ画像追加機能（投影画面のみ）**
   - クイズ作成時に画像URLを追加できるように
   - 投影画面のみ画像を表示（スマホ画面は非表示）
   - DB: `quizzes`テーブルに`image_url`カラム追加
   - ファイル:
     - `apps/web/components/admin-room.tsx` (画像URL入力フィールド)
     - `apps/web/components/projector-view.tsx` (画像表示)

#### 優先度: 低（大規模な機能追加・設計変更）
8. **クイズをルーム単位から共通保存に変更**
   - **現在の構造**: `quizzes`テーブルは`room_id`で各ルームに紐付けられている
   - **変更後**: 全ルームで共通のクイズプールを使用

   **実装方法（推奨）**:

   1. **新しいテーブル構造**:
      ```sql
      -- 共通クイズプール（room_idを削除）
      create table quiz_templates (
        id uuid primary key default gen_random_uuid(),
        question text not null,
        choices text[] not null check (array_length(choices, 1) = 4),
        answer_index int not null check (answer_index between 0 and 3),
        image_url text,
        created_at timestamptz default now()
      );

      -- ルームごとのクイズ使用履歴（どのクイズを使ったか記録）
      create table room_quiz_usage (
        id uuid primary key default gen_random_uuid(),
        room_id uuid references rooms(id) on delete cascade,
        quiz_template_id uuid references quiz_templates(id) on delete cascade,
        ord int not null,  -- このルームでの順番
        used_at timestamptz default now(),
        unique(room_id, quiz_template_id)
      );
      ```

   2. **マイグレーション手順**:
      - 既存の`quizzes`テーブルから`quiz_templates`へデータ移行
      - `room_quiz_usage`に使用履歴を作成
      - `answers`テーブルの`quiz_id`は`room_quiz_usage.id`を参照するように変更
      - または、`answers`に`quiz_template_id`と`room_id`の両方を持たせる

   3. **影響範囲**:
      - **DB**: マイグレーションファイル作成 (`supabase/migrations/`)
      - **API**:
        - `apps/web/app/api/admin/rooms/[roomId]/manage/quizzes/route.ts` (クイズ一覧取得)
        - `apps/web/app/api/admin/rooms/[roomId]/manage/quizzes/[quizId]/route.ts` (CRUD)
        - `apps/web/app/api/admin/rooms/[roomId]/quiz/show/route.ts` (クイズ表示)
      - **ロジック**:
        - `apps/web/lib/server/room-engine.ts` (`showQuiz`, `revealQuiz`関数)
        - SQLクエリをすべて修正
      - **UI**:
        - `apps/web/components/admin-room.tsx` (クイズ管理UI)
        - 共通クイズプールから選択するUIに変更

   4. **メリット**:
      - クイズを一度作成すれば全ルームで再利用可能
      - クイズのメンテナンスが一元化

   5. **デメリット**:
      - 各ルームでカスタムクイズを作りたい場合の柔軟性が下がる
      - マイグレーションの複雑さ

   **代替案**: 既存の`quizzes`テーブルに`is_template`フラグを追加し、`room_id`がnullのクイズを共通プールとして扱う方法もあります。

9. **早押しクイズ機能実装**
   - 新モード追加: `early_answer_quiz`
   - 機能:
     - 最初に回答したプレイヤー/テーブルのみ得点
     - ランキング表示
     - 管理画面で設定・操作
   - 実装箇所:
     - DB: 新テーブル `early_answer_quiz_answers`
     - モード追加: `apps/web/lib/store/room-store.ts`
     - UI: `apps/web/components/admin-room.tsx`, `projector-view.tsx`, `join-room.tsx`
     - API: `apps/web/app/api/admin/rooms/[roomId]/early-answer-quiz/**`

10. **タップチャレンジ練習/本番2回実装**
    - 現在: 1回のみ
    - 変更後: 練習ラウンド + 本番ラウンド
    - 管理画面で練習/本番を切り替え
    - 本番のスコアのみランキングに反映
    - 実装箇所:
      - `apps/web/components/admin-room.tsx` (練習/本番切り替えボタン)
      - `apps/web/lib/server/room-engine.ts` (スコア管理ロジック)
      - `apps/web/components/projector-view.tsx` (表示ラベル変更)

11. **各種バグ修正**
    - クイズ選択し続けるバグ（詳細不明、要調査）
    - 画面遷移の問題（詳細不明、要調査）
    - 最初に戻るボタン（どこに追加？要確認）

## 重要なファイルと役割

### フロントエンド
- `apps/web/components/admin-room.tsx` - 管理画面（モード切替、ゲーム操作、クイズ/抽選管理）
- `apps/web/components/projector-view.tsx` - 投影画面（待機、タップ、クイズ、抽選）
- `apps/web/components/join-room.tsx` - スマホ参加画面（登録、タップ、クイズ）
- `apps/web/lib/store/room-store.ts` - Zustandグローバルステート

### バックエンド
- `apps/web/lib/server/room-engine.ts` - ゲームロジックのコア
- `apps/web/app/api/admin/rooms/[roomId]/**` - 管理API
- `apps/web/app/api/rooms/[roomId]/**` - プレイヤーAPI

### データベース
- Supabase使用
- マイグレーションファイル: `supabase/migrations/`

**主要テーブル**:
- `rooms` - ルーム情報（id, code, mode, phase）
- `players` - プレイヤー情報（id, room_id, display_name, table_no）
- `scores` - スコア（room_id, player_id, total_points）
- `quizzes` - クイズ（id, room_id, question, choices[], answer_index, ord, image_url）
- `answers` - クイズ回答（quiz_id, player_id, choice_index）
- `room_snapshots` - リアルタイム配信用スナップショット
- `awarded_quizzes` - 正解発表済みクイズの記録
- `lottery_picks` - 抽選結果

**重要な関数**:
- `refresh_room_leaderboard(room_id)` - リーダーボード更新
- `apply_tap_delta(room_id, player_id, delta)` - タップスコア加算
- `record_quiz_answer(room_id, quiz_id, player_id, choice)` - クイズ回答記録
- `reveal_quiz(room_id, quiz_id, points)` - クイズ正解発表＆スコア加算
- `draw_lottery(room_id, kind)` - 抽選実行

### アセット
- SVGタイトル: `apps/web/public/quiz-title.svg`, `tap-title.svg`
- クイズ背景画像: `apps/web/public/quiz-backgrounds/[1-5]-smartphone.png`

## 技術スタック
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion (アニメーション)
- Zustand (状態管理)
- Supabase (DB + Realtime)

## 推奨作業順序

### セッション1: UI改善（2-3時間）
1. クイズ正解/不正解表示改善
2. 管理画面順序変更
3. タップチャレンジランキング表示改善

### セッション2: 中規模機能（3-4時間）
4. クイズ解答制限時間30秒、ON/OFF機能
5. クイズランキング表示機能
6. 表彰用画面作成
7. クイズ画像追加機能

### セッション3: 大規模機能（5-8時間）
8. 早押しクイズ機能実装
9. タップチャレンジ練習/本番2回実装
10. クイズ共通保存化（必要に応じて）
11. バグ修正

## 注意事項
- 各機能追加時は必ずビルドテストを実施
- コミットメッセージはわかりやすく、feat/fix/refactorで分類
- 大きな変更の前にブランチ作成を推奨
- DB変更時はマイグレーションファイルを作成（`supabase/migrations/`）

## 最終コミット
最新のコミット: `a74d9db` - feat: add SVG title screens and quiz participants display
