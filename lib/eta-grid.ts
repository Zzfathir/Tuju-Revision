import { z } from "zod";

export const EtaGrid = z.object({
  routeId: z.string(),
  date: z.string(),
  retrieved_at: z.string(),
  source_url: z.string().url(),
  grid: z.array(z.object({ depart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), duration_min: z.number().positive() })).min(1),
});
export type EtaGrid = z.infer<typeof EtaGrid>;
