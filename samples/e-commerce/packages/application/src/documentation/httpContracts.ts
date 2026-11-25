import { z } from 'zod';

export const problemDetailsSchema = z
  .object({
    type: z.string().optional(),
    title: z.string().optional(),
    status: z.number(),
    detail: z.string().optional(),
    instance: z.string().optional(),
  })
  .meta({ id: 'ProblemDetails' });
