import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold">wedding_tool</h1>
      <p className="max-w-xl text-lg text-slate-200">
        スマホで参加するリアルタイム演出ゲームです。配布されたQRコードまたはURLから
        <code className="mx-1 rounded bg-slate-800 px-2 py-1 text-brand">
          /join/&lt;ルームコード&gt;
        </code>
        へアクセスしてください。
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-300">
        <Link className="rounded bg-brand px-4 py-2 font-medium text-white" href="/join/TEST">
          参加テストへ (TEST)
        </Link>
        <Link className="rounded border border-slate-500 px-4 py-2" href="/admin">
          管理画面
        </Link>
        <Link className="rounded border border-slate-500 px-4 py-2" href="/projector/8337598d-bf83-41e5-a06d-3843e119d00a">
          投影画面 (TEST)
        </Link>
      </div>
    </main>
  );
}
