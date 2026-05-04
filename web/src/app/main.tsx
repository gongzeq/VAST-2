import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import './styles.css';

import { AppProviders } from './providers/app-providers';
import { router } from './router/router';

async function bootstrapMsw(): Promise<void> {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_USE_MSW === 'false') return;
  try {
    const { worker } = await import('./msw/worker');
    await worker.start({ onUnhandledRequest: 'bypass' });
  } catch (err) {
    // Failure to register a worker should not block development.
    // eslint-disable-next-line no-console
    console.warn('MSW 启动失败，应用将以 fetch 失败方式继续：', err);
  }
}

async function main() {
  await bootstrapMsw();
  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('#root not found');
  createRoot(rootEl).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
}

void main();
