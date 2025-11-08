# 早押しクイズUI変更タスク（詳細版）

## 🎯 変更の目的

**現在**: 早押しクイズ（問6）は大きな早押しボタン1つをタップする方式
**変更後**: 通常クイズ（問1-5）と同じ4択ボタンUIを使い、各選択肢のタップ時間を計測する

## 📋 要件の明確化

### ユーザーからの要望
1. **スマホ画面**: 通常クイズ（1-5問目）と同じUIを活用し、秒数を測る
2. **投影画面**: 通常クイズのランキングをアレンジし、秒数と正解/不正解がわかるようにする

### 実装方針
- ✅ **通常クイズのUI（4択ボタン）を再利用**
- ✅ **タップ時間の計測を追加**
- ✅ **正解/不正解の両方をランキングに表示**（従来は正解者のみ）
- ✅ **回答時間順にソート**（正解者優先、次に不正解者）

## 🔍 現在の実装の確認

### 通常クイズ（1-5問目）のUI実装
**ファイル**: `apps/web/components/join-room.tsx`
**行番号**: Line 1187-1250

**特徴**:
- 4つの選択肢ボタンが縦に並ぶ
- 選択肢は `A`, `B`, `C`, `D` のラベル付き
- 回答後は選択した選択肢がハイライト
- 正解公開後は正解/不正解が色で区別される

```typescript
/* 通常クイズモード: 選択肢ボタン */
<div className="w-full max-w-2xl flex flex-col gap-4">
  {activeQuiz.choices.map((choice, index) => {
    const isSelected = selectedChoice === index;
    const isCorrect = quizResult && index === correctIndex;
    const isWrong = quizResult && isSelected && index !== correctIndex;
    const count = quizResult?.perChoiceCounts?.[index] ?? 0;

    let buttonClass = 'glass-panel rounded-2xl p-5 shadow-lg transition-all duration-200';

    if (quizResult) {
      if (isCorrect) {
        buttonClass = 'rounded-2xl p-5 shadow-xl bg-gradient-to-br from-red-500 to-red-600 border-2 border-red-700';
      } else if (isWrong) {
        buttonClass = 'rounded-2xl p-5 shadow-xl bg-gradient-denim border-2 border-denim-deep';
      } else {
        buttonClass = 'glass-panel rounded-2xl p-5 border-2 border-gray-300';
      }
    } else if (isSelected) {
      buttonClass = 'rounded-2xl p-5 shadow-xl bg-gradient-denim border-2 border-denim-deep';
    }

    return (
      <motion.button
        key={index}
        onClick={(e) => handleChoiceSelect(index, e)}
        disabled={hasAnswered || isSubmitting || !!quizResult}
        className={buttonClass}
        whileTap={{ scale: hasAnswered ? 1 : 0.98 }}
      >
        {/* ボタン内容 */}
      </motion.button>
    );
  })}
</div>
```

### 早押しクイズ（6問目）の現在のUI
**ファイル**: `apps/web/components/join-room.tsx`
**行番号**: Line 1152-1185

**特徴**:
- 大きな円形の早押しボタン1つ
- タップすると選択肢0（正解）として記録される
- 回答時間は計測されている（latency_ms）

```typescript
{activeQuiz.ord === 6 && !quizResult ? (
  /* 早押しクイズモード: 大きな早押しボタン */
  <div className="w-full max-w-2xl flex flex-col items-center gap-6">
    <motion.button
      onClick={(e) => handleChoiceSelect(0, e)}  // 常に選択肢0として記録
      disabled={hasAnswered || isSubmitting}
      className={/* ... */}
    >
      {/* 早押しボタンの内容 */}
    </motion.button>
  </div>
) : (
  /* 通常クイズモード: 選択肢ボタン */
  {/* 上記のコード */}
)}
```

## 📝 実装タスク

### タスク1: スマホ画面のUI統一（最重要）

**ファイル**: `apps/web/components/join-room.tsx`
**変更箇所**: Line 1152-1185

#### 変更内容
早押しクイズでも通常クイズと**同じ4択ボタンUI**を使用する。

#### 修正方針
1. `activeQuiz.ord === 6 && !quizResult` の分岐を**削除**
2. 通常クイズの4択ボタンUIを**すべてのクイズで使用**
3. 早押しクイズの場合でも、タップ時間を計測する

#### 具体的な変更

**BEFORE（現在のコード）**:
```typescript
{activeQuiz.ord === 6 && !quizResult ? (
  /* 早押しクイズモード: 大きな早押しボタン */
  <div className="w-full max-w-2xl flex flex-col items-center gap-6">
    {/* 早押しボタン */}
  </div>
) : (
  /* 通常クイズモード: 選択肢ボタン */
  <div className="w-full max-w-2xl flex flex-col gap-4">
    {activeQuiz.choices.map((choice, index) => {
      {/* 4択ボタン */}
    })}
  </div>
)}
```

**AFTER（変更後のコード）**:
```typescript
{/* すべてのクイズで同じUI（4択ボタン）を使用 */}
<div className="w-full max-w-2xl flex flex-col gap-4">
  {activeQuiz.choices.map((choice, index) => {
    const isSelected = selectedChoice === index;
    const isCorrect = quizResult && index === correctIndex;
    const isWrong = quizResult && isSelected && index !== correctIndex;
    const count = quizResult?.perChoiceCounts?.[index] ?? 0;

    let buttonClass = 'glass-panel rounded-2xl p-5 shadow-lg transition-all duration-200';

    if (quizResult) {
      if (isCorrect) {
        buttonClass = 'rounded-2xl p-5 shadow-xl bg-gradient-to-br from-red-500 to-red-600 border-2 border-red-700';
      } else if (isWrong) {
        buttonClass = 'rounded-2xl p-5 shadow-xl bg-gradient-denim border-2 border-denim-deep';
      } else {
        buttonClass = 'glass-panel rounded-2xl p-5 border-2 border-gray-300';
      }
    } else if (isSelected) {
      buttonClass = 'rounded-2xl p-5 shadow-xl bg-gradient-denim border-2 border-denim-deep';
    }

    return (
      <motion.button
        key={index}
        onClick={(e) => handleChoiceSelect(index, e)}
        disabled={hasAnswered || isSubmitting || !!quizResult}
        className={buttonClass}
        whileTap={{ scale: hasAnswered ? 1 : 0.98 }}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-terracotta text-white text-xl font-black shadow-md">
              {CHOICE_LABELS[index]}
            </span>
            <span className={`text-xl font-bold flex-1 text-left ${quizResult ? 'text-white' : 'text-ink'}`}>
              {choice}
            </span>
          </div>
          {quizResult && (
            <div className="flex items-center gap-3 ml-4">
              {isCorrect && <span className="text-3xl">⭕</span>}
              {isWrong && <span className="text-3xl">❌</span>}
              <span className={`text-lg font-bold min-w-[3rem] text-right ${quizResult ? 'text-white' : 'text-ink'}`}>
                {count}人
              </span>
            </div>
          )}
        </div>
      </motion.button>
    );
  })}
</div>
```

#### 重要なポイント
- ✅ **早押しクイズでも4択すべてを表示**
- ✅ **どの選択肢をタップしても、タップ時間を記録**
- ✅ **`handleChoiceSelect(index, e)` は既に実装済みなので、そのまま使用**
- ✅ **UIコードは通常クイズと全く同じ**

### タスク2: タップ時間の計測確認

**ファイル**: `apps/web/components/join-room.tsx`
**確認箇所**: Line 330-370付近の `handleChoiceSelect` 関数

#### 現在の実装確認
`handleChoiceSelect`関数は既に以下を実装している:
1. タップ時の時間計測（`latency_ms`）
2. APIへの送信（choice_index, latency_ms）

```typescript
const handleChoiceSelect = async (choiceIndex: number, e?: React.MouseEvent) => {
  if (hasAnswered || isSubmitting || !activeQuiz) return;

  e?.preventDefault();
  e?.stopPropagation();

  const latencyMs = Date.now() - activeQuiz.startTs;  // ← 既に実装済み

  setSelectedChoice(choiceIndex);
  setIsSubmitting(true);

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
        latencyMs  // ← タップ時間を送信
      })
    });

    // ...
  } catch (error) {
    // ...
  }
};
```

#### 確認事項
- ✅ **変更不要**: `handleChoiceSelect`は既にタップ時間を計測している
- ✅ **通常クイズでも早押しクイズでも同じ関数を使用できる**

### タスク3: 投影画面のランキング表示変更（重要）

**ファイル**: `apps/web/components/projector-view.tsx`
**変更箇所**: Line 705-778付近

#### 現在の実装
```typescript
// 早押しクイズ（問6）のランキング
const buzzerRanking = isBuzzerQuiz && quizResult?.awarded
  ? quizResult.awarded
      .filter(a => a.latencyMs != null && a.latencyMs >= 0)  // 正解者のみ
      .sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity))
      .map((entry, index) => ({
        playerId: entry.playerId,
        displayName: entry.displayName ?? '???',
        tableNo: entry.tableNo ?? null,
        latencyMs: entry.latencyMs,
        rank: index + 1
      }))
  : [];
```

#### 変更内容
**正解者だけでなく、全回答者をランキング表示する**

1. **正解者を優先表示**（回答時間順）
2. **不正解者も表示**（回答時間順、正解者の後）
3. **各エントリに正解/不正解フラグを追加**

#### 修正後のコード

```typescript
// 早押しクイズ（問6）のランキング - 全回答者を表示
const buzzerRanking = useMemo(() => {
  if (!isBuzzerQuiz || !quizResult) return [];

  // 正解インデックス
  const correctIndex = quizResult.correctIndex;

  // 全回答者を取得（answersテーブルから）
  // quizResult.awardedには正解者のみが含まれているため、
  // 全回答者情報が必要な場合は別途取得が必要

  // まずは正解者のランキングを作成
  const correctAnswers = (quizResult.awarded || [])
    .filter(a => a.latencyMs != null && a.latencyMs >= 0)
    .sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity))
    .map((entry, index) => ({
      playerId: entry.playerId,
      displayName: entry.displayName ?? '???',
      tableNo: entry.tableNo ?? null,
      latencyMs: entry.latencyMs,
      rank: index + 1,
      isCorrect: true  // 正解フラグ
    }));

  // TODO: 不正解者の情報も取得する必要がある
  // 現在のデータ構造では quizResult.awarded に正解者のみが含まれるため、
  // 不正解者の情報は別途 answers テーブルから取得する必要がある

  return correctAnswers;
}, [isBuzzerQuiz, quizResult]);
```

#### 問題点と解決策

**問題**: `quizResult.awarded` には正解者しか含まれていない

**解決策A（推奨）**: バックエンドの `revealQuiz` を修正して、全回答者を含める

**ファイル**: `apps/web/lib/server/room-engine.ts`
**関数**: `revealQuiz()`（Line 374-520付近）

**現在の実装**:
```typescript
// 正解者のみを awarded に追加
for (const answer of answers) {
  if (answer.choice_index === quiz.answerIndex) {  // ← 正解者のみ
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
```

**修正後の実装**:
```typescript
// 早押しクイズ（ord=6）の場合は全回答者を awarded に含める
const isBuzzerQuiz = quiz.ord === 6;

for (const answer of answers) {
  const isCorrect = answer.choice_index === quiz.answerIndex;

  // 通常クイズは正解者のみ、早押しクイズは全回答者
  if (isCorrect || isBuzzerQuiz) {
    const player = players?.find(p => p.id === answer.player_id);
    awardedPlayers.push({
      playerId: answer.player_id,
      delta: isCorrect ? awardedPoints : 0,  // 不正解者はポイント0
      displayName: player?.display_name,
      tableNo: player?.table_no ?? null,
      latencyMs: answer.latency_ms,
      choiceIndex: answer.choice_index,  // 選択した選択肢を追加
      isCorrect: isCorrect  // 正解フラグを追加
    });
  }
}
```

**スキーマ変更が必要**:
`quizResultBroadcastSchema` にフィールドを追加

**ファイル**: `packages/schema/src/events.ts`
**変更箇所**: Line 52-63

```typescript
export const quizResultBroadcastSchema = z.object({
  quizId: z.string().uuid(),
  correctIndex: z.number().int().min(0).max(3),
  perChoiceCounts: z.array(z.number().int().min(0)).length(4),
  awarded: z.array(z.object({
    playerId: z.string().uuid(),
    delta: z.number().int(),
    displayName: z.string().optional(),
    tableNo: z.string().nullable().optional(),
    latencyMs: z.number().int().nullable().optional(),
    choiceIndex: z.number().int().min(0).max(3).optional(),  // ← 追加
    isCorrect: z.boolean().optional()  // ← 追加
  }))
});
```

#### 投影画面のランキング表示UI変更

**ファイル**: `apps/web/components/projector-view.tsx`
**変更箇所**: Line 900-960付近（ランキング表示部分）

**変更内容**:
- 各ランキングエントリに **正解/不正解の表示** を追加
- **回答時間** を表示
- 正解者と不正解者で **色や表示を区別**

```typescript
<div className="space-y-4 max-w-6xl mx-auto">
  {rankedLeaderboard.map((entry, index) => {
    const style = getRankStyle(entry.displayRank);
    const icon = getRankIcon(entry.displayRank);

    // 早押しクイズの場合は正解/不正解を判定
    const isBuzzer = isBuzzerQuiz;
    const isCorrectAnswer = isBuzzer && 'isCorrect' in entry ? entry.isCorrect : true;

    return (
      <motion.div
        key={`${entry.playerId}-${index}`}
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1, type: 'spring', bounce: 0.3 }}
        className={`glass-panel-strong rounded-2xl p-6 shadow-xl border-4 ${style.border} ${style.ring ? `ring-4 ${style.ring}` : ''} ${style.bg}`}
      >
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-6 flex-1 min-w-0">
            {/* 順位とアイコン */}
            <div className="flex flex-col items-center shrink-0">
              {icon && (
                <motion.div
                  animate={entry.displayRank === 1 ? { rotate: [0, -15, 15, -15, 0], scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  className="text-6xl mb-2"
                >
                  {icon}
                </motion.div>
              )}
              <span className={`text-5xl font-black ${style.textColor}`}>
                {entry.displayRank}位
              </span>
            </div>

            {/* 名前とテーブル */}
            <div className="flex-1 min-w-0">
              {entry.tableNo && (
                <p className="text-3xl font-black text-ink mb-1">
                  {entry.tableNo}チーム
                </p>
              )}
              <p className="text-4xl font-black text-terra-clay truncate">
                {entry.displayName}さん
              </p>
            </div>
          </div>

          {/* スコア表示 */}
          <div className="shrink-0 flex flex-col gap-2">
            {/* 早押しクイズの場合: 回答時間と正解/不正解 */}
            {isBuzzerQuiz && 'latencyMs' in entry && (
              <>
                <div className="rounded-full glass-panel px-8 py-4 shadow-lg border-2 border-white/40">
                  <span className="text-4xl font-black text-terra-clay whitespace-nowrap">
                    {((entry.latencyMs ?? 0) / 1000).toFixed(2)}秒
                  </span>
                </div>
                <div className="text-center">
                  <span className={`text-5xl ${isCorrectAnswer ? 'text-green-600' : 'text-red-600'}`}>
                    {isCorrectAnswer ? '⭕' : '❌'}
                  </span>
                </div>
              </>
            )}

            {/* 通常クイズの場合: 正解数 */}
            {!isBuzzerQuiz && (
              <div className="rounded-full glass-panel px-8 py-4 shadow-lg border-2 border-white/40">
                <span className="text-4xl font-black text-terra-clay whitespace-nowrap">
                  正解数{'correctCount' in entry ? entry.correctCount : 0}/5
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  })}
</div>
```

## 🔄 修正フロー全体像

### 1. スキーマ修正
**ファイル**: `packages/schema/src/events.ts`
- `quizResultBroadcastSchema` に `choiceIndex` と `isCorrect` を追加

### 2. バックエンド修正
**ファイル**: `apps/web/lib/server/room-engine.ts`
- `revealQuiz()` 関数を修正
- 早押しクイズ（ord=6）の場合、全回答者を `awarded` に含める
- 各回答者に `choiceIndex` と `isCorrect` を追加

### 3. フロントエンド（スマホ画面）修正
**ファイル**: `apps/web/components/join-room.tsx`
- 早押しクイズ専用の大きなボタンUIを**削除**
- すべてのクイズで通常の4択ボタンUIを使用

### 4. フロントエンド（投影画面）修正
**ファイル**: `apps/web/components/projector-view.tsx`
- `buzzerRanking` の計算ロジックを修正（全回答者を含める）
- ランキング表示UIに正解/不正解の表示を追加
- 正解者を優先し、次に不正解者を表示（それぞれ回答時間順）

## ✅ 完了条件チェックリスト

### スマホ画面
- [ ] 早押しクイズでも4択ボタンが表示される
- [ ] 各選択肢をタップすると回答が送信される
- [ ] タップ時間が正しく記録される（latency_ms）
- [ ] 選択した選択肢が記録される（choice_index）
- [ ] 回答後「回答済み」状態が表示される
- [ ] 正解公開後、正解/不正解のフィードバックが表示される

### 投影画面（ランキング）
- [ ] 正解者が回答時間順で表示される
- [ ] 不正解者も回答時間順で表示される（正解者の後）
- [ ] 各エントリに回答時間が「X.XX秒」形式で表示される
- [ ] 各エントリに⭕（正解）または❌（不正解）が表示される
- [ ] 縦並びリストスタイルで表示される
- [ ] 1-3位はトロフィーアイコンと色で区別される

### バックエンド
- [ ] `revealQuiz()` が早押しクイズの全回答者を返す
- [ ] 各回答者に `choiceIndex` が含まれる
- [ ] 各回答者に `isCorrect` フラグが含まれる
- [ ] 不正解者にはポイントが付与されない（delta=0）

### ビルドとテスト
- [ ] ビルドエラーがない
- [ ] TypeScriptの型エラーがない
- [ ] 通常クイズ（1-5問目）が正常に動作する
- [ ] 早押しクイズ（6問目）が正常に動作する

## 📁 変更ファイル一覧

### 必須変更
1. ✅ `packages/schema/src/events.ts` - スキーマ修正
2. ✅ `apps/web/lib/server/room-engine.ts` - revealQuiz()修正
3. ✅ `apps/web/components/join-room.tsx` - スマホUIの統一
4. ✅ `apps/web/components/projector-view.tsx` - ランキング表示修正

### 確認のみ（変更不要の可能性が高い）
- `apps/web/app/api/rooms/[roomId]/quiz/answer/route.ts` - 回答API
- `apps/web/lib/store/room-store.ts` - Zustandストア

## 🚀 次のセッションでの開始方法

```bash
# リポジトリの最新状態を取得
cd /Volumes/SSD02/Private/結婚パーティー/ContentsDEV
git pull

# このタスク指示書を確認
cat TASK_BUZZER_QUIZ_UI_CHANGE_v2.md

# 開発サーバーを起動
npm run dev
```

### Claude Codeへの指示例

```
TASK_BUZZER_QUIZ_UI_CHANGE_v2.mdを読んで、早押しクイズのUIを変更してください。

重要なポイント:
1. 早押しクイズでも通常クイズと同じ4択ボタンUIを使う（スマホ画面）
2. 全回答者をランキング表示する（正解者優先、次に不正解者）
3. 各回答者の回答時間と正解/不正解を表示する（投影画面）

段階的に実装してください:
- ステップ1: スキーマ修正
- ステップ2: バックエンド修正
- ステップ3: スマホ画面UI修正
- ステップ4: 投影画面ランキング修正
```

## 🎨 期待される表示イメージ

### スマホ画面（早押しクイズ）
```
┌─────────────────────────────┐
│  ⚡ 最終問題 - 早押しクイズ   │
├─────────────────────────────┤
│                             │
│  今日（11月23日）は何の日？   │
│                             │
├─────────────────────────────┤
│  [A] 勤労感謝の日            │
├─────────────────────────────┤
│  [B] いい夫婦の日            │
├─────────────────────────────┤
│  [C] 文化の日                │
├─────────────────────────────┤
│  [D] 体育の日                │
└─────────────────────────────┘
```

### 投影画面（早押しランキング）
```
┌─────────────────────────────────────────┐
│        早押しクイズランキング              │
├─────────────────────────────────────────┤
│  👑 1位  Aチーム 太郎さん    1.23秒 ⭕   │
│  🥈 2位  Bチーム 花子さん    1.45秒 ⭕   │
│  🥉 3位  Cチーム 次郎さん    1.67秒 ⭕   │
│     4位  Dチーム 美咲さん    2.01秒 ❌   │
│     5位  Eチーム 健太さん    2.34秒 ❌   │
└─────────────────────────────────────────┘
```

## ⚠️ 注意事項

### タップ時間の精度
- クライアント側で計算: `Date.now() - activeQuiz.startTs`
- ネットワーク遅延の影響を最小化

### 回答済み状態の管理
- `hasAnswered` stateで管理
- 回答後はボタンを無効化

### 正解者と不正解者のソート
```typescript
// 推奨ソートロジック
const allAnswers = [...correctAnswers, ...incorrectAnswers];

// または
allAnswers.sort((a, b) => {
  // 正解者を優先
  if (a.isCorrect && !b.isCorrect) return -1;
  if (!a.isCorrect && b.isCorrect) return 1;

  // 同じカテゴリ内では回答時間順
  return (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity);
});
```

## 🔗 関連情報

### 既存のクイズデータ
```typescript
// apps/web/lib/server/room-engine.ts Line 68-78
{
  id: '00000000-0000-0000-0000-000000000006',
  ord: 6,
  question: '今日（11月23日）は何の日？',
  choices: [
    '勤労感謝の日',      // ← 正解（answerIndex: 0）
    'いい夫婦の日',
    '文化の日',
    '体育の日'
  ],
  answerIndex: 0,
  imageUrl: null,
  representativeByTable: true
}
```

### データベーススキーマ
```sql
-- answersテーブル
CREATE TABLE answers (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL,
  quiz_id UUID NOT NULL,
  player_id UUID NOT NULL,
  choice_index INTEGER NOT NULL,  -- ユーザーが選択した選択肢（0-3）
  latency_ms INTEGER,              -- タップ時間（ミリ秒）
  answered_at TIMESTAMP NOT NULL
);
```
