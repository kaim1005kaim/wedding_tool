'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  PauseCircle,
  Settings,
  Copy,
  QrCode,
  Check,
  Edit,
  Trash2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useRealtimeClient } from '../lib/realtime-context';
import { useRoomStore } from '../lib/store/room-store';
import { appConfig } from '../lib/env';
import { Section, PrimaryButton } from './brand';
import type { LucideIcon } from 'lucide-react';

type QuizSummary = {
  id: string;
  question: string;
  ord: number | null;
  created_at: string;
  is_template?: boolean;
};

type LotteryCandidateSummary = {
  id: string;
  display_name: string;
  group_tag: string | null;
  created_at: string;
};

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

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
  const [activeLogTab, setActiveLogTab] = useState<'logs' | 'lottery'>('logs');
  const [manageOpen, setManageOpen] = useState(false);
  const [manageTab, setManageTab] = useState<'quiz' | 'lottery' | 'representatives'>('quiz');
  const [manageMessage, setManageMessage] = useState<string | null>(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [representatives, setRepresentatives] = useState<Array<{ tableNo: string; name: string }>>([]);
  const [representativeForm, setRepresentativeForm] = useState({ tableNo: '', name: '' });
  const [modeSwitching, setModeSwitching] = useState(false);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [templates, setTemplates] = useState<QuizSummary[]>([]);
  const [lotteryCandidates, setLotteryCandidates] = useState<LotteryCandidateSummary[]>([]);
  const [quizForm, setQuizForm] = useState({
    question: '',
    choices: ['', '', '', ''],
    answerIndex: 0,
    ord: '',
    imageUrl: '',
    isTemplate: false
  });
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const quizFormRef = useRef<HTMLFormElement>(null);
  const [candidateForm, setCandidateForm] = useState({
    displayName: '',
    groupTag: 'all' as 'all' | 'groom' | 'bride'
  });
  const [quizSettings, setQuizSettings] = useState({
    representativeByTable: true,
    quizDurationSeconds: 30,
    enableTimeLimit: true,
    buzzerMode: false
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

  const fetchQuizzes = useCallback(async () => {
    if (!isCloudMode || !adminToken) return;
    try {
      const response = await fetch(`/api/admin/rooms/${roomId}/manage/quizzes`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });
      if (response.ok) {
        const json = (await response.json()) as { quizzes: QuizSummary[]; templates: QuizSummary[] };
        setQuizzes(json.quizzes ?? []);
        setTemplates(json.templates ?? []);
      }
    } catch (err) {
      console.error(err);
    }
  }, [adminToken, isCloudMode, roomId]);

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
    if (manageTab === 'quiz') {
      void fetchQuizzes();
    } else if (manageTab === 'lottery') {
      void fetchLotteryCandidates();
    } else if (manageTab === 'representatives') {
      void fetchRepresentatives();
    }
  }, [manageOpen, manageTab, isCloudMode, fetchQuizzes, fetchLotteryCandidates, fetchRepresentatives]);

  const openManagement = () => {
    if (isCloudMode && !adminToken) {
      setError('管理トークンがありません。再ログインしてください');
      return;
    }
    setManageMessage(null);
    setManageTab('quiz');
    setManageOpen(true);
    if (isCloudMode) {
      void fetchQuizzes();
      void fetchLotteryCandidates();
    } else {
      setQuizzes([]);
      setTemplates([]);
      setLotteryCandidates([]);
    }
  };

  const handleCreateQuiz = async () => {
    if (!isCloudMode || !adminToken) return;
    if (!quizForm.question.trim() || quizForm.choices.some((choice) => !choice.trim())) {
      setManageMessage('全ての項目を入力してください');
      return;
    }

    setManageLoading(true);
    setManageMessage(null);
    try {
      const response = await fetch(`/api/admin/rooms/${roomId}/manage/quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          question: quizForm.question.trim(),
          choices: quizForm.choices.map((choice) => choice.trim()),
          answerIndex: quizForm.answerIndex,
          ord: quizForm.ord ? Number.parseInt(quizForm.ord, 10) : undefined,
          imageUrl: quizForm.imageUrl.trim() || undefined,
          isTemplate: quizForm.isTemplate
        })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? response.statusText);
      }

      const json = (await response.json()) as { quiz: QuizSummary };
      if (quizForm.isTemplate) {
        setTemplates((prev) => [...prev, json.quiz].sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)));
      } else {
        setQuizzes((prev) => [...prev, json.quiz].sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)));
      }
      setQuizForm({ question: '', choices: ['', '', '', ''], answerIndex: 0, ord: '', imageUrl: '', isTemplate: false });
      setManageMessage(quizForm.isTemplate ? 'テンプレートを追加しました' : 'クイズを追加しました');
    } catch (err) {
      setManageMessage(err instanceof Error ? err.message : 'クイズの追加に失敗しました');
    } finally {
      setManageLoading(false);
    }
  };

  const handleEditQuiz = (quiz: QuizSummary) => {
    setEditingQuizId(quiz.id);
    // Fetch full quiz details
    fetch(`/api/admin/rooms/${roomId}/manage/quizzes/${quiz.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    })
      .then((res) => res.json())
      .then((data) => {
        const quizData = data as { quiz: { question: string; choices: string[]; answer_index: number; ord: number; image_url?: string; is_template?: boolean } };
        setQuizForm({
          question: quizData.quiz.question,
          choices: quizData.quiz.choices,
          answerIndex: quizData.quiz.answer_index,
          ord: quizData.quiz.ord?.toString() ?? '',
          imageUrl: quizData.quiz.image_url ?? '',
          isTemplate: quizData.quiz.is_template ?? false
        });
        // Scroll to form
        setTimeout(() => {
          quizFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      })
      .catch(() => {
        setManageMessage('クイズの読み込みに失敗しました');
      });
  };

  const handleUpdateQuiz = async () => {
    if (!isCloudMode || !adminToken || !editingQuizId) return;
    if (!quizForm.question.trim() || quizForm.choices.some((choice) => !choice.trim())) {
      setManageMessage('全ての項目を入力してください');
      return;
    }

    setManageLoading(true);
    setManageMessage(null);
    try {
      const response = await fetch(`/api/admin/rooms/${roomId}/manage/quizzes/${editingQuizId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          question: quizForm.question.trim(),
          choices: quizForm.choices.map((choice) => choice.trim()),
          answerIndex: quizForm.answerIndex,
          ord: quizForm.ord ? Number.parseInt(quizForm.ord, 10) : undefined,
          imageUrl: quizForm.imageUrl.trim() || undefined,
          isTemplate: quizForm.isTemplate
        })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? response.statusText);
      }

      const json = (await response.json()) as { quiz: QuizSummary };
      if (quizForm.isTemplate) {
        setTemplates((prev) =>
          prev.map((q) => (q.id === editingQuizId ? json.quiz : q)).sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
        );
      } else {
        setQuizzes((prev) =>
          prev.map((q) => (q.id === editingQuizId ? json.quiz : q)).sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
        );
      }
      setQuizForm({ question: '', choices: ['', '', '', ''], answerIndex: 0, ord: '', imageUrl: '', isTemplate: false });
      setEditingQuizId(null);
      setManageMessage(quizForm.isTemplate ? 'テンプレートを更新しました' : 'クイズを更新しました');
    } catch (err) {
      setManageMessage(err instanceof Error ? err.message : 'クイズの更新に失敗しました');
    } finally {
      setManageLoading(false);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!isCloudMode || !adminToken) return;

    setManageLoading(true);
    setManageMessage(null);
    try {
      const response = await fetch(`/api/admin/rooms/${roomId}/manage/quizzes/${quizId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? response.statusText);
      }

      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      setManageMessage('クイズを削除しました');
    } catch (err) {
      setManageMessage(err instanceof Error ? err.message : 'クイズの削除に失敗しました');
    } finally {
      setManageLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingQuizId(null);
    setQuizForm({ question: '', choices: ['', '', '', ''], answerIndex: 0, ord: '', imageUrl: '', isTemplate: false });
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

  const handleCopyTemplate = async (templateId: string) => {
    if (!isCloudMode || !adminToken) return;

    setManageLoading(true);
    setManageMessage(null);
    try {
      const response = await fetch(`/api/admin/rooms/${roomId}/manage/quizzes/copy-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ templateId })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? response.statusText);
      }

      const json = (await response.json()) as { quiz: QuizSummary };
      setQuizzes((prev) => [...prev, json.quiz].sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)));
      setManageMessage('テンプレートをコピーしました');
    } catch (err) {
      setManageMessage(err instanceof Error ? err.message : 'テンプレートのコピーに失敗しました');
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

    const isBuzzerMode = quizSettings.buzzerMode;

    openConfirm({
      title: isBuzzerMode ? '早押しクイズの正解を公開しますか？' : '正解を公開しますか？',
      description: isBuzzerMode ? '最速正解者のみ得点が付与されます。一度公開すると取り消せません。' : '一度公開すると取り消せません。',
      confirmLabel: '公開する',
      variant: 'danger',
      onConfirm: async () => {
        if (isBuzzerMode) {
          // 早押しモード: 専用APIを直接呼ぶ
          if (!isCloudMode || !adminToken) {
            setError('管理トークンがありません');
            return;
          }
          try {
            const response = await fetch(`/api/admin/rooms/${roomId}/buzzer-quiz/reveal`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminToken}`
              },
              body: JSON.stringify({ quizId: activeQuiz.quizId, points: 10 })
            });
            if (!response.ok) {
              const data = (await response.json().catch(() => ({}))) as { error?: string };
              throw new Error(data.error ?? 'Failed to reveal buzzer quiz');
            }
            await loadLogs();
          } catch (err) {
            setError(err instanceof Error ? err.message : '早押しクイズの公開に失敗しました');
          }
        } else {
          // 通常モード
          void send({ type: 'quiz:reveal', payload: undefined }, { quizId: activeQuiz.quizId });
        }
      }
    });
  };

  const handleLottery = (kind: 'all' | 'groom' | 'bride') => {
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
                variant={mode === 'countup' ? 'primary' : 'secondary'}
                icon={Shuffle}
                onClick={() => send({ type: 'mode:switch', payload: { to: 'countup' } })}
                disabled={modeSwitching}
                className="flex-1"
              >
                {modeSwitching && mode !== 'countup' ? '切替中...' : 'タップチャレンジ'}
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
              <div className="flex items-center gap-3 rounded-lg bg-orange-50 p-3 border border-orange-200">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-orange-700">
                  <input
                    type="checkbox"
                    checked={quizSettings.buzzerMode}
                    onChange={(e) => setQuizSettings({ ...quizSettings, buzzerMode: e.target.checked })}
                    className="h-4 w-4 rounded border-orange-300 text-orange-600 focus:ring-2 focus:ring-orange-400"
                    disabled={mode !== 'quiz'}
                  />
                  <span className="font-medium">早押しモード（最速正解者のみ得点）</span>
                </label>
              </div>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <AdminButton
                  icon={ListChecks}
                  disabled={mode !== 'quiz' || activeQuiz !== null}
                  onClick={() => {
                    const deadlineMs = quizSettings.enableTimeLimit ? quizSettings.quizDurationSeconds * 1000 : undefined;
                    void send({ type: 'quiz:next', payload: undefined }, {
                      deadlineMs,
                      representativeByTable: quizSettings.representativeByTable
                    });
                  }}
                >
                  クイズ表示
                </AdminButton>
                <AdminButton
                  variant="danger"
                  icon={Eye}
                  disabled={!activeQuiz}
                  onClick={handleReveal}
                >
                  正解を公開
                </AdminButton>
              </div>
              <div className="flex flex-col gap-3">
                <AdminButton
                  variant="secondary"
                  icon={ListChecks}
                  disabled={mode !== 'quiz' || phase !== 'idle'}
                  onClick={() => send({ type: 'game:stop', payload: undefined })}
                  className="w-full"
                >
                  ランキング表示
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
                  クイズ作成
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
                <div className="mt-6 space-y-6">
                  <form
                    ref={quizFormRef}
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleCreateQuiz();
                    }}
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-brand-blue-700">問題文</label>
                      <textarea
                        className="w-full rounded-xl border border-brand-blue-200 bg-white px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
                        value={quizForm.question}
                        onChange={(event) => setQuizForm((prev) => ({ ...prev, question: event.target.value }))}
                        rows={3}
                        required
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {quizForm.choices.map((choice, index) => (
                        <div key={index} className="space-y-2">
                          <label className="flex items-center justify-between text-sm font-medium text-brand-blue-700">
                            <span>{`選択肢 ${CHOICE_LABELS[index]}`}</span>
                            <span className="flex items-center gap-2 text-xs text-brand-blue-700/70">
                              <input
                                type="radio"
                                name="quiz-answer"
                                checked={quizForm.answerIndex === index}
                                onChange={() => setQuizForm((prev) => ({ ...prev, answerIndex: index }))}
                              />
                              正解
                            </span>
                          </label>
                          <input
                            className="w-full rounded-xl border border-brand-blue-200 bg-white px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
                            value={choice}
                            onChange={(event) =>
                              setQuizForm((prev) => ({
                                ...prev,
                                choices: prev.choices.map((item, itemIndex) => (itemIndex === index ? event.target.value : item))
                              }))
                            }
                            required
                          />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-brand-blue-700">画像URL (任意)</label>
                        <input
                          className="w-full rounded-xl border border-brand-blue-200 bg-white px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
                          value={quizForm.imageUrl}
                          onChange={(event) => setQuizForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                          type="url"
                          placeholder="https://example.com/image.jpg"
                        />
                        <p className="text-xs text-brand-blue-700/70">※投影画面のみに表示されます</p>
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-brand-blue-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={quizForm.isTemplate}
                            onChange={(e) => setQuizForm((prev) => ({ ...prev, isTemplate: e.target.checked }))}
                            className="rounded border-brand-blue-200"
                          />
                          <span>共通テンプレートとして保存</span>
                        </label>
                        <p className="text-xs text-brand-blue-700/70">※全ルームで再利用可能なクイズとして保存されます</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-brand-blue-700">表示順 (任意)</label>
                          <input
                            className="w-full rounded-xl border border-brand-blue-200 bg-white px-4 py-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
                            value={quizForm.ord}
                            onChange={(event) => setQuizForm((prev) => ({ ...prev, ord: event.target.value }))}
                            type="number"
                            min={1}
                            placeholder="自動採番"
                          />
                        </div>
                        <div className="flex items-end gap-2">
                      {editingQuizId ? (
                        <>
                          <PrimaryButton type="button" onClick={handleUpdateQuiz} disabled={manageLoading || !isCloudMode}>
                            更新する
                          </PrimaryButton>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="rounded-xl border border-brand-blue-300 bg-white px-6 py-3 text-sm font-semibold text-brand-blue-700 hover:bg-brand-blue-50 disabled:opacity-50"
                            disabled={manageLoading}
                          >
                            キャンセル
                          </button>
                        </>
                      ) : (
                        <button
                          type="submit"
                          disabled={manageLoading || !isCloudMode}
                          className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-ink border border-brand-blue-200 hover:bg-brand-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          クイズを追加
                        </button>
                      )}
                        </div>
                      </div>
                    </div>
                  </form>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-brand-blue-700">登録済みクイズ</h3>
                    {quizzes.length === 0 ? (
                      <p className="text-sm text-brand-blue-700/70">登録されたクイズはまだありません。</p>
                    ) : (
                      <ul className="space-y-2">
                        {quizzes.map((quiz) => (
                          <li key={quiz.id} className="rounded-xl bg-white/85 px-4 py-3 text-sm shadow-brand">
                            <div className="flex items-start justify-between gap-2">
                              <button
                                onClick={() => handleEditQuiz(quiz)}
                                className="flex-1 text-left hover:opacity-80 transition-opacity"
                                disabled={manageLoading}
                              >
                                <p className="font-semibold text-brand-blue-700">{quiz.question}</p>
                                <p className="text-xs text-brand-blue-700/60">
                                  表示順: {quiz.ord ?? '-'} / 登録日: {new Date(quiz.created_at).toLocaleString('ja-JP')}
                                </p>
                              </button>
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditQuiz(quiz);
                                  }}
                                  className="rounded-lg bg-brand-blue-100 p-2 text-brand-blue-700 hover:bg-brand-blue-200 disabled:opacity-50"
                                  disabled={manageLoading || editingQuizId === quiz.id}
                                  title="編集"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('このクイズを削除しますか?')) {
                                      void handleDeleteQuiz(quiz.id);
                                    }
                                  }}
                                  className="rounded-lg bg-red-100 p-2 text-red-700 hover:bg-red-200 disabled:opacity-50"
                                  disabled={manageLoading}
                                  title="削除"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-brand-blue-700">共通テンプレート</h3>
                    {templates.length === 0 ? (
                      <p className="text-sm text-brand-blue-700/70">共通テンプレートはまだありません。</p>
                    ) : (
                      <ul className="space-y-2">
                        {templates.map((template) => (
                          <li key={template.id} className="rounded-xl bg-blue-50/85 px-4 py-3 text-sm shadow-brand border border-brand-blue-200">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="font-semibold text-brand-blue-700">{template.question}</p>
                                <p className="text-xs text-brand-blue-700/60">
                                  表示順: {template.ord ?? '-'} / 登録日: {new Date(template.created_at).toLocaleString('ja-JP')}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => void handleCopyTemplate(template.id)}
                                  className="rounded-lg bg-green-100 p-2 text-green-700 hover:bg-green-200 disabled:opacity-50"
                                  disabled={manageLoading}
                                  title="このルームにコピー"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleEditQuiz(template)}
                                  className="rounded-lg bg-brand-blue-100 p-2 text-brand-blue-700 hover:bg-brand-blue-200 disabled:opacity-50"
                                  disabled={manageLoading || editingQuizId === template.id}
                                  title="編集"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
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

function StatusItem({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex items-center gap-4 rounded-xl glass-panel p-4 border border-slate-200">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500 shadow-md">
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink/70">{label}</p>
        <p className="mt-1 text-xl font-bold text-ink">{value}</p>
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

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition-all ${active ? 'bg-white shadow-md text-ink' : 'text-ink/80 hover:text-ink'}`}
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
            <span className="font-semibold text-brand-terra-600">{lotteryKindLabel(entry.kind)}</span>
            <span className="text-xs text-brand-blue-700/60">{new Date(entry.created_at).toLocaleString()}</span>
          </div>
          <p className="mt-2 text-lg font-semibold text-ink">{entry.players?.display_name ?? '未登録'}</p>
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

function phaseColor(phase: 'idle' | 'running' | 'ended') {
  switch (phase) {
    case 'running':
      return 'text-green-600';
    case 'ended':
      return 'text-blue-600';
    default:
      return 'text-ink/70';
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
