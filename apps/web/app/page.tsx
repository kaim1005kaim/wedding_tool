import Link from 'next/link';

const demoRoomId = '8337598d-bf83-41e5-a06d-3843e119d00a';

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ecru text-ink">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-brand-blue-50 via-transparent to-brand-terra-50" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-12 px-6 py-16">
        <div className="glass-panel rounded-2xl px-8 py-10 shadow-brand">
          <p className="text-xs uppercase tracking-[0.35em] text-brand-blue-700/70">Wedding Reception Realtime Game</p>
          <h1 className="mt-3 text-5xl font-serif text-brand-terra-600">wedding_tool</h1>
          <p className="mt-6 max-w-2xl text-base text-brand-blue-700/90">
            会場に設置されたQRコードからアクセスし、スマホでリアルタイム演出に参加できます。<br />
            参加者は <code className="mx-1 rounded-xl bg-brand-blue-50 px-2 py-1 text-brand-blue-700">/join/&lt;ルームコード&gt;</code> にアクセスし、
            表示されたモーダルで本名（姓・名）を入力してください。
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/admin"
            className="rounded-xl border border-brand-blue-200 px-5 py-3 text-sm font-semibold text-brand-blue-700 transition hover:bg-brand-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
          >
            管理画面
          </Link>
          <Link
            href={`/projector/${demoRoomId}`}
            className="rounded-xl border border-brand-blue-200 px-5 py-3 text-sm font-semibold text-brand-blue-700 transition hover:bg-brand-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
          >
            投影画面 (TEST)
          </Link>
        </div>

        <div className="glass-panel rounded-2xl px-8 py-6 shadow-brand">
          <h2 className="text-lg font-semibold text-brand-blue-700">進行の流れ</h2>
          <div className="mt-4 grid gap-4 text-sm text-brand-blue-700/80 md:grid-cols-3">
            <div>
              <p className="font-semibold text-brand-terra-600">1. 参加登録</p>
              <p className="mt-1 leading-relaxed">QRからアクセスし、姓と名を入力して参加します。</p>
            </div>
            <div>
              <p className="font-semibold text-brand-terra-600">2. タップチャレンジ</p>
              <p className="mt-1 leading-relaxed">合図が出たらテンポ良くタップしてスコアを競います。</p>
            </div>
            <div>
              <p className="font-semibold text-brand-terra-600">3. クイズ＆抽選</p>
              <p className="mt-1 leading-relaxed">クイズ回答や抽選演出で会場を盛り上げます。</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
