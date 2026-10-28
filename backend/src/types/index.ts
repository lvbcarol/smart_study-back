// src/types/index.ts
import { Request } from 'express';

export type Role = 'student' | 'teacher';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: Role;
}
