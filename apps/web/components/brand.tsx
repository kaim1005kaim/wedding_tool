import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export function Section({ title, subtitle, children }: PropsWithChildren<{ title?: string; subtitle?: string }>) {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-4">
      {(title || subtitle) && (
        <div className="glass-panel-strong mb-6 rounded-3xl p-8 text-center shadow-brand-md slide-up">
          {title ? <h1 className="text-title-lg font-bold tracking-tight text-brand-blue-700">{title}</h1> : null}
          {subtitle ? <p className="mt-3 text-base text-brand-blue-700/80">{subtitle}</p> : null}
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
      className={`group relative h-14 w-full overflow-hidden rounded-2xl bg-gradient-secondary font-semibold text-white shadow-brand-md transition-all duration-300 hover:shadow-brand-lg hover:scale-[1.02] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-terra-400 disabled:opacity-60 disabled:hover:scale-100 disabled:cursor-not-allowed ${className ?? ''}`}
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
      className={`h-12 w-full rounded-xl border-2 border-brand-blue-300 bg-white/80 font-semibold text-brand-blue-700 shadow-brand-sm transition-all duration-300 hover:bg-brand-blue-50 hover:border-brand-blue-400 hover:shadow-brand active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400 disabled:opacity-60 disabled:cursor-not-allowed ${className ?? ''}`}
    />
  );
}

export function Badge({
  children,
  variant = 'default',
  className
}: PropsWithChildren<{ variant?: 'default' | 'success' | 'warning' | 'error'; className?: string }>) {
  const variantStyles = {
    default: 'bg-brand-blue-100 text-brand-blue-700',
    success: 'bg-success-light text-success',
    warning: 'bg-warning-light text-warning',
    error: 'bg-error-light text-error'
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
      className={`glass-panel rounded-2xl p-6 shadow-brand transition-all duration-300 ${hoverable ? 'hover:shadow-brand-lg hover:scale-[1.01]' : ''} ${className ?? ''}`}
    >
      {children}
    </div>
  );
}
