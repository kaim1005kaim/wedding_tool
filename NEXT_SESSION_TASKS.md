# 次回セッション作業メモ

## 現在の状況

### ✅ 完了した修正（本セッション）

1. **第3問の正解修正**: とりとり → とりっぴー（answerIndex: 2 → 3）

2. **回答数分布の修正**:
   - 問題: `answers`テーブルに外部キー制約があり、ハードコードされたクイズIDでは回答を保存できなかった
   - 解決:
     - SQLで外部キー制約を削除: `ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_quiz_id_fkey;`
     - コード側で直接`upsert`を使用するように変更
   - 結果: 回答数分布が正しく表示されるようになった

3. **第5問後のランキング表示**:
   - 第5問の正解公開後、「次のクイズへ」→「ランキング表示へ」に変更
   - クリックすると`/api/admin/rooms/[roomId]/game/show-ranking`を呼び出し

4. **クイズランキング表示の改善**:
   - タイトル: "クイズ正解ランキング"
   - 正解数を「正解数X/5」形式で表示
   - 1位に王冠👑を表示
   - 表示形式: "1位　Aチーム　◯◯◯◯さん　正解数X/5"

5. **latencyMsのバグ修正**:
   - 問題: 不正確な計算式により負の値が生成され、Zodバリデーションエラーが発生
   - 解決: `answers`テーブルから`latency_ms`を直接取得するように修正
   - スキーマ調整: `latencyMs`の`.nonnegative()`制約を削除（既存の不正データに対応）

### スマホ側のUI改善

- ✅ 正解時の背景色を赤に変更（投影画面と統一）
- ✅ ⭕️エフェクトをスケールアップ&フェードアウトに変更（表示し続けない）
- ✅ 正解表示を背景なし黒字に変更: "⭕ 正解！あなたの回答: X"

### 管理画面の改善

- ✅ 第5問後のボタンを「ランキング表示へ」に変更
- ✅ 「正解を公開」ボタンは公開後に無効化
- ✅ ボタン文言の動的変更: "クイズ開始" → "次のクイズへ" → "ランキング表示へ"

## 🚨 現在の問題

### 1. モード切り替えエラー
**症状**: アイドルからクイズモードへの遷移時に400エラー
**原因**: データベースの`room_snapshots.quiz_result`に負の`latencyMs`が含まれている（過去のバグで生成）
**対応**:
- ✅ スキーマの`.nonnegative()`制約を削除（コミット: 5834354）
- 🔄 デプロイ待ち - この修正でエラーが解消されるはず

**もし解決しない場合の追加対応**:
データベースの不正データを直接修正するSQL（Supabase SQL Editorで実行）:
```sql
UPDATE room_snapshots
SET quiz_result = jsonb_set(
  quiz_result,
  '{awarded}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN (elem->>'latencyMs')::int < 0
        THEN elem - 'latencyMs' || '{"latencyMs": null}'::jsonb
        ELSE elem
      END
    )
    FROM jsonb_array_elements(quiz_result->'awarded') elem
  )
)
WHERE quiz_result IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(quiz_result->'awarded') elem
    WHERE (elem->>'latencyMs')::int < 0
  );
```

## 📋 残タスク

### 優先度: 高

1. **モード切り替えエラーの確認**:
   - デプロイ後、アイドル→クイズモードへの遷移が正常に動作するか確認
   - まだエラーが出る場合は上記SQLでデータを修正

2. **クイズリセット機能の確認**:
   - クイズリセットを押したら最初（ord: 1）に戻るか確認
   - 既に実装済みだが、動作確認が必要

3. **早押しクイズ（第6問）の動作確認**:
   - 第6問は`isBuzzer: true`
   - 「早押しクイズ開始」ボタンで第6問に移行
   - 「次のクイズへ」では第6問に行かない仕様

### 優先度: 中

4. **クイズランキングの4-12位表示**（オプション）:
   - 現在は1-3位のみ表示
   - デザイン画像では4-12位を3列グリッドで表示
   - `/Users/kaimoriguchi/Downloads/スクリーンショット 2025-11-05 14.45.58.png`参照
   - 実装するなら`projector-view.tsx`の`QuizBoard`コンポーネント（890行目以降）に追加

5. **デバッグログの削除**:
   - 本番環境に不要なログを削除
   - `console.log('[revealQuiz]...')`
   - `console.log('[recordQuizAnswer]...')`
   - `console.log('[QuizBoard] Render:...')`
   - `console.log('[RoomRuntime]...')`

## 🗂️ 主要ファイル

### クイズデータ
- `/apps/web/lib/hardcoded-quizzes.ts` - クイズ問題と正解

### サーバーサイド
- `/apps/web/lib/server/room-engine.ts` - クイズロジック（回答記録、正解公開）
- `/apps/web/app/api/admin/rooms/[roomId]/quiz/` - クイズAPI

### フロントエンド
- `/apps/web/components/admin-room.tsx` - 管理画面
- `/apps/web/components/projector-view.tsx` - 投影画面（ランキング表示）
- `/apps/web/components/join-room.tsx` - スマホ側プレイヤー画面
- `/apps/web/components/room-runtime.tsx` - リアルタイム通信

### スキーマ
- `/packages/schema/src/index.ts` - Zod型定義
- `/packages/schema/src/events.ts` - イベント型定義

### データベース
- `/supabase/migrations/20251105_remove_quiz_fk.sql` - 外部キー制約削除

## 🔧 実行済みSQL

```sql
-- 外部キー制約の削除（既に実行済み）
ALTER TABLE answers DROP CONSTRAINT IF EXISTS answers_quiz_id_fkey;
COMMENT ON COLUMN answers.quiz_id IS 'Quiz ID - may reference hardcoded quizzes not in quizzes table';
```

## 📊 データ構造

### WEDDING_QUIZZES (6問)
- ord: 1-6
- 問1-5: 通常クイズ
- 問6: 早押しクイズ（`isBuzzer: true`）
- 1問10点

### room_snapshots.quiz_result
```typescript
{
  quizId: string,
  correctIndex: 0-3,
  perChoiceCounts: [number, number, number, number],
  awarded: Array<{
    playerId: string,
    delta: number,
    displayName?: string,
    tableNo?: string | null,
    latencyMs?: number | null // 負の値も許容（レガシーデータ対応）
  }>
}
```

## 🎯 次回の作業フロー

1. デプロイ完了を確認
2. モード切り替えエラーが解消されたか確認
3. もしまだエラーが出る場合、上記のSQLでデータを修正
4. 早押しクイズ（第6問）の動作確認
5. クイズリセット機能の動作確認
6. （オプション）4-12位のランキング表示実装
7. デバッグログの削除

## 📝 メモ

- ランキング表示は`/api/admin/rooms/[roomId]/game/show-ranking`を使用
- `showRanking`フラグが`true`の時に投影画面でランキングが表示される
- 正解数は`quizPoints / 10`で計算（1問10点）
- 第5問後は自動的に第6問に進まず、ランキング表示へ遷移
- 早押しクイズは別ボタン「早押しクイズ開始」で開始

## 🐛 既知のバグ（修正済み）

1. ✅ 外部キー制約により回答が保存できない → 制約削除
2. ✅ 負のlatencyMsによるバリデーションエラー → スキーマ調整
3. ✅ 第3問の正解が間違っている → 修正済み
4. ✅ 回答数分布が常に0 → 外部キー制約削除で解決
5. ✅ 正解公開後もクイズボタンが無効 → ロジック改善

## 最新コミット

- `5834354` - スキーマからnonnegative制約を削除（latencyMs）
- `241a449` - latencyMsを正しく取得するように修正
- `9365a9c` - 第5問後のランキング表示API呼び出し
- `02947d4` - クイズランキング表示とUI改善
- `28e8fd2` - 外部キー制約バイパス
