'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import {
  Gauge,
  Play,
  Square,
  ListChecks,
  Eye,
  Dice1,
  Dice2,
  Dice3,
  Shuffle,
  PauseCircle
} from 'lucide-react';
import { useRealtimeClient } from '../lib/realtime-context';
import { useRoomStore } from '../lib/store/room-store';
import { appConfig } from '../lib/env';
import { Section, PrimaryButton } from './brand';
import type { LucideIcon } from 'lucide-react';

export default function AdminRoom({ roomId }: { roomId: string }) {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<Array<{ id: number; action: string; created_at: string; payload?: Record<string, unknown> }>>([]);
  const [lotteries, setLotteries] = useState<Array<{ kind: string; created_at: string; players?: { display_name: string; table_no?: string | null; seat_no?: string | null } }>>([]);
  const [adminToken, setAdminTokenState] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [activeLogTab, setActiveLogTab] = useState<'logs' | 'lottery'>('logs');
  const client = useRealtimeClient();
  const mode = useRoomStore((state) => state.mode);
  const phase = useRoomStore((state) => state.phase);
  const countdownMs = useRoomStore((state) => state.countdownMs);
  const activeQuiz = useRoomStore((state) => state.activeQuiz);
  const isCloudMode = appConfig.mode === 'cloud';
  const storageKey = useMemo(() => `wedding_tool:${roomId}:admin`, [roomId]);

  useEffect(() => {
    if (!isCloudMode || typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        const { token, expiresAt } = JSON.parse(stored) as { token: string; expiresAt: number };
        if (expiresAt > Date.now()) {
          setAdminToken(token);
          setIsAuthenticated(true);
        } else {
          window.localStorage.removeItem(storageKey);
        }
      } catch (err) {
        window.localStorage.removeItem(storageKey);
      }
    }
  }, [isCloudMode, storageKey]);

  const setAdminToken = (token: string | null) => {
    setAdminTokenState(token);
  };

  useEffect(() => {
    setError(null);
  }, [isAuthenticated]);

  const loadLogs = useCallback(async () => {
    if (!isAuthenticated || !isCloudMode || !adminToken) return;
    try {
      const response = await fetch(`/api/admin/rooms/${roomId}/logs`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });
      if (response.ok) {
        const { logs: auditLogs, lotteries: lotteryLogs } = (await response.json()) as {
          logs: typeof logs;
          lotteries: typeof lotteries;
        };
        setLogs(auditLogs);
        setLotteries(lotteryLogs);
      }
    } catch (err) {
      console.error(err);
    }
  }, [adminToken, isAuthenticated, isCloudMode, roomId]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleUnlock = async () => {
    if (pin.trim().length === 0) {
      setError('PINを入力してください');
      return;
    }

    if (!isCloudMode) {
      setIsAuthenticated(true);
      return;
    }

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roomId, pin })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? response.statusText);
      }

      const { token, expiresAt } = (await response.json()) as { token: string; expiresAt: number };
      setAdminToken(token);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify({ token, expiresAt }));
      }
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PINの検証に失敗しました');
      setIsAuthenticated(false);
    }
  };

  const send = async (event: Parameters<typeof client.emit>[0], overrideBody?: Record<string, unknown>) => {
    try {
      if (isCloudMode) {
        if (!adminToken) {
          throw new Error('管理トークンがありません。再ログインしてください');
        }
        const url = resolveAdminEndpoint(roomId, event);
        const payload = overrideBody ?? buildPayload(event.type, event.payload ?? {});
        const hasBody = Object.keys(payload).length > 0;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${adminToken}`
          },
          ...(hasBody ? { body: JSON.stringify(payload) } : {})
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? response.statusText);
        }
        await loadLogs();
      } else {
        await client.emit(event);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作に失敗しました');
    }
  };

  const resolveAdminEndpoint = (roomId: string, event: Parameters<typeof client.emit>[0]) => {
    switch (event.type) {
      case 'mode:switch':
        return `/api/admin/rooms/${roomId}/mode`;
      case 'game:start':
        return `/api/admin/rooms/${roomId}/game/start`;
      case 'game:stop':
        return `/api/admin/rooms/${roomId}/game/stop`;
      case 'quiz:next':
        return `/api/admin/rooms/${roomId}/quiz/next`;
      case 'quiz:reveal':
        return `/api/admin/rooms/${roomId}/quiz/reveal`;
      case 'lottery:draw':
        return `/api/admin/rooms/${roomId}/lottery/draw`;
      default:
        throw new Error(`Unsupported admin event: ${event.type}`);
    }
  };

  const buildPayload = (type: Parameters<typeof client.emit>[0]['type'], payload: Record<string, unknown>) => {
    switch (type) {
      case 'quiz:next':
        return {};
      case 'quiz:reveal': {
        if (Object.keys(payload).length > 0) {
          return payload;
        }
        if (!activeQuiz) {
          throw new Error('表示中のクイズがありません');
        }
        return { quizId: activeQuiz.quizId };
      }
      default:
        return payload;
    }
  };

  const openConfirm = (state: ConfirmState) => {
    setConfirm(state);
  };

  const handleReveal = () => {
    if (!activeQuiz) {
      setError('表示中のクイズがありません');
      return;
    }
    openConfirm({
      title: '正解を公開しますか？',
      description: '一度公開すると取り消せません。',
      confirmLabel: '公開する',
      variant: 'danger',
      onConfirm: () => {
        void send({ type: 'quiz:reveal', payload: undefined }, { quizId: activeQuiz.quizId });
      }
    });
  };

  const handleLottery = (kind: 'escort' | 'cake_groom' | 'cake_bride') => {
    openConfirm({
      title: '抽選を実行しますか？',
      description: '抽選はやり直しできません。',
      confirmLabel: '抽選する',
      variant: 'danger',
      onConfirm: () => {
        void send({ type: 'lottery:draw', payload: { kind } });
      }
    });
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-ecru px-6 py-12">
        <Section title="管理パネル" subtitle="進行用のPINを入力してください">
          <form
            className="mx-auto flex max-w-md flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleUnlock();
            }}
          >
            <label className="text-sm font-medium text-brand-blue-700" htmlFor="admin-pin">
              PIN
            </label>
            <input
              id="admin-pin"
              type="password"
              className="rounded-xl border border-brand-blue-200 bg-white px-4 py-3 text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              placeholder="1234"
              autoComplete="off"
            />
            {error && <p className="text-sm text-error" role="alert">{error}</p>}
            <PrimaryButton type="submit">ログイン</PrimaryButton>
          </form>
        </Section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ecru px-6 py-10">
      <Section title="管理パネル" subtitle={`Room ${roomId}`}>
        <div className="mb-6 grid gap-4 rounded-2xl bg-white/85 p-6 shadow-brand sm:grid-cols-3">
          <StatusItem label="モード" value={labelForMode(mode)} icon={Gauge} />
          <StatusItem label="フェーズ" value={phaseLabel(phase)} icon={PauseCircle} />
          <StatusItem label="カウントダウン" value={`${Math.max(0, Math.ceil(countdownMs / 1000))} 秒`} icon={ListChecks} />
        </div>

        {error && <p className="mb-4 text-sm text-error" role="alert">{error}</p>}

        <div className="grid gap-6 lg:grid-cols-2">
          <AdminCard title="モード切替" description="ゲームの進行モードを選択します" icon={Gauge}>
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminButton variant={mode === 'idle' ? 'primary' : 'secondary'} icon={PauseCircle} onClick={() => send({ type: 'mode:switch', payload: { to: 'idle' } })}>
                待機モード
              </AdminButton>
              <AdminButton variant={mode === 'countup' ? 'primary' : 'secondary'} icon={Shuffle} onClick={() => send({ type: 'mode:switch', payload: { to: 'countup' } })}>
                タップチャレンジ
              </AdminButton>
              <AdminButton variant={mode === 'quiz' ? 'primary' : 'secondary'} icon={Eye} onClick={() => send({ type: 'mode:switch', payload: { to: 'quiz' } })}>
                クイズ
              </AdminButton>
              <AdminButton variant={mode === 'lottery' ? 'primary' : 'secondary'} icon={Dice3} onClick={() => send({ type: 'mode:switch', payload: { to: 'lottery' } })}>
                抽選
              </AdminButton>
            </div>
          </AdminCard>

          <AdminCard title="ゲーム制御" description="計測の開始と終了" icon={Play}>
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminButton icon={Play} onClick={() => send({ type: 'game:start', payload: undefined })}>
                開始
              </AdminButton>
              <AdminButton variant="secondary" icon={Square} onClick={() => send({ type: 'game:stop', payload: undefined })}>
                終了
              </AdminButton>
            </div>
          </AdminCard>

          <AdminCard title="クイズ操作" description="出題と正解の公開" icon={Eye}>
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminButton icon={ListChecks} onClick={() => send({ type: 'quiz:next', payload: undefined })}>
                次のクイズ
              </AdminButton>
              <AdminButton variant="danger" icon={Eye} onClick={handleReveal}>
                正解を公開
              </AdminButton>
            </div>
            {activeQuiz && (
              <p className="mt-3 text-xs text-brand-blue-700/80">表示中: {activeQuiz.question}</p>
            )}
          </AdminCard>

          <AdminCard title="抽選" description="各演出の抽選を実行" icon={Dice1}>
            <div className="grid gap-3 sm:grid-cols-3">
              <AdminButton variant="secondary" icon={Dice1} onClick={() => handleLottery('escort')}>
                エスコート
              </AdminButton>
              <AdminButton variant="secondary" icon={Dice2} onClick={() => handleLottery('cake_groom')}>
                ケーキ（新郎）
              </AdminButton>
              <AdminButton variant="secondary" icon={Dice3} onClick={() => handleLottery('cake_bride')}>
                ケーキ（新婦）
              </AdminButton>
            </div>
          </AdminCard>
        </div>

        {isCloudMode && (
          <AdminCard title="ログ / 抽選履歴" description="進行状況の確認" icon={ListChecks}>
            <div className="mb-4 inline-flex rounded-full bg-brand-blue-50 p-1 text-sm">
              <TabButton label="操作ログ" active={activeLogTab === 'logs'} onClick={() => setActiveLogTab('logs')} />
              <TabButton label="抽選履歴" active={activeLogTab === 'lottery'} onClick={() => setActiveLogTab('lottery')} />
            </div>
            {activeLogTab === 'logs' ? <LogsList logs={logs} /> : <LotteryList entries={lotteries} />}
          </AdminCard>
        )}
      </Section>

      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
    </main>
  );
}

type ConfirmState = {
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: 'primary' | 'danger';
  onConfirm: () => void;
};

function StatusItem({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-brand-blue-50/70 px-4 py-3 text-sm text-brand-blue-700">
      <Icon className="h-5 w-5 text-brand-blue-700" />
      <div>
        <p className="text-xs uppercase tracking-wide text-brand-blue-700/70">{label}</p>
        <p className="text-base font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}

type AdminCardProps = {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: React.ReactNode;
};

function AdminCard({ title, description, icon: Icon, children }: AdminCardProps) {
  return (
    <div className="glass-panel rounded-2xl p-6 shadow-brand">
      <div className="mb-4 flex items-center gap-3">
        <Icon className="h-6 w-6 text-brand-terra-600" />
        <div>
          <h3 className="text-lg font-semibold text-brand-blue-700">{title}</h3>
          {description && <p className="text-xs text-brand-blue-700/70">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

type AdminButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: LucideIcon;
};

function AdminButton({ variant = 'primary', icon: Icon, className = '', children, ...props }: AdminButtonProps) {
  const base = 'flex h-12 items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60';
  const variantClass =
    variant === 'primary'
      ? 'bg-brand-terra-600 text-white hover:bg-brand-terra-700 focus-visible:outline-brand-terra-400'
      : variant === 'danger'
        ? 'bg-error text-white hover:bg-error/90 focus-visible:outline-error/80'
        : 'bg-brand-blue-200 text-brand-blue-700 hover:bg-brand-blue-200/80 focus-visible:outline-brand-blue-400';

  return (
    <button className={`${base} ${variantClass} ${className}`} {...props}>
      {Icon && <Icon className="h-5 w-5" />}
      {children}
    </button>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`rounded-full px-4 py-2 font-semibold transition ${active ? 'bg-white shadow-brand text-brand-blue-700' : 'text-brand-blue-700/60 hover:text-brand-blue-700'}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function LogsList({ logs }: { logs: Array<{ id: number; action: string; created_at: string; payload?: Record<string, unknown> }> }) {
  if (logs.length === 0) {
    return <p className="text-sm text-brand-blue-700/80">ログはまだありません。</p>;
  }
  return (
    <ul className="space-y-3 text-sm text-brand-blue-700">
      {logs.map((log) => (
        <li key={log.id} className="rounded-xl bg-brand-blue-50 p-4 shadow-brand">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-brand-terra-600">{log.action}</span>
            <span className="text-xs text-brand-blue-700/60">{new Date(log.created_at).toLocaleString()}</span>
          </div>
          {log.payload && (
            <pre className="mt-2 overflow-x-auto rounded bg-white/80 p-2 text-xs text-brand-blue-700/80">
              {JSON.stringify(log.payload, null, 2)}
            </pre>
          )}
        </li>
      ))}
    </ul>
  );
}

function LotteryList({
  entries
}: {
  entries: Array<{ kind: string; created_at: string; players?: { display_name: string; table_no?: string | null; seat_no?: string | null } }>;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-brand-blue-700/80">抽選はまだ行われていません。</p>;
  }
  return (
    <ul className="space-y-3 text-sm text-brand-blue-700">
      {entries.map((entry, index) => (
        <li key={`${entry.kind}-${index}`} className="rounded-xl bg-brand-terra-50 p-4 shadow-brand">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-brand-terra-600">{entry.kind}</span>
            <span className="text-xs text-brand-blue-700/60">{new Date(entry.created_at).toLocaleString()}</span>
          </div>
          <p className="mt-2 text-lg font-semibold text-ink">{entry.players?.display_name ?? '未登録'}</p>
        </li>
      ))}
    </ul>
  );
}

function ConfirmDialog({ state, onClose }: { state: ConfirmState | null; onClose: () => void }) {
  if (!state) return null;
  const { title, description, confirmLabel = '実行する', variant = 'primary', onConfirm } = state;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-6">
      <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-brand">
        <h2 className="text-xl font-semibold text-brand-terra-600">{title}</h2>
        {description && <p className="mt-2 text-sm text-brand-blue-700/80">{description}</p>}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="h-11 flex-1 rounded-xl border border-brand-blue-200 bg-white text-brand-blue-700 shadow-brand"
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={`h-11 flex-1 rounded-xl font-semibold text-white shadow-brand ${variant === 'danger' ? 'bg-error hover:bg-error/90' : 'bg-brand-terra-600 hover:bg-brand-terra-700'}`}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function labelForMode(mode: string) {
  switch (mode) {
    case 'countup':
      return 'タップチャレンジ';
    case 'quiz':
      return 'クイズ';
    case 'lottery':
      return '抽選';
    default:
      return '待機';
  }
}

function phaseLabel(phase: 'idle' | 'running' | 'ended') {
  switch (phase) {
    case 'running':
      return '進行中';
    case 'ended':
      return '終了';
    default:
      return '待機';
  }
}
