import type { ReactNode } from 'react';
import clsx from 'clsx';

export type LeaderboardEntry = {
  rank: number;
  name: string;
  furigana?: string;
  totalPoints: number;
  delta?: number;
  meta?: ReactNode;
};

export type LeaderboardProps = {
  entries: LeaderboardEntry[];
  highlightPlayerId?: string;
};

export function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <div
          key={entry.rank + entry.name}
          className={clsx(
            'flex items-center justify-between rounded border border-white/10 bg-white/5 px-4 py-3 shadow-sm backdrop-blur',
            entry.rank <= 3 && 'border-brand/60'
          )}
        >
          <div className="flex items-center gap-4">
            <span className="text-3xl font-black text-brand">{entry.rank}</span>
            <div className="flex flex-col">
              {entry.furigana && (
                <span className="text-sm text-ink/60 font-medium">{entry.furigana}</span>
              )}
              <span className="text-xl font-semibold">{entry.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-6 text-right">
            {typeof entry.delta === 'number' && (
              <span className={clsx('text-sm', entry.delta >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {entry.delta >= 0 ? '+' : ''}
                {entry.delta}
              </span>
            )}
            <span className="text-2xl font-bold">{entry.totalPoints}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
