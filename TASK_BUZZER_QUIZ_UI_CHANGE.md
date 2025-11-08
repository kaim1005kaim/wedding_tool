# 早押しクイズUI変更タスク

## 概要
現在の早押しクイズは「回答ボタン」をタップして参加する方式だが、これを「4択のいずれかをタップする」方式に変更する。タップした時間（レイテンシ）を計測し、正解者のみをランキング表示する。

## 現在の実装

### クイズ6（早押しクイズ）の仕様
- **問題**: 今日（11月23日）は何の日？
- **正解**: 選択肢のインデックス0
- **クイズID**: `00000000-0000-0000-0000-000000000006`
- **クイズ番号（ord）**: 6

### 現在のフロー
1. 管理パネルで「早押しクイズ開始」ボタンを押下
2. スマホ画面に「回答ボタン」が表示される
3. ユーザーが「回答」ボタンをタップ
4. タップ時間（latency_ms）を記録
5. 管理パネルで「正解公開」ボタンを押下
6. 投影画面にランキング表示（回答時間順）

### 関連ファイル

#### スマホ画面（クイズ表示・回答）
- **ファイル**: `apps/web/components/join-room.tsx`
- **早押しクイズUI**: Line 825-904付近
  - 現在: 「回答」ボタン1つのみ
  - 変更後: 4択ボタンを表示し、タップ時間を計測

#### 投影画面（ランキング表示）
- **ファイル**: `apps/web/components/projector-view.tsx`
- **早押しランキング**: Line 705-720付近
  ```typescript
  const buzzerRanking = isBuzzerQuiz && quizResult?.awarded
    ? quizResult.awarded
        .filter(a => a.latencyMs != null && a.latencyMs >= 0)
        .sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity))
  ```
  - 正解者のみをフィルタリングする必要がある

#### バックエンド（回答処理）
- **ファイル**: `apps/web/app/api/rooms/[roomId]/quiz/answer/route.ts`
- **処理内容**:
  - `choice_index`: ユーザーが選択した選択肢（0-3）
  - `latency_ms`: 問題表示からタップまでの時間
  - `answers`テーブルに保存

#### 正解公開処理
- **ファイル**: `apps/web/lib/server/room-engine.ts`
- **関数**: `revealQuiz()`（Line 374-520付近）
  - 正解者（`choice_index === quiz.answerIndex`）にポイント付与
  - `quiz_result.awarded`に正解者リストを格納

## 実装タスク

### タスク1: スマホ画面のUI変更
**ファイル**: `apps/web/components/join-room.tsx`

**現在のコード（Line 825-904付近）**:
```typescript
{activeQuiz.ord === 6 && (
  <div className="mt-4">
    <button
      onClick={handleAnswer}
      className="w-full py-6 rounded-2xl bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold text-3xl"
    >
      回答
    </button>
  </div>
)}
```

**変更内容**:
1. 早押しクイズ（ord === 6）の場合、4択ボタンを表示
2. 各ボタンをタップした時点で回答送信
3. タップ時間（`activeQuiz.startTs`からの経過時間）を計算
4. 回答後は「回答済み」状態を表示

**実装例**:
```typescript
{activeQuiz.ord === 6 && !hasAnswered && (
  <div className="mt-4 space-y-3">
    {activeQuiz.choices.map((choice, index) => (
      <button
        key={index}
        onClick={() => handleBuzzerAnswer(index)}
        className="w-full py-6 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold text-2xl shadow-lg hover:scale-105 transition-transform"
      >
        {choice}
      </button>
    ))}
  </div>
)}

{activeQuiz.ord === 6 && hasAnswered && (
  <div className="mt-4 text-center">
    <p className="text-2xl font-bold text-green-600">回答済み</p>
    <p className="text-lg text-gray-600">正解発表をお待ちください</p>
  </div>
)}
```

**handleBuzzerAnswer関数**:
```typescript
const handleBuzzerAnswer = async (choiceIndex: number) => {
  if (!activeQuiz || !playerId || !playerToken) return;

  const latencyMs = Date.now() - activeQuiz.startTs;

  try {
    const response = await fetch(`/api/rooms/${roomId}/quiz/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${playerToken}`
      },
      body: JSON.stringify({
        quizId: activeQuiz.quizId,
        choiceIndex,
        latencyMs
      })
    });

    if (!response.ok) throw new Error('回答の送信に失敗しました');

    setHasAnswered(true);
  } catch (error) {
    console.error('Failed to submit buzzer answer:', error);
  }
};
```

### タスク2: 投影画面のランキング表示修正
**ファイル**: `apps/web/components/projector-view.tsx`

**現在のコード（Line 705-720付近）**:
```typescript
const buzzerRanking = isBuzzerQuiz && quizResult?.awarded
  ? quizResult.awarded
      .filter(a => a.latencyMs != null && a.latencyMs >= 0)
      .sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity))
```

**変更内容**:
- 既に正解者のみがフィルタリングされているため、変更不要
- `revealQuiz()`が`choice_index === quiz.answerIndex`の条件で正解者のみを`awarded`に追加している

**確認事項**:
- ランキング表示で「正解数」ではなく「回答時間」が表示されていること
- Line 948-950付近:
  ```typescript
  {isBuzzerQuiz && 'latencyMs' in entry
    ? `${((entry.latencyMs ?? 0) / 1000).toFixed(2)}秒`
    : `正解数${'correctCount' in entry ? entry.correctCount : 0}/5`}
  ```

### タスク3: バックエンドの確認
**ファイル**: `apps/web/app/api/rooms/[roomId]/quiz/answer/route.ts`

**確認事項**:
- `choice_index`と`latency_ms`が正しく保存されていること
- 早押しクイズの場合も通常クイズと同じエンドポイントを使用

**現在の実装**（確認のみ、変更不要）:
```typescript
const { error } = await client
  .from('answers')
  .insert({
    room_id: roomId,
    quiz_id: quizId,
    player_id: session.player_id,
    choice_index: choiceIndex,
    latency_ms: latencyMs,
    answered_at: new Date().toISOString()
  });
```

### タスク4: 正解公開処理の確認
**ファイル**: `apps/web/lib/server/room-engine.ts`

**関数**: `revealQuiz()`（Line 374-520付近）

**確認事項**:
- 正解者のみが`awarded`に追加されていること（Line 459-493付近）
- `latencyMs`が正しく`awarded`に含まれていること（Line 471）

**現在の実装**（確認のみ、変更不要）:
```typescript
if (awardedPlayerIds.length > 0) {
  const { data: players } = await client
    .from('players')
    .select('id, display_name, table_no')
    .in('id', awardedPlayerIds);

  for (const answer of answers) {
    if (answer.choice_index === quiz.answerIndex) {
      const player = players?.find(p => p.id === answer.player_id);
      awardedPlayers.push({
        playerId: answer.player_id,
        delta: awardedPoints,
        displayName: player?.display_name,
        tableNo: player?.table_no ?? null,
        latencyMs: answer.latency_ms
      });
    }
  }
}
```

## テスト手順

### 1. ローカル環境での確認
1. `npm run build`でビルド成功を確認
2. 開発サーバーを起動: `npm run dev`

### 2. 動作確認
1. 管理パネルでクイズ1-5を進める
2. クイズ5のランキング表示後、「早押しクイズ開始」ボタンを押下
3. **スマホ画面の確認**:
   - 4択ボタンが表示されること
   - ボタンをタップすると「回答済み」状態になること
   - タップ時間が記録されること
4. 管理パネルで「正解公開」ボタンを押下
5. **投影画面の確認**:
   - 正解者のみがランキングに表示されること
   - 回答時間順にソートされていること
   - 回答時間が「X.XX秒」形式で表示されること
6. 管理パネルで「ランキング表示」ボタンを押下
7. **投影画面の確認**:
   - 縦並びリストスタイルで表示されること
   - 1位は👑アイコンと黄色の背景
   - 回答時間が表示されること

### 3. エッジケースの確認
- **不正解者のみの場合**: ランキングが空になること
- **全員正解の場合**: 全員が回答時間順で表示されること
- **同時タップの場合**: latency_msが同じ場合、同率順位になること

## データベーススキーマ

### answersテーブル
```sql
CREATE TABLE answers (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL,
  quiz_id UUID NOT NULL,
  player_id UUID NOT NULL,
  choice_index INTEGER NOT NULL,  -- 0-3（ユーザーが選択した選択肢）
  latency_ms INTEGER,              -- タップまでの時間（ミリ秒）
  answered_at TIMESTAMP NOT NULL
);
```

### quizzes（ハードコード）
```typescript
// apps/web/lib/server/room-engine.ts Line 18-78
const WEDDING_QUIZZES = [
  // ...
  {
    id: '00000000-0000-0000-0000-000000000006',
    ord: 6,
    question: '今日（11月23日）は何の日？',
    choices: [
      '勤労感謝の日',
      'いい夫婦の日',
      '文化の日',
      '体育の日'
    ],
    answerIndex: 0,  // 正解は0番目の「勤労感謝の日」
    imageUrl: null,
    representativeByTable: true
  }
];
```

## 注意事項

### 1. latency_msの計算
- **クライアント側で計算**: `Date.now() - activeQuiz.startTs`
- **activeQuiz.startTs**: クイズが表示された時刻（ミリ秒）
- サーバー側では受け取った値をそのまま保存

### 2. 回答済み状態の管理
- `hasAnswered`のstateで管理
- 通常クイズと早押しクイズで共通のstateを使用可能
- 回答済みの場合、ボタンを非表示にして「回答済み」メッセージを表示

### 3. 正解判定
- バックエンドの`revealQuiz()`で実施
- `choice_index === quiz.answerIndex`で判定
- 正解者のみが`quiz_result.awarded`に追加される

### 4. ランキング表示
- 既存の縦並びリストスタイルを使用
- `isBuzzerQuiz`の判定で早押しクイズかどうかを識別
- `latencyMs`でソート済み

## 既知の問題と解決策

### 問題1: タップ時間の精度
- **問題**: ネットワーク遅延が含まれる
- **解決策**: クライアント側で計算することで、ネットワーク遅延の影響を最小化

### 問題2: 複数回答の防止
- **問題**: ユーザーが複数回タップする可能性
- **解決策**: `hasAnswered`フラグで制御、ボタンを無効化

### 問題3: 不正解者の扱い
- **問題**: 不正解でもlatency_msは記録される
- **解決策**: `revealQuiz()`で正解者のみを`awarded`に追加、投影画面では`awarded`のみを表示

## 参考情報

### 関連コミット
- `db2005e`: fix: include quizPoints and countupTapCount in realtime leaderboard sync
- `51c45d8`: feat: improve quiz ranking display and add user reset function

### 類似の実装
- 通常クイズの回答処理: `apps/web/components/join-room.tsx` Line 600-650付近
- クイズ結果表示: `apps/web/components/projector-view.tsx` Line 500-650付近

## 完了条件

- [ ] スマホ画面で4択ボタンが表示される
- [ ] 各ボタンタップで回答が送信される
- [ ] タップ時間が正しく記録される
- [ ] 回答済み状態が表示される
- [ ] 正解公開後、正解者のみがランキングに表示される
- [ ] ランキングが回答時間順でソートされている
- [ ] 投影画面で回答時間が「X.XX秒」形式で表示される
- [ ] ビルドエラーがない
- [ ] 不正解者はランキングに表示されない

## 次のセッションでの作業開始方法

```bash
# リポジトリの最新状態を取得
cd /Volumes/SSD02/Private/結婚パーティー/ContentsDEV
git pull

# このタスク指示書を確認
cat TASK_BUZZER_QUIZ_UI_CHANGE.md

# 作業ブランチを作成（オプション）
git checkout -b feature/buzzer-quiz-ui-change

# 開発サーバーを起動して動作確認
npm run dev
```

開始時にClaude Codeに以下のように指示してください:

```
TASK_BUZZER_QUIZ_UI_CHANGE.mdの内容に従って、早押しクイズのUIを変更してください。
現在の「回答ボタン」方式から「4択ボタンをタップする」方式に変更し、
タップ時間を計測して正解者のみをランキング表示する実装をお願いします。
```
