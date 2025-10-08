import Link from 'next/link';

const demoRoomId = '8337598d-bf83-41e5-a06d-3843e119d00a';

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-brand-blue-100 via-ecru to-brand-terra-100 text-ink">
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-brand-blue-50/30 via-transparent to-brand-terra-50/30" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-12 px-6 py-16">
        <div className="glass-panel-strong rounded-3xl px-12 py-12 shadow-brand-xl slide-up">
          <div className="mb-4 text-6xl">🎉</div>
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-brand-blue-700/70">Wedding Reception Realtime Game</p>
          <h1 className="mt-4 text-display-md font-serif font-bold text-brand-terra-600">wedding_tool</h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-brand-blue-700/90">
            会場に設置されたQRコードからアクセスし、スマホでリアルタイム演出に参加できます。<br />
            参加者は <code className="mx-1 rounded-xl bg-brand-blue-100 px-3 py-1.5 text-base font-semibold text-brand-blue-700">/join/&lt;ルームコード&gt;</code> にアクセスし、
            表示されたモーダルでテーブル番号とお名前を入力してください。
          </p>
        </div>

        <div className="flex flex-wrap gap-4 slide-up">
          <Link
            href="/admin"
            className="group flex items-center gap-2 rounded-2xl border-2 border-brand-blue-300 bg-white/90 px-6 py-4 text-base font-bold text-brand-blue-700 shadow-brand-sm transition-all duration-300 hover:scale-[1.02] hover:border-brand-blue-400 hover:bg-brand-blue-50 hover:shadow-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">🔐</span>
            <span>管理画面</span>
          </Link>
          <Link
            href={`/projector/${demoRoomId}`}
            className="group flex items-center gap-2 rounded-2xl border-2 border-brand-terra-300 bg-white/90 px-6 py-4 text-base font-bold text-brand-terra-700 shadow-brand-sm transition-all duration-300 hover:scale-[1.02] hover:border-brand-terra-400 hover:bg-brand-terra-50 hover:shadow-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-terra-400"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">📺</span>
            <span>投影画面 (TEST)</span>
          </Link>
        </div>

        <div className="glass-panel-strong rounded-3xl px-10 py-10 shadow-brand-lg slide-up">
          <h2 className="text-title-sm font-bold text-brand-blue-700">📋 進行の流れ</h2>
          <div className="mt-8 grid gap-6 text-base text-brand-blue-700/80 md:grid-cols-3">
            <div className="rounded-2xl bg-white/80 p-6 shadow-brand-sm transition-all duration-300 hover:shadow-brand hover:scale-[1.02]">
              <div className="mb-3 text-4xl">📱</div>
              <p className="font-bold text-brand-terra-600">1. 参加登録</p>
              <p className="mt-2 leading-relaxed">QRからアクセスし、テーブル番号とお名前を入力して参加します。</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-6 shadow-brand-sm transition-all duration-300 hover:shadow-brand hover:scale-[1.02]">
              <div className="mb-3 text-4xl">⚡</div>
              <p className="font-bold text-brand-terra-600">2. タップチャレンジ</p>
              <p className="mt-2 leading-relaxed">合図が出たらテンポ良くタップしてスコアを競います。</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-6 shadow-brand-sm transition-all duration-300 hover:shadow-brand hover:scale-[1.02]">
              <div className="mb-3 text-4xl">🎯</div>
              <p className="font-bold text-brand-terra-600">3. クイズ＆抽選</p>
              <p className="mt-2 leading-relaxed">クイズ回答や抽選演出で会場を盛り上げます。</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
