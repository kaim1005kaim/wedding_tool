'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import {
  Gauge,
  Play,
  Square,
  ListChecks,
  Eye,
  Shuffle,
  PauseCircle,
  Settings,
  Copy,
  QrCode,
  Check,
  Trash2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useRealtimeClient } from '../lib/realtime-context';
import { useRoomStore } from '../lib/store/room-store';
import { appConfig } from '../lib/env';
import { Section, PrimaryButton } from './brand';
import type { LucideIcon } from 'lucide-react';
import { WEDDING_QUIZZES } from '../lib/hardcoded-quizzes';

type LotteryCandidateSummary = {
  id: string;
  display_name: string;
  group_tag: string | null;
  created_at: string;
};

export default function AdminRoom({ roomId }: { roomId: string }) {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<Array<{ id: number; action: string; created_at: string; payload?: Record<string, unknown> }>>([]);
  const [lotteries, setLotteries] = useState<Array<{ kind: string; created_at: string; players?: { display_name: string; table_no?: string | null; seat_no?: string | null } }>>([]);
  const [adminToken, setAdminTokenState] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState<'quiz' | 'lottery' | 'representatives'>('quiz');
  const [manageMessage, setManageMessage] = useState<string | null>(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [representatives, setRepresentatives] = useState<Array<{ tableNo: string; name: string }>>([]);
  const [representativeForm, setRepresentativeForm] = useState({ tableNo: '', name: '' });
  const [modeSwitching, setModeSwitching] = useState(false);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [lotteryCandidates, setLotteryCandidates] = useState<LotteryCandidateSummary[]>([]);
  const [candidateForm, setCandidateForm] = useState({
    displayName: '',
    groupTag: 'all' as 'all' | 'groom' | 'bride'
  });
  const [quizSettings, setQuizSettings] = useState({
    representativeByTable: true,
    quizDurationSeconds: 30,
    enableTimeLimit: true
  });
  const [tapSettings, setTapSettings] = useState({
    countdownSeconds: 3,
    durationSeconds: 10
  });
  const [quizAnswerStats, setQuizAnswerStats] = useState<{ answered: number; total: number } | null>(null);
  const autoStopRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (autoStopRef.current) {
        clearTimeout(autoStopRef.current);
      }
    };
  }, []);
  const client = useRealtimeClient();
  const mode = useRoomStore((state) => state.mode);
  const phase = useRoomStore((state) => state.phase);
  const countdownMs = useRoomStore((state) => state.countdownMs);
  const activeQuiz = useRoomStore((state) => state.activeQuiz);
  const quizResult = useRoomStore((state) => state.quizResult);
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

  useEffect(() => {
    if (!activeQuiz || !isCloudMode || !adminToken) {
      setQuizAnswerStats(null);
      return;
    }

    const loadAnswerStats = async () => {
      try {
        const response = await fetch(
          `/api/admin/rooms/${roomId}/quiz/answer-stats?quizId=${activeQuiz.quizId}`,
          {
            headers: {
              Authorization: `Bearer ${adminToken}`
            }
          }
        );
        if (response.ok) {
          const data = (await response.json()) as { answered: number; total: number };
          setQuizAnswerStats(data);
        }
      } catch (err) {
        console.error('Failed to load answer stats:', err);
      }
    };

    void loadAnswerStats();
    const interval = setInterval(() => {
      void loadAnswerStats();
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [activeQuiz, isCloudMode, adminToken, roomId]);

  useEffect(() => {
    const loadRoomCode = async () => {
      try {
        const response = await fetch(`/api/rooms/info?roomId=${roomId}`);
        if (response.ok) {
          const data = await response.json() as { code: string };
          setRoomCode(data.code);
        }
      } catch (err) {
        console.error('Failed to load room code:', err);
      }
    };
    void loadRoomCode();
  }, [roomId]);

  const handleCopyUrl = async () => {
    if (!roomCode) return;
    const url = `${window.location.origin}/join/${roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

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
    const isModeSwitch = event.type === 'mode:switch';
    try {
      if (isModeSwitch) setModeSwitching(true);

      if (isCloudMode) {
        if (!adminToken) {
          throw new Error('管理トークンがありません。再ログインしてください');
        }
        const url = resolveAdminEndpoint(roomId, event);
        const payload = overrideBody ?? buildPayload(event.type, event.payload ?? {});
        console.log('[Admin] Sending request:', { url, type: event.type, payload, eventPayload: event.payload });
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
          const errorText = await response.text();
          console.error('[Admin] Request failed:', { status: response.status, errorText });
          let errorMessage = response.statusText;
          try {
            const data = JSON.parse(errorText) as { error?: string };
            errorMessage = data.error ?? errorMessage;
          } catch {
            // errorText is not JSON, use as is
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        await loadLogs();
      } else {
        await client.emit(event);
      }
    } catch (err) {
      console.error('[Admin] Send error:', err);
      setError(err instanceof Error ? err.message : '操作に失敗しました');
    } finally {
      if (isModeSwitch) {
        setTimeout(() => setModeSwitching(false), 500);
      }
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
      case 'mode:switch':
        // mode:switch requires 'to' field
        if (!payload.to) {
          throw new Error('モード切替にはtoパラメータが必要です');
        }
        return payload;
      case 'quiz:next':
        return {
          representativeByTable: quizSettings.representativeByTable,
          ...payload
        };
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


  const fetchLotteryCandidates = useCallback(async () => {
    if (!isCloudMode || !adminToken) return;
    try {
      const response = await fetch(`/api/admin/rooms/${roomId}/manage/lottery`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });
      if (response.ok) {
        const json = (await response.json()) as { candidates: LotteryCandidateSummary[] };
        setLotteryCandidates(json.candidates ?? []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [adminToken, isCloudMode, roomId]);

  const fetchRepresentatives = useCallback(async () => {
    if (!isCloudMode || !adminToken) return;
    try {
      const response = await fetch(`/api/admin/rooms/${roomId}/representatives`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });
      if (response.ok) {
        const json = (await response.json()) as { representatives: Array<{ table_no: string; representative_name: string }> };
        setRepresentatives((json.representatives ?? []).map(r => ({ tableNo: r.table_no, name: r.representative_name })));
      }
    } catch (err) {
      console.error(err);
    }
  }, [adminToken, isCloudMode, roomId]);

  useEffect(() => {
    if (!manageOpen || !isCloudMode) return;
    if (manageTab === 'lottery') {
      void fetchLotteryCandidates();
    } else if (manageTab === 'representatives') {
      void fetchRepresentatives();
    }
  }, [manageOpen, manageTab, isCloudMode, fetchLotteryCandidates, fetchRepresentatives]);

  const openManagement = () => {
    if (isCloudMode && !adminToken) {
      setError('管理トークンがありません。再ログインしてください');
      return;
    }
    setManageMessage(null);
    setManageTab('quiz');
    setManageOpen(true);
    if (isCloudMode) {
      void fetchLotteryCandidates();
    } else {
      setLotteryCandidates([]);
    }
  };


  const handleAddRepresentative = () => {
    if (!representativeForm.tableNo.trim() || !representativeForm.name.trim()) {
      setManageMessage('テーブル番号と名前を入力してください');
      return;
    }
    if (representatives.some(r => r.tableNo === representativeForm.tableNo.trim())) {
      setManageMessage('このテーブル番号は既に登録されています');
      return;
    }
    setRepresentatives([...representatives, { tableNo: representativeForm.tableNo.trim(), name: representativeForm.name.trim() }]);
    setRepresentativeForm({ tableNo: '', name: '' });
    setManageMessage(null);
  };

  const handleRemoveRepresentative = (tableNo: string) => {
    setRepresentatives(representatives.filter(r => r.tableNo !== tableNo));
  };

  const handleSaveRepresentatives = async () => {
    if (!isCloudMode || !adminToken) return;

    setManageLoading(true);
    setManageMessage(null);
    try {
      const response = await fetch(`/api/admin/rooms/${roomId}/representatives`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ representatives })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? response.statusText);
      }

      setManageMessage('代表者を保存しました');
    } catch (err) {
      setManageMessage(err instanceof Error ? err.message : '代表者の保存に失敗しました');
    } finally {
      setManageLoading(false);
    }
  };


  const handleAddCandidate = async () => {
    if (!isCloudMode || !adminToken) return;
    if (!candidateForm.displayName.trim()) {
      setManageMessage('名前を入力してください');
      return;
    }

    setManageLoading(true);
    setManageMessage(null);
    try {
      const response = await fetch(`/api/admin/rooms/${roomId}/manage/lottery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          displayName: candidateForm.displayName.trim(),
          groupTag: candidateForm.groupTag
        })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? response.statusText);
      }

      const json = (await response.json()) as { candidate: LotteryCandidateSummary };
      setLotteryCandidates((prev) => [json.candidate, ...prev]);
      setCandidateForm({ displayName: '', groupTag: candidateForm.groupTag });
      setManageMessage('抽選リストに追加しました');
    } catch (err) {
      setManageMessage(err instanceof Error ? err.message : '抽選リストの追加に失敗しました');
    } finally {
      setManageLoading(false);
    }
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
      onConfirm: async () => {
        void send({ type: 'quiz:reveal', payload: undefined }, { quizId: activeQuiz.quizId });
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
    <main className="min-h-screen p-6 relative overflow-hidden bg-gradient-mobile">
      <div className="mx-auto max-w-[1800px] w-full px-4 relative z-10">
        <Section title="管理パネル" subtitle={`Room ${roomId}`}>
          {/* 上部: ステータスと参加URL/QRコードを横並び */}
          <div className="mb-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* 現在のステータス */}
            <div className="rounded-2xl glass-panel-strong p-6 shadow-lg border-2 border-accent-400">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-ink/70 mb-2">現在のモード</p>
                  <p className="text-3xl font-bold text-terra-clay">{modeIcon(mode)} {labelForMode(mode)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-ink/70 mb-2">フェーズ</p>
                  <p className={`text-2xl font-bold ${phaseColor(phase)}`}>{phaseLabel(phase)}</p>
                  {countdownMs > 0 && phase === 'running' && (
                    <p className="mt-2 text-xl font-bold text-terra-clay">残り {Math.max(0, Math.ceil(countdownMs / 1000))} 秒</p>
                  )}
                </div>
              </div>
              {activeQuiz && (
                <div className="pt-4 border-t border-white/30">
                  <p className="text-sm font-bold text-ink/70">表示中のクイズ</p>
                  <p className="mt-1 text-base font-bold text-ink">{activeQuiz.ord ? `第${activeQuiz.ord}問: ` : ''}{activeQuiz.question}</p>
                </div>
              )}
            </div>

            {/* 参加用URL・QRコード */}
            {roomCode && (
              <div className="rounded-2xl glass-panel-strong p-6 shadow-lg border border-white/30">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500 shadow-md">
                        <QrCode className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-ink">参加用URL</h3>
                        <p className="text-xs text-ink/70">参加者はこのURLから参加できます</p>
                      </div>
                    </div>
                    <div className="rounded-xl glass-panel p-3 border border-slate-200">
                      <p className="mb-1 text-xs font-semibold text-ink/70 uppercase">Room Code</p>
                      <p className="mb-2 text-xl font-bold text-ink">{roomCode}</p>
                      <p className="mb-2 text-xs text-ink/80 break-all">{`${typeof window !== 'undefined' ? window.location.origin : ''}/join/${roomCode}`}</p>
                      <button
                        onClick={handleCopyUrl}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-600 hover:shadow-lg active:scale-[0.98]"
                      >
                        {copied ? (
                          <>
                            <Check className="h-4 w-4" />
                            コピーしました
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            URLをコピー
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <div className="rounded-xl bg-white p-3 shadow-md border border-slate-200">
                      <QRCodeSVG
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/join/${roomCode}`}
                        size={140}
                        level="M"
                        includeMargin
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex-1 rounded-xl bg-blue-50 px-5 py-3 border border-blue-200">
              <p className="text-sm font-medium text-blue-700">
                💡 投影画面を別タブで開き、全画面表示（Fキー）してプロジェクターに投影してください
              </p>
            </div>
            <AdminButton
              variant="secondary"
              icon={Eye}
              onClick={() => window.open(`/projector/${roomId}`, '_blank')}
              className="shrink-0"
              aria-label="投影画面を開く"
            >
              投影画面
            </AdminButton>
            <AdminButton
              variant="secondary"
              icon={Settings}
              onClick={openManagement}
              className="shrink-0"
              aria-label="詳細設定"
            >
              設定
            </AdminButton>
          </div>

          {error && (
            <div className="mb-6 rounded-xl bg-red-50 px-5 py-4 border border-red-200">
              <p className="text-sm font-semibold text-error" role="alert">
                ⚠️ {error}
              </p>
            </div>
          )}

          {/* 1段目: モード切替（全幅） */}
          <AdminCard title="モード切替" description="ゲームの進行モードを選択します" icon={Gauge}>
            <div className="flex gap-3">
              <AdminButton
                variant={mode === 'idle' ? 'primary' : 'secondary'}
                icon={PauseCircle}
                onClick={() => send({ type: 'mode:switch', payload: { to: 'idle' } })}
                disabled={modeSwitching}
                className="flex-1"
              >
                {modeSwitching && mode !== 'idle' ? '切替中...' : '待機モード'}
              </AdminButton>
              <AdminButton
                variant={mode === 'quiz' ? 'primary' : 'secondary'}
                icon={Eye}
                onClick={() => send({ type: 'mode:switch', payload: { to: 'quiz' } })}
                disabled={modeSwitching}
                className="flex-1"
              >
                {modeSwitching && mode !== 'quiz' ? '切替中...' : 'クイズ'}
              </AdminButton>
              <AdminButton
                variant={mode === 'countup' ? 'primary' : 'secondary'}
                icon={Shuffle}
                onClick={() => send({ type: 'mode:switch', payload: { to: 'countup' } })}
                disabled={modeSwitching}
                className="flex-1"
              >
                {modeSwitching && mode !== 'countup' ? '切替中...' : 'タップチャレンジ'}
              </AdminButton>
              {/* 抽選モード非表示
              <AdminButton
                variant={mode === 'lottery' ? 'primary' : 'secondary'}
                icon={Dice3}
                onClick={() => send({ type: 'mode:switch', payload: { to: 'lottery' } })}
                disabled={modeSwitching}
                className="flex-1"
              >
                {modeSwitching && mode !== 'lottery' ? '切替中...' : '抽選'}
              </AdminButton>
              */}
            </div>
          </AdminCard>

          {/* 2段目: クイズ操作とタップチャレンジ（2カラム） */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AdminCard title="クイズ操作" description="出題と正解の公開" icon={Eye}>
            {mode !== 'quiz' && (
              <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                <p className="text-sm font-bold text-yellow-800">⚠️ クイズモードに切り替えてください</p>
              </div>
            )}
            <div className="mb-4 space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-3 border border-blue-200">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={quizSettings.representativeByTable}
                    onChange={(e) => setQuizSettings({ ...quizSettings, representativeByTable: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-400"
                    disabled={mode !== 'quiz'}
                  />
                  <span className="font-medium">代表者制（各テーブル1回答まで）</span>
                </label>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-blue-50 p-3 border border-blue-200">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 flex-1">
                  <input
                    type="checkbox"
                    checked={quizSettings.enableTimeLimit}
                    onChange={(e) => setQuizSettings({ ...quizSettings, enableTimeLimit: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-400"
                    disabled={mode !== 'quiz'}
                  />
                  <span className="font-medium">制限時間</span>
                </label>
                {quizSettings.enableTimeLimit && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="10"
                      max="120"
                      value={quizSettings.quizDurationSeconds}
                      onChange={(e) => setQuizSettings({ ...quizSettings, quizDurationSeconds: parseInt(e.target.value) || 30 })}
                      className="w-16 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm text-center"
                      disabled={mode !== 'quiz'}
                    />
                    <span className="text-sm text-slate-700">秒</span>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3">
              {/* 通常クイズ（第1-5問）統合ボタン */}
              <AdminButton
                icon={activeQuiz && !quizResult ? Eye : ListChecks}
                variant={activeQuiz && !quizResult ? 'danger' : 'primary'}
                disabled={mode !== 'quiz' || (activeQuiz !== null && activeQuiz.ord === 6)}
                onClick={async () => {
                  console.log('[Admin Quiz Button] Click:', {
                    activeQuiz: activeQuiz ? { ord: activeQuiz.ord, quizId: activeQuiz.quizId } : null,
                    quizResult: quizResult ? { quizId: quizResult.quizId } : null
                  });

                  // 正解公開フェーズ（activeQuizあり、quizResultなし）
                  if (activeQuiz && !quizResult) {
                    console.log('[Admin] → Revealing answer');
                    await handleReveal();
                    return;
                  }

                  // 第5問の正解公開後 → ランキング表示
                  // Check quiz ID to handle case where activeQuiz.ord might be stale
                  const isQuiz5 = quizResult?.quizId === '00000000-0000-0000-0000-000000000005' || activeQuiz?.ord === 5;
                  console.log('[Admin] isQuiz5 check:', { isQuiz5, quizResultId: quizResult?.quizId, activeQuizOrd: activeQuiz?.ord });

                  if (quizResult && isQuiz5) {
                    console.log('[Admin] → Showing ranking');
                    if (!isCloudMode || !adminToken) return;
                    try {
                      const response = await fetch(`/api/admin/rooms/${roomId}/game/show-ranking`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${adminToken}`
                        }
                      });
                      if (!response.ok) {
                        throw new Error('Failed to show ranking');
                      }
                    } catch (err) {
                      console.error('[Admin] Failed to show ranking:', err);
                    }
                    return;
                  }

                  // 次のクイズへ or クイズ開始
                  console.log('[Admin] → Next quiz or start');
                  const deadlineMs = quizSettings.enableTimeLimit ? quizSettings.quizDurationSeconds * 1000 : undefined;
                  void send({ type: 'quiz:next', payload: undefined }, {
                    deadlineMs,
                    representativeByTable: quizSettings.representativeByTable
                  });
                }}
                className="w-full"
              >
                {(() => {
                  if (activeQuiz && !quizResult) return '正解を公開';
                  const isQuiz5 = quizResult?.quizId === '00000000-0000-0000-0000-000000000005' || activeQuiz?.ord === 5;
                  if (quizResult && isQuiz5) return 'ランキング表示へ';
                  if (quizResult) return '次のクイズへ';
                  return 'クイズ開始';
                })()}
              </AdminButton>

              {/* 早押しクイズ（第6問）統合ボタン */}
              <AdminButton
                variant={activeQuiz?.ord === 6 ? 'primary' : 'primary'}
                icon={activeQuiz?.ord === 6 ? Eye : Gauge}
                disabled={mode !== 'quiz' || (activeQuiz !== null && activeQuiz.ord !== 6)}
                onClick={async () => {
                  // 早押しクイズ開始後 → ランキング表示（正解公開 + ランキング表示を同時に実行）
                  if (activeQuiz?.ord === 6) {
                    // まず正解を公開
                    await handleReveal();

                    // その後、ランキング表示（短い待機時間を入れて確実にquizResultが反映されるのを待つ）
                    await new Promise(resolve => setTimeout(resolve, 500));

                    if (!isCloudMode || !adminToken) return;
                    try {
                      const response = await fetch(`/api/admin/rooms/${roomId}/game/show-ranking`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${adminToken}`
                        }
                      });
                      if (!response.ok) {
                        throw new Error('Failed to show ranking');
                      }
                    } catch (err) {
                      console.error('[Admin] Failed to show ranking:', err);
                    }
                    return;
                  }

                  // 早押しクイズ開始（制限時間10秒固定）
                  const deadlineMs = 10_000; // 10秒
                  void send({ type: 'quiz:next', payload: undefined }, {
                    deadlineMs,
                    representativeByTable: quizSettings.representativeByTable,
                    buzzerMode: true
                  });
                }}
                className="w-full"
              >
                {(() => {
                  if (activeQuiz?.ord === 6) return 'ランキングを表示';
                  return '早押しクイズ開始';
                })()}
              </AdminButton>

              <div className="flex flex-col gap-3">
                <AdminButton
                  variant="primary"
                  icon={Eye}
                  disabled={mode !== 'quiz'}
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/admin/rooms/${roomId}/game/show-celebration`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${adminToken}`
                        }
                      });
                      if (!response.ok) throw new Error('Failed to toggle celebration');
                    } catch (err) {
                      window.alert('表彰中画面の切り替えに失敗しました');
                    }
                  }}
                  className="w-full"
                >
                  表彰中画面表示
                </AdminButton>
                <AdminButton
                  variant="secondary"
                  icon={Trash2}
                  disabled={mode !== 'quiz'}
                  className="w-full"
                  onClick={() => {
                    openConfirm({
                      title: 'クイズ進行をリセット',
                      description: '全ての回答履歴と進行状態がリセットされ、1問目から再開できます。よろしいですか？',
                      variant: 'danger',
                      onConfirm: async () => {
                        if (!isCloudMode) return;
                        if (!adminToken) {
                          setError('管理トークンがありません');
                          return;
                        }
                        try {
                          const response = await fetch(`/api/admin/rooms/${roomId}/quiz/reset`, {
                            method: 'POST',
                            headers: {
                              Authorization: `Bearer ${adminToken}`
                            }
                          });
                          if (!response.ok) {
                            const data = (await response.json().catch(() => ({}))) as { error?: string };
                            throw new Error(data.error ?? response.statusText);
                          }
                          await loadLogs();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'リセットに失敗しました');
                        }
                      }
                    });
                  }}
                >
                  クイズリセット
                </AdminButton>
              </div>
            </div>
            {activeQuiz ? (
              <div className="mt-4 space-y-2">
                <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                  <p className="text-sm font-bold text-green-800">✓ 表示中: {activeQuiz.question}</p>
                </div>
                {quizAnswerStats && (
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                    <p className="text-sm font-bold text-blue-800">
                      回答状況: {quizAnswerStats.answered} / {quizAnswerStats.total}人
                      {quizAnswerStats.total > 0 && (
                        <span className="ml-2 text-xs">
                          ({Math.round((quizAnswerStats.answered / quizAnswerStats.total) * 100)}%)
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3">
                <p className="text-sm font-bold text-gray-600">クイズ待機中 - 「クイズ表示」ボタンで表示します</p>
              </div>
            )}
            {quizSettings.representativeByTable && (
              <p className="mt-2 text-sm text-blue-600">各テーブル1名のみ回答が有効です</p>
            )}
          </AdminCard>

          {/* 抽選機能非表示
          <AdminCard title="抽選" description="候補リストからランダムに選出します" icon={Dice1}>
            <div className="grid grid-cols-2 gap-3">
              <AdminButton variant="secondary" icon={Dice1} onClick={() => handleLottery('all')} className="col-span-2">
                全員対象
              </AdminButton>
              <AdminButton variant="secondary" icon={Dice2} onClick={() => handleLottery('groom')}>
                新郎
              </AdminButton>
              <AdminButton variant="secondary" icon={Dice3} onClick={() => handleLottery('bride')}>
                新婦
              </AdminButton>
            </div>
          </AdminCard>
          */}

          <AdminCard title="タップチャレンジ" description={`${tapSettings.countdownSeconds}秒カウント後に${tapSettings.durationSeconds}秒で自動終了します`} icon={Play}>
            {mode !== 'countup' && (
              <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                <p className="text-sm font-bold text-yellow-800">⚠️ タップチャレンジモードに切り替えてください</p>
              </div>
            )}
            <div className="mb-4 space-y-3">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-ink w-32">カウントダウン</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={tapSettings.countdownSeconds}
                  onChange={(e) => setTapSettings((prev) => ({ ...prev, countdownSeconds: parseInt(e.target.value) || 3 }))}
                  className="w-20 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-center"
                  disabled={mode !== 'countup'}
                />
                <span className="text-sm text-ink">秒</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-ink w-32">タップ時間</label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  value={tapSettings.durationSeconds}
                  onChange={(e) => setTapSettings((prev) => ({ ...prev, durationSeconds: parseInt(e.target.value) || 10 }))}
                  className="w-20 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-center"
                  disabled={mode !== 'countup'}
                />
                <span className="text-sm text-ink">秒</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <AdminButton
                  icon={Play}
                  disabled={mode !== 'countup' || phase === 'running'}
                  onClick={async () => {
                    if (autoStopRef.current) {
                      clearTimeout(autoStopRef.current);
                    }
                    const countdownMs = tapSettings.countdownSeconds * 1000;
                    const durationMs = tapSettings.durationSeconds * 1000;
                    await send({ type: 'game:start', payload: undefined }, { countdownMs });
                    autoStopRef.current = setTimeout(() => {
                      void send({ type: 'game:stop', payload: undefined });
                      autoStopRef.current = null;
                    }, countdownMs + durationMs + 500);
                  }}
                >
                  スタート
                </AdminButton>
                <AdminButton
                  variant="secondary"
                  icon={Square}
                  disabled={phase !== 'running'}
                  onClick={() => {
                    if (autoStopRef.current) {
                      clearTimeout(autoStopRef.current);
                      autoStopRef.current = null;
                    }
                    void send({ type: 'game:stop', payload: undefined });
                  }}
                >
                  緊急停止
                </AdminButton>
              </div>
              <AdminButton
                variant="secondary"
                icon={ListChecks}
                disabled={mode !== 'countup' || rankingLoading}
                onClick={async () => {
                  if (rankingLoading) return;

                  console.log('[Admin] Ranking button clicked', { roomId, mode, phase, adminToken: !!adminToken });
                  setRankingLoading(true);
                  try {
                    const response = await fetch(`/api/admin/rooms/${roomId}/game/show-ranking`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${adminToken}`
                      }
                    });
                    console.log('[Admin] Ranking response', { status: response.status, ok: response.ok });
                    if (!response.ok) {
                      const errorText = await response.text();
                      console.error('[Admin] Ranking error', errorText);
                      throw new Error('Failed to toggle ranking');
                    }
                    const data = await response.json();
                    console.log('[Admin] Ranking success', data);
                  } catch (err) {
                    console.error('[Admin] Ranking exception', err);
                    window.alert('ランキング表示の切り替えに失敗しました');
                  } finally {
                    setRankingLoading(false);
                  }
                }}
                className="w-full"
              >
                {rankingLoading ? '処理中...' : 'ランキング表示'}
              </AdminButton>
              <AdminButton
                variant="primary"
                icon={Eye}
                disabled={mode !== 'countup'}
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/admin/rooms/${roomId}/game/show-celebration`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${adminToken}`
                      }
                    });
                    if (!response.ok) throw new Error('Failed to toggle celebration');
                  } catch (err) {
                    window.alert('表彰中画面の切り替えに失敗しました');
                  }
                }}
                className="w-full"
              >
                表彰中画面表示
              </AdminButton>
              <AdminButton
                variant="danger"
                disabled={mode !== 'countup' || phase === 'running'}
                onClick={async () => {
                  if (!window.confirm('タップチャレンジのスコアをリセットしますか？')) return;
                  try {
                    const response = await fetch(`/api/admin/rooms/${roomId}/reset-tap-scores`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${adminToken}`
                      }
                    });
                    if (!response.ok) throw new Error('Failed to reset scores');
                    window.alert('スコアをリセットしました');
                  } catch (err) {
                    window.alert('スコアのリセットに失敗しました');
                  }
                }}
                className="w-full"
              >
                スコアリセット
              </AdminButton>
            </div>
          </AdminCard>
          </div>

          {/* ユーザーリセット */}
          {isCloudMode && (
            <div className="mt-6">
              <AdminCard title="ユーザー管理" description="参加者データの管理" icon={ListChecks}>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    過去の検証データやテストユーザーを削除し、本番環境をクリーンな状態で開始できます。
                  </p>
                  <AdminButton
                    onClick={() => {
                      openConfirm({
                        title: '全ユーザーをリセット',
                        description: '全ての参加者データ（プレイヤー、スコア、回答履歴）が削除されます。この操作は取り消せません。本当によろしいですか？',
                        variant: 'danger',
                        onConfirm: async () => {
                          if (!isCloudMode) return;
                          if (!adminToken) {
                            setError('管理トークンがありません');
                            return;
                          }
                          try {
                            const response = await fetch(`/api/admin/rooms/${roomId}/reset-users`, {
                              method: 'POST',
                              headers: {
                                Authorization: `Bearer ${adminToken}`
                              }
                            });
                            if (!response.ok) {
                              const data = (await response.json().catch(() => ({}))) as { error?: string };
                              throw new Error(data.error ?? response.statusText);
                            }
                            await loadLogs();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'ユーザーリセットに失敗しました');
                          }
                        }
                      });
                    }}
                    className="w-full"
                    variant="danger"
                  >
                    全ユーザーをリセット
                  </AdminButton>
                </div>
              </AdminCard>
            </div>
          )}

          {/* 3段目: ログ（全幅） */}
          {isCloudMode && (
            <div className="mt-6">
            <AdminCard title="操作ログ" description="進行状況の確認" icon={ListChecks}>
              {/* 抽選履歴タブを非表示
              <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1">
                <TabButton label="操作ログ" active={activeLogTab === 'logs'} onClick={() => setActiveLogTab('logs')} />
                <TabButton label="抽選履歴" active={activeLogTab === 'lottery'} onClick={() => setActiveLogTab('lottery')} />
              </div>
              {activeLogTab === 'logs' ? <LogsList logs={logs} /> : <LotteryList entries={lotteries} />}
              */}
              <LogsList logs={logs} />
            </AdminCard>
            </div>
          )}

        {manageOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 px-6">
            <div className="glass-panel max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-6 shadow-brand">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-brand-terra-600">詳細設定</h2>
                <button
                  type="button"
                  className="text-sm text-brand-blue-700 underline decoration-dashed"
                  onClick={() => {
                    setManageOpen(false);
                    setManageMessage(null);
                  }}
                >
                  閉じる
                </button>
              </div>
              <div className="mt-4 inline-flex rounded-full bg-brand-blue-50 p-1 text-sm">
                <button
                  className={`rounded-full px-4 py-2 font-semibold transition-colors ${
                    manageTab === 'quiz' ? 'bg-white text-brand-blue-700 shadow-sm' : 'text-brand-blue-600 hover:text-brand-blue-700'
                  }`}
                  onClick={() => setManageTab('quiz')}
                >
                  クイズ一覧
                </button>
                <button
                  className={`rounded-full px-4 py-2 font-semibold transition-colors ${
                    manageTab === 'representatives' ? 'bg-white text-brand-blue-700 shadow-sm' : 'text-brand-blue-600 hover:text-brand-blue-700'
                  }`}
                  onClick={() => setManageTab('representatives')}
                >
                  代表者設定
                </button>
              </div>
              {!isCloudMode && (
                <p className="mt-4 text-sm text-brand-blue-700/70">LANモードでは設定を閲覧のみ利用できます。クラウドモードで編集してください。</p>
              )}
              {manageMessage && <p className="mt-4 text-sm text-brand-terra-600">{manageMessage}</p>}
              {manageTab === 'quiz' ? (
                <div className="mt-6 space-y-4">
                  <div className="rounded-xl bg-blue-50 p-4 border border-blue-200">
                    <p className="text-sm text-blue-800 font-medium">📝 クイズ情報</p>
                    <p className="text-xs text-blue-700 mt-2">
                      結婚式で使用するクイズは固定されています。以下の順番で出題されます。
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-brand-blue-700">クイズ一覧</h3>
                    <ul className="space-y-2">
                      {WEDDING_QUIZZES.map((quiz) => (
                        <li key={quiz.id} className="rounded-xl bg-white/85 px-4 py-3 shadow-sm border border-brand-blue-200">
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue-100 text-sm font-bold text-brand-blue-700">
                              {quiz.ord}
                            </span>
                            <div className="flex-1">
                              <p className="font-semibold text-brand-blue-700 text-sm">{quiz.question}</p>
                              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                {quiz.choices.map((choice, idx) => (
                                  <div
                                    key={idx}
                                    className={`px-2 py-1 rounded ${
                                      idx === quiz.answerIndex
                                        ? 'bg-green-100 text-green-800 font-semibold'
                                        : 'bg-gray-50 text-gray-700'
                                    }`}
                                  >
                                    {String.fromCharCode(65 + idx)}. {choice}
                                  </div>
                                ))}
                              </div>
                              {quiz.imageUrl && (
                                <p className="text-xs text-brand-blue-600 mt-2">🖼️ 画像: {quiz.imageUrl}</p>
                              )}
                              {quiz.isBuzzer && (
                                <p className="text-xs text-terra-clay font-semibold mt-1">⚡ 早押しクイズ</p>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : manageTab === 'lottery' ? (
                <div className="mt-6 space-y-6">
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleAddCandidate();
                    }}
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-brand-blue-700">お名前</label>
                      <input
                        className="w-full rounded-xl border border-brand-blue-200 bg-white px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
                        value={candidateForm.displayName}
                        onChange={(event) => setCandidateForm((prev) => ({ ...prev, displayName: event.target.value }))}
                        placeholder="例：山田 太郎"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-brand-blue-700">カテゴリ</label>
                      <select
                        className="w-full rounded-xl border border-brand-blue-200 bg-white px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
                        value={candidateForm.groupTag}
                        onChange={(event) =>
                          setCandidateForm((prev) => ({
                            ...prev,
                            groupTag: event.target.value as 'all' | 'groom' | 'bride'
                          }))
                        }
                      >
                        <option value="all">全員対象</option>
                        <option value="groom">新郎</option>
                        <option value="bride">新婦</option>
                      </select>
                    </div>
                    <PrimaryButton type="submit" disabled={manageLoading || !isCloudMode}>
                      抽選リストに追加
                    </PrimaryButton>
                  </form>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-brand-blue-700">登録済み候補</h3>
                    {lotteryCandidates.length === 0 ? (
                      <p className="text-sm text-brand-blue-700/70">登録された候補はまだありません。</p>
                    ) : (
                      <ul className="space-y-2">
                        {lotteryCandidates.map((candidate) => (
                          <li key={candidate.id} className="rounded-xl bg-white/85 px-4 py-3 text-sm shadow-brand">
                            <p className="font-semibold text-brand-terra-600">{candidate.display_name}</p>
                            <p className="text-xs text-brand-blue-700/60">
                              {lotteryKindLabel(candidate.group_tag ?? 'all')} / 登録日: {new Date(candidate.created_at).toLocaleString('ja-JP')}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : manageTab === 'representatives' ? (
                <div className="mt-6 space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-brand-blue-700">テーブル番号</label>
                        <input
                          className="w-full rounded-xl border border-brand-blue-200 bg-white px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
                          value={representativeForm.tableNo}
                          onChange={(event) => setRepresentativeForm((prev) => ({ ...prev, tableNo: event.target.value }))}
                          placeholder="例：A"
                          disabled={!isCloudMode}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-brand-blue-700">代表者名</label>
                        <input
                          className="w-full rounded-xl border border-brand-blue-200 bg-white px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
                          value={representativeForm.name}
                          onChange={(event) => setRepresentativeForm((prev) => ({ ...prev, name: event.target.value }))}
                          placeholder="例：山田太郎"
                          disabled={!isCloudMode}
                        />
                      </div>
                    </div>
                    <PrimaryButton type="button" onClick={handleAddRepresentative} disabled={manageLoading || !isCloudMode}>
                      追加
                    </PrimaryButton>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-brand-blue-700">登録済み代表者</h3>
                    {representatives.length === 0 ? (
                      <p className="text-sm text-brand-blue-700/70">登録された代表者はまだありません。</p>
                    ) : (
                      <ul className="space-y-2">
                        {representatives.map((rep) => (
                          <li key={rep.tableNo} className="rounded-xl bg-white/85 px-4 py-3 text-sm shadow-brand flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-brand-terra-600">{rep.tableNo}: {rep.name}さん</p>
                            </div>
                            <button
                              onClick={() => handleRemoveRepresentative(rep.tableNo)}
                              className="rounded-lg bg-red-100 p-2 text-red-700 hover:bg-red-200 disabled:opacity-50"
                              disabled={manageLoading || !isCloudMode}
                              title="削除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <PrimaryButton type="button" onClick={handleSaveRepresentatives} disabled={manageLoading || !isCloudMode}>
                    保存して投影画面に表示
                  </PrimaryButton>

                  <div className="rounded-xl bg-blue-50 p-4 border border-blue-200">
                    <p className="text-sm text-blue-800 font-medium">💡 代表者設定について</p>
                    <p className="text-xs text-blue-700 mt-2">
                      保存すると、投影画面に「各テーブルの回答代表者」として表示されます。代表者制度をONにしている場合、ここで設定した代表者のみがクイズに回答できます。
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
        </Section>
      </div>

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

type AdminCardProps = {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: React.ReactNode;
};

function AdminCard({ title, description, icon: Icon, children }: AdminCardProps) {
  return (
    <div className="rounded-2xl glass-panel-strong p-6 shadow-lg border border-white/30">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500 shadow-md">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-ink">{title}</h3>
          {description && <p className="mt-1 text-sm text-ink/70">{description}</p>}
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

function AdminButton({ variant = 'primary', icon: Icon, className = '', children, type = 'button', ...props }: AdminButtonProps) {
  const base = 'flex min-h-[3.5rem] items-center justify-center gap-2.5 rounded-xl px-6 py-3 text-base font-semibold transition-all duration-200 whitespace-nowrap focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClass =
    variant === 'primary'
      ? 'bg-blue-500 text-white shadow-lg hover:bg-blue-600 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-blue-400'
      : variant === 'danger'
        ? 'bg-red-500 text-white shadow-lg hover:bg-red-600 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-red-400'
        : 'bg-white text-slate-700 shadow-md hover:shadow-lg hover:glass-panel hover:text-blue-600 border-2 border-slate-200 hover:border-blue-300 focus-visible:outline-blue-400';

  return (
    <button type={type} className={`${base} ${variantClass} ${className}`} {...props}>
      {Icon && <Icon className="h-5 w-5 shrink-0" />}
      {children}
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

function lotteryKindLabel(kind: string) {
  switch (kind) {
    case 'all':
      return '全員対象';
    case 'groom':
      return (
        <span className="flex items-center gap-2">
          新郎
          <span className="inline-block w-4 h-4 bg-cyan-400 rounded"></span>
        </span>
      );
    case 'bride':
      return (
        <span className="flex items-center gap-2">
          新婦
          <span className="inline-block w-4 h-4 bg-orange-400 rounded"></span>
        </span>
      );
    case 'groom_friends':
      return (
        <span className="flex items-center gap-2">
          新郎
          <span className="inline-block w-4 h-4 bg-cyan-400 rounded"></span>
        </span>
      );
    case 'bride_friends':
      return (
        <span className="flex items-center gap-2">
          新婦
          <span className="inline-block w-4 h-4 bg-orange-400 rounded"></span>
        </span>
      );
    case 'escort':
      return 'エスコート';
    case 'cake_groom':
      return 'ケーキ（新郎）';
    case 'cake_bride':
      return 'ケーキ（新婦）';
    default:
      return kind;
  }
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

function modeIcon(mode: string) {
  switch (mode) {
    case 'countup':
      return '⚡';
    case 'quiz':
      return '🎯';
    case 'lottery':
      return '🎰';
    default:
      return '⏸️';
  }
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

function phaseColor(phase: 'idle' | 'running' | 'ended' | 'celebrating') {
  switch (phase) {
    case 'running':
      return 'text-green-600';
    case 'ended':
      return 'text-blue-600';
    case 'celebrating':
      return 'text-yellow-600';
    default:
      return 'text-ink/70';
  }
}

function phaseLabel(phase: 'idle' | 'running' | 'ended' | 'celebrating') {
  switch (phase) {
    case 'running':
      return '進行中';
    case 'ended':
      return '終了';
    case 'celebrating':
      return '表彰中';
    default:
      return '待機';
  }
}
