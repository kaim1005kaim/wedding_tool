import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export function Section({ title, subtitle, children }: PropsWithChildren<{ title?: string; subtitle?: string }>) {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-4">
      {(title || subtitle) && (
        <div className="glass-panel mb-6 rounded-2xl p-6 text-center shadow-brand">
          {title ? <h1 className="text-3xl font-semibold tracking-wide text-brand-blue-700">{title}</h1> : null}
          {subtitle ? <p className="mt-2 text-sm text-brand-blue-700/80">{subtitle}</p> : null}
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
      className={`h-12 w-full rounded-xl bg-brand-terra-600 text-white font-semibold shadow-brand hover:bg-brand-terra-700 active:scale-[.99] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-terra-400 disabled:opacity-60 ${className ?? ''}`}
    />
  );
}
