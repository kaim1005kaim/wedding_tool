'use client';

import { useRoomStore } from '../lib/store/room-store';
import { Leaderboard } from '@wedding_tool/ui';

export default function ProjectorView({ roomId }: { roomId: string }) {
  const mode = useRoomStore((state) => state.mode);
  const countdownMs = useRoomStore((state) => state.countdownMs);
  const leaderboard = useRoomStore((state) => state.leaderboard);
  const activeQuiz = useRoomStore((state) => state.activeQuiz);
  const quizResult = useRoomStore((state) => state.quizResult);
  const lotteryResult = useRoomStore((state) => state.lotteryResult);

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-gradient-to-br from-slate-950 to-slate-900 p-10 text-white">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold uppercase tracking-widest">wedding_tool</h1>
          <p className="text-sm text-slate-300">Room ID: {roomId}</p>
        </div>
        <div className="rounded border border-slate-700 bg-black/30 px-4 py-3 text-right">
          <p className="text-xs uppercase text-slate-400">Mode</p>
          <p className="text-xl font-semibold tracking-wide">{mode.toUpperCase()}</p>
          <p className="text-xs uppercase text-slate-400">Countdown</p>
          <p className="text-xl font-semibold tracking-wide">{Math.ceil(countdownMs / 1000)}s</p>
        </div>
      </header>
      <section className="flex flex-1 flex-col gap-6">
        {mode === 'quiz' && activeQuiz && (
          <article className="rounded border border-white/10 bg-white/5 p-6 shadow-xl">
            <h2 className="text-3xl font-semibold">{activeQuiz.question}</h2>
            <ol className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              {activeQuiz.choices.map((choice, index) => (
                <li key={choice} className="rounded bg-black/40 p-4 text-lg">
                  <span className="mr-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-center text-sm font-bold">
                    {index + 1}
                  </span>
                  {choice}
                </li>
              ))}
            </ol>
          </article>
        )}
        {mode === 'quiz' && quizResult && (
          <article className="rounded border border-emerald-500/30 bg-emerald-500/10 p-6 shadow-xl">
            <h2 className="text-2xl font-semibold">正解: {quizResult.correctIndex + 1}</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              {quizResult.perChoiceCounts.map((count, index) => (
                <div key={index} className="rounded bg-black/30 p-4 text-center">
                  <p className="text-sm uppercase text-slate-300">選択 {index + 1}</p>
                  <p className="text-2xl font-bold">{count}</p>
                </div>
              ))}
            </div>
          </article>
        )}
        {mode === 'lottery' && lotteryResult && (
          <article className="rounded border border-yellow-400/40 bg-yellow-500/10 p-6 text-center text-3xl font-semibold">
            🎉 {lotteryResult.kind.toUpperCase()} Winner 🎉
            <p className="mt-3 text-4xl">{lotteryResult.player.name}</p>
            {lotteryResult.player.table_no && (
              <p className="text-xl text-slate-200">卓 {lotteryResult.player.table_no}</p>
            )}
            {lotteryResult.player.seat_no && (
              <p className="text-xl text-slate-200">席 {lotteryResult.player.seat_no}</p>
            )}
          </article>
        )}
        <section className="rounded border border-white/10 bg-white/5 p-6 shadow-xl">
          <h2 className="mb-4 text-2xl font-semibold">Leaderboard</h2>
          <Leaderboard
            entries={leaderboard.map((entry) => ({
              rank: entry.rank,
              name: entry.displayName,
              totalPoints: entry.totalPoints,
              delta: entry.delta
            }))}
          />
        </section>
      </section>
    </main>
  );
}
