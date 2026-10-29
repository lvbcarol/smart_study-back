import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import Usuario from '../models/Usuario';
import Turma from '../models/Turma';
import { listStudentTurmas } from '../services/access';
import { deleteUserAccount, exportUserData } from '../services/privacy';
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
  /** aceite dos Termos de uso e da política de dados (LGPD) */
  acceptTerms: z.boolean().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().min(1),
});

const updateMeSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  language: z.enum(['en-US', 'pt-BR', 'es-ES']).optional(),
  accessibility: z.object({
    audioDescription: z.boolean().optional(),
    signLanguage: z.boolean().optional(),
  }).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  palette: z.string().regex(/^[a-z0-9-]{1,30}$/).optional(),
  fontScale: z.number().min(0.85).max(1.4).optional(),
  avatarColor: z.string().max(30).optional(),
  weeklyGoalMinutes: z.number().int().min(0).max(6000).optional(),
  shareStudyTimeWithTeacher: z.boolean().optional(),
  showLearningProfile: z.boolean().optional(),
});

const deleteAccountSchema = z.object({ password: z.string().min(1) });

/** Versão vigente dos Termos de uso: muda quando o texto mudar, para pedir novo aceite. */
export const TERMS_VERSION = '2026-03';

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

  // sem aceite não há conta (o servidor pode relaxar isso só em testes: REQUIRE_CONSENT=false)
  if (process.env.REQUIRE_CONSENT !== 'false' && data.acceptTerms !== true) {
    return res.status(400).json({ error: 'É necessário aceitar os Termos de uso.' });
  }

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
      ...(data.acceptTerms ? { consent: { version: TERMS_VERSION, at: new Date() } } : {}),
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

// ROTA GET /me/export - Baixa todos os dados da conta (direito de acesso, LGPD)
router.get('/me/export', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const data = await exportUserData(req.userId as string);
    if (!data) return res.status(404).json({ error: 'User not found.' });
    res.setHeader('Content-Disposition', 'attachment; filename="smart-study-meus-dados.json"');
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to export data.' });
  }
});

// ROTA DELETE /me - Exclui a conta e os dados (direito de eliminação, LGPD); exige a senha
router.delete('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  const data = parseBody(deleteAccountSchema, req.body, res);
  if (!data) return;
  try {
    const user = await Usuario.findById(req.userId).select('+password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (!(await bcrypt.compare(data.password, user.password))) {
      // 403 (e não 401): senha errada não é sessão expirada, e os apps deslogam quando recebem 401
      return res.status(403).json({ error: 'Password is incorrect.' });
    }
    await deleteUserAccount(String(user._id));
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Failed to delete account.' });
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
      return res.status(403).json({ error: 'Current password is incorrect.' });
    }
    user.password = data.newPassword; // o hook pre-save faz o hash
    await user.save();
    res.json({ message: 'Password updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

export default router;
