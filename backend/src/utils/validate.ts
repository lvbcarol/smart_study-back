// src/utils/validate.ts
import { Response } from 'express';
import { z } from 'zod';

/** Valida o body; em caso de erro responde 400 e devolve null. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown, res: Response): z.infer<T> | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.');
    res.status(400).json({ error: path ? `${path}: ${issue.message}` : issue?.message ?? 'Invalid data.' });
    return null;
  }
  return result.data;
}
