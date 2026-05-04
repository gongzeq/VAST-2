import type { ReactNode } from 'react';

export interface AnonymousLayoutProps {
  children: ReactNode;
}

export function AnonymousLayout({ children }: AnonymousLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <h1 className="text-base font-semibold text-gray-900">智能网络安全分析平台</h1>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-6">
        {children}
      </main>
    </div>
  );
}
