'use client';

import { useRoomStore } from '../lib/store/room-store';
import type { LeaderboardEntry } from '../lib/store/room-store';

export default function AwardsView({ roomId: _roomId }: { roomId: string }) {
  const leaderboard = useRoomStore((state) => state.leaderboard);

  // Sort by total points
  const sortedLeaderboard = [...leaderboard]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const top10 = sortedLeaderboard.slice(0, 10);

  // Quiz ranking
  const quizRanking = [...leaderboard]
    .filter(entry => entry.quizPoints && entry.quizPoints > 0)
    .sort((a, b) => b.quizPoints - a.quizPoints)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
    .slice(0, 10);

  // Tap ranking
  const tapRanking = [...leaderboard]
    .filter(entry => entry.countupTapCount && entry.countupTapCount > 0)
    .sort((a, b) => b.countupTapCount - a.countupTapCount)
    .map((entry, index) => ({ ...entry, rank: index + 1 }))
    .slice(0, 10);

  return (
    <main className="min-h-screen bg-gradient-mobile p-8 print:bg-white">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4 print:space-y-2">
          <h1 className="text-5xl font-black text-ink print:text-4xl">
            🏆 表彰式 🏆
          </h1>
          <p className="text-xl text-ink/70 font-bold print:text-base">
            ゲーム大会の結果発表
          </p>
        </div>

        {/* Overall Ranking */}
        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-3xl font-black text-ink glass-panel-strong px-8 py-4 rounded-2xl inline-block shadow-lg border border-white/30 print:bg-gray-100 print:text-2xl">
              総合ランキング TOP10
            </h2>
          </div>

          <div className="space-y-3">
            {top10.map((entry) => (
              <RankingRow
                key={entry.playerId}
                rank={entry.rank}
                displayName={entry.displayName}
                furigana={entry.furigana}
                tableNo={entry.tableNo}
                points={entry.totalPoints}
                label="pt"
                details={`クイズ${entry.quizPoints}問 / タップ${entry.countupTapCount}回`}
              />
            ))}
          </div>
        </section>

        {/* Quiz Ranking */}
        {quizRanking.length > 0 && (
          <section className="space-y-6 print:page-break-before-always">
            <div className="text-center">
              <h2 className="text-3xl font-black text-ink glass-panel-strong px-8 py-4 rounded-2xl inline-block shadow-lg border border-white/30 print:bg-gray-100 print:text-2xl">
                クイズランキング TOP10
              </h2>
            </div>

            <div className="space-y-3">
              {quizRanking.map((entry) => (
                <RankingRow
                  key={entry.playerId}
                  rank={entry.rank}
                  displayName={entry.displayName}
                  furigana={entry.furigana}
                  tableNo={entry.tableNo}
                  points={entry.quizPoints}
                  label="問正解"
                />
              ))}
            </div>
          </section>
        )}

        {/* Tap Ranking */}
        {tapRanking.length > 0 && (
          <section className="space-y-6 print:page-break-before-always">
            <div className="text-center">
              <h2 className="text-3xl font-black text-ink glass-panel-strong px-8 py-4 rounded-2xl inline-block shadow-lg border border-white/30 print:bg-gray-100 print:text-2xl">
                タップチャレンジランキング TOP10
              </h2>
            </div>

            <div className="space-y-3">
              {tapRanking.map((entry) => (
                <RankingRow
                  key={entry.playerId}
                  rank={entry.rank}
                  displayName={entry.displayName}
                  furigana={entry.furigana}
                  tableNo={entry.tableNo}
                  points={entry.countupTapCount}
                  label="回"
                />
              ))}
            </div>
          </section>
        )}

        {/* Print Button */}
        <div className="text-center print:hidden">
          <button
            onClick={() => window.print()}
            className="btn-primary px-8 py-4 text-lg"
          >
            🖨️ 印刷する
          </button>
        </div>
      </div>
    </main>
  );
}

function RankingRow({
  rank,
  displayName,
  furigana,
  tableNo,
  points,
  label,
  details
}: {
  rank: number;
  displayName: string;
  furigana?: string;
  tableNo?: string | null;
  points: number;
  label: string;
  details?: string;
}) {
  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return null;
    }
  };

  const medal = getMedalEmoji(rank);
  const isTopThree = rank <= 3;

  return (
    <div
      className={`flex items-center justify-between rounded-xl px-6 py-4 shadow-lg border-2 transition-all ${
        isTopThree
          ? rank === 1
            ? 'glass-panel-strong border-yellow-400 ring-2 ring-yellow-300/50 bg-gradient-to-br from-yellow-50/40 to-orange-50/40'
            : rank === 2
              ? 'glass-panel-strong border-gray-400 ring-2 ring-gray-300/50 bg-gradient-to-br from-gray-50/30 to-slate-50/30'
              : 'glass-panel-strong border-amber-600 ring-2 ring-amber-400/50 bg-gradient-to-br from-amber-50/30 to-orange-50/30'
          : 'glass-panel-strong border-white/30'
      } print:bg-white print:border-gray-300`}
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          {medal && <span className="text-3xl print:text-2xl">{medal}</span>}
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-black text-white shadow-lg print:h-10 print:w-10 print:text-lg ${
              isTopThree ? 'bg-gradient-terracotta' : 'bg-gray-400'
            }`}
          >
            {rank}
          </span>
        </div>
        <div>
          {furigana && <p className="text-sm text-ink/60 font-medium print:text-xs">{furigana}</p>}
          <p className="text-2xl font-black text-ink print:text-xl">{displayName}</p>
          {tableNo && <p className="text-base text-ink/70 font-bold print:text-sm">テーブル {tableNo}</p>}
          {details && <p className="text-sm text-ink/60 font-medium print:text-xs">{details}</p>}
        </div>
      </div>
      <div className="text-right">
        <p className="text-3xl font-black text-terra-clay print:text-2xl">{points}</p>
        <p className="text-sm text-ink/80 font-bold print:text-xs">{label}</p>
      </div>
    </div>
  );
}
