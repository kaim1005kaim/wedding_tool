import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export function Section({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <section className="mx-auto w-full max-w-3xl p-6">
      <div className="glass-panel rounded-2xl shadow-brand p-6 mb-4">
        <h1 className="text-2xl font-semibold tracking-wide">{title}</h1>
        {subtitle ? <p className="text-sm mt-1 text-brand-blue-700/80">{subtitle}</p> : null}
      </div>
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
