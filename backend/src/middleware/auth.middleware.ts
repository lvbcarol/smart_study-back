// src/middleware/auth.middleware.ts
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario';
import { AuthRequest, Role } from '../types';

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ error: 'Nenhum token fornecido ou token mal formatado' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
    req.userId = decoded.id;
    return next();
  } catch (error) {
    return res.status(401).send({ error: 'Token inválido' });
  }
};

/**
 * Exige um dos papéis informados. Confere o papel no banco (e não no token),
 * porque o token pode ficar desatualizado por até 1 dia.
 * Deve ser usado depois de authMiddleware.
 */
export const requireRole = (...roles: Role[]) => async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await Usuario.findById(req.userId).select('role');
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });
    if (!roles.includes(user.role)) return res.status(403).json({ error: 'Acesso negado para este perfil.' });
    req.userRole = user.role;
    return next();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to verify permissions.' });
  }
};
