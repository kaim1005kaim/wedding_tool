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
   - 現在: クイズは各ルームに紐付いている
   - 変更後: 全ルームで共通のクイズプールを使用
   - DB変更必要:
     - `quizzes`テーブルから`room_id`を削除
     - 共通クイズプール用の新テーブル作成
   - 影響範囲大:
     - `apps/web/app/api/admin/rooms/[roomId]/manage/quizzes/**`
     - `apps/web/lib/server/room-engine.ts`

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
- 主要テーブル: `rooms`, `players`, `quizzes`, `quiz_answers`, `leaderboard_snapshots`

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
