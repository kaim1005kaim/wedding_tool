import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export function Section({ title, subtitle, children }: PropsWithChildren<{ title?: string; subtitle?: string }>) {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-4">
      {(title || subtitle) && (
        <div className="glass-panel-strong mb-6 rounded-3xl p-8 text-center shadow-md slide-up border border-white/30">
          {title ? <h1 className="text-title-lg font-bold tracking-tight text-ink">{title}</h1> : null}
          {subtitle ? <p className="mt-3 text-base text-ink/80">{subtitle}</p> : null}
        </div>
      )}
      {children}
    </section>
  );
}

export function PrimaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`group relative h-16 w-full overflow-hidden rounded-2xl bg-gradient-sunset font-semibold text-lg text-white shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed ${className ?? ''}`}
    >
      <span className="relative z-10">{props.children}</span>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-600" />
    </button>
  );
}

export function SecondaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`h-14 w-full rounded-xl border-2 border-cyan-300 bg-white/80 font-semibold text-base text-cyan-700 shadow-sm transition-all duration-300 hover:bg-cyan-50 hover:border-cyan-400 hover:shadow-md active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed ${className ?? ''}`}
    />
  );
}

export function Badge({
  children,
  variant = 'default',
  className
}: PropsWithChildren<{ variant?: 'default' | 'success' | 'warning' | 'error'; className?: string }>) {
  const variantStyles = {
    default: 'bg-orange-100 text-orange-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${variantStyles[variant]} ${className ?? ''}`}>
      {children}
    </span>
  );
}

export function Card({ children, className, hoverable = false }: PropsWithChildren<{ className?: string; hoverable?: boolean }>) {
  return (
    <div
      className={`glass-panel rounded-2xl p-6 shadow-md border border-white/30 transition-all duration-300 ${hoverable ? 'hover:shadow-lg hover:scale-[1.01]' : ''} ${className ?? ''}`}
    >
      {children}
    </div>
  );
}
