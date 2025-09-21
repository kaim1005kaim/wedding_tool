import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ className, variant = 'primary', ...rest }: ButtonProps) {
  return (
    <button
      className={clsx(
        'rounded px-4 py-2 font-semibold transition-colors',
        variant === 'primary'
          ? 'bg-brand text-white hover:bg-brand-dark'
          : 'border border-slate-500 text-slate-100 hover:bg-slate-800',
        className
      )}
      {...rest}
    />
  );
}

export { Leaderboard } from './leaderboard';
export type { LeaderboardEntry, LeaderboardProps } from './leaderboard';
