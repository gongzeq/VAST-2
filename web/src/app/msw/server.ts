/**
 * Node-side MSW server for vitest. Tests `import { server } from '@/app/msw/server'`
 * and `server.use(...)` to override per-test handlers.
 */
import { setupServer } from 'msw/node';

import { handlers } from './handlers';

export const server = setupServer(...handlers);
