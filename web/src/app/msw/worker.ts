/**
 * Browser worker entrypoint. Imported only in dev (`main.tsx`).
 */
import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
