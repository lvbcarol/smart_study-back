import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import Usuario from '../models/Usuario';
import Turma from '../models/Turma';
import { listStudentTurmas } from '../services/access';
import { authMiddleware } from '../middleware/auth.middleware';
import { AuthRequest } from '../types';
import { parseBody } from '../utils/validate';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório.').max(100),
  email: z.string().trim().toLowerCase().pipe(z.email('E-mail inválido.')),
  password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.').max(128),
  role: z.enum(['student', 'teacher']).default('student'),
  inviteCode: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().min(1),
});

const updateMeSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  language: z.enum(['en-US', 'pt-BR']).optional(),
  accessibility: z.object({
    audioDescription: z.boolean().optional(),
    signLanguage: z.boolean().optional(),
  }).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  palette: z.string().regex(/^[a-z0-9-]{1,30}$/).optional(),
  fontScale: z.number().min(0.85).max(1.4).optional(),
  avatarColor: z.string().max(30).optional(),
  weeklyGoalMinutes: z.number().int().min(0).max(6000).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.').max(128),
});

function validInviteCode(provided?: string): boolean {
  const expected = process.env.TEACHER_INVITE_CODE;
  if (!expected || !provided) return false; // sem código configurado, cadastro de professor fica desativado
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Usuário + vínculo com escola: aluno sem turma é "avulso", com turma é "vinculado". */
async function withLinks(user: InstanceType<typeof Usuario>) {
  const turmas = user.role === 'student' ? await listStudentTurmas(String(user._id)) : [];
  return { ...user.toJSON(), turmas, linked: turmas.length > 0 };
}

// ROTA DE REGISTRO
router.post('/register', async (req: Request, res: Response) => {
  const data = parseBody(registerSchema, req.body, res);
  if (!data) return;

  if (data.role === 'teacher' && !validInviteCode(data.inviteCode)) {
    return res.status(403).json({ error: 'Código de convite inválido.' });
  }

  try {
    if (await Usuario.findOne({ email: data.email })) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }
    const usuario = await Usuario.create({
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role,
    });

    // Matricula o aluno nas turmas para as quais o professor já o convidou por e-mail
    if (usuario.role === 'student') {
      await Turma.updateMany(
        { pendingEmails: usuario.email },
        { $addToSet: { students: usuario._id }, $pull: { pendingEmails: usuario.email } }
      );
    }

    const { password: _, ...usuarioSemSenha } = usuario.toObject();
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', usuario: usuarioSemSenha });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
});

// ROTA DE LOGIN
router.post('/login', async (req: Request, res: Response) => {
  const data = parseBody(loginSchema, req.body, res);
  if (!data) return;

  try {
    const usuario = await Usuario.findOne({ email: data.email }).select('+password');
    // Mesma resposta para e-mail inexistente e senha errada (evita enumerar contas)
    if (!usuario || !usuario.password || !(await bcrypt.compare(data.password, usuario.password))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const { password: _, ...usuarioSemSenha } = usuario.toObject();

    const token = jwt.sign({ id: usuario._id, role: usuario.role }, process.env.JWT_SECRET as string, {
      expiresIn: '1d',
    });

    res.send({ usuario: usuarioSemSenha, token });
  } catch (err) {
    res.status(400).send({ error: 'Login failed' });
  }
});

// ROTAS DE RECUPERAÇÃO DE SENHA
router.post('/forgot-password', async (req: Request, res: Response) => {
  // TODO: envio de e-mail (nodemailer) ainda não implementado
  res.status(501).json({ message: 'Recuperação de senha ainda não implementada.' });
});
router.post('/reset-password', async (req: Request, res: Response) => {
  // TODO: depende do fluxo de forgot-password
  res.status(501).json({ message: 'Redefinição de senha ainda não implementada.' });
});

// ROTA GET /me - Busca os dados do usuário logado
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await Usuario.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(await withLinks(user));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user data.' });
  }
});

// ROTA PUT /me - Atualiza perfil e preferências do usuário logado (role não é editável)
router.put('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const data = parseBody(updateMeSchema, req.body, res);
  if (!data) return;

  try {
    const { accessibility, ...rest } = data;
    const update: Record<string, unknown> = { ...rest };
    if (accessibility?.audioDescription !== undefined) update['accessibility.audioDescription'] = accessibility.audioDescription;
    if (accessibility?.signLanguage !== undefined) update['accessibility.signLanguage'] = accessibility.signLanguage;

    const user = await Usuario.findByIdAndUpdate(req.userId, { $set: update }, { new: true, runValidators: true });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(await withLinks(user));
  } catch (error) {
    console.error('Erro ao salvar preferências:', error);
    res.status(500).json({ error: 'Failed to update preferences.' });
  }
});

// ROTA PUT /me/password - Troca a senha (exige a senha atual)
router.put('/me/password', authMiddleware, async (req: AuthRequest, res: Response) => {
  const data = parseBody(changePasswordSchema, req.body, res);
  if (!data) return;

  try {
    const user = await Usuario.findById(req.userId).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (!(await bcrypt.compare(data.currentPassword, user.password))) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    user.password = data.newPassword; // o hook pre-save faz o hash
    await user.save();
    res.json({ message: 'Password updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

export default router;
