/**
 * Frontend mirror of src/modules/auth/contracts/actor-context.contract.ts.
 * Backend ships only a TypeScript type; we add a zod schema so MSW responses
 * can be parsed at the API boundary.
 */
import { z } from 'zod';

import { permissionPointSchema } from './foundation';

export const actorContextSchema = z.object({
  actorId: z.string().min(1),
  roleIds: z.array(z.string().min(1)),
  permissionPoints: z.array(permissionPointSchema),
  assetGroupIds: z.array(z.string().min(1)),
  yoloEnabled: z.boolean(),
});

export type ActorContext = z.infer<typeof actorContextSchema>;
