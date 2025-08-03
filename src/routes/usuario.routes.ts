import { Router, Request } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario';
import { authMiddleware } from '../middleware/auth.middleware';

interface AuthRequest extends Request {
  userId?: string;
}

const router = Router();

// ROTA DE REGISTRO
router.post('/register', async (req: Request, res) => {
  const { name, email, password } = req.body;
  try {
    if (await Usuario.findOne({ email })) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }
    const usuario = await Usuario.create({ name, email, password });

    // ✅ CORREÇÃO: Usa desestruturação para criar um novo objeto sem a senha.
    // Pega a propriedade 'password' e coloca o resto (rest) em 'usuarioSemSenha'.
    const { password: _, ...usuarioSemSenha } = usuario.toObject();

    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', usuario: usuarioSemSenha });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
});

// ROTA DE LOGIN
router.post('/login', async (req: Request, res) => {
  const { email, password } = req.body;
  try {
    const usuario = await Usuario.findOne({ email }).select('+password');
    if (!usuario) {
      return res.status(404).json({ error: 'User not found.' });
    }
    if (!usuario.password || !(await bcrypt.compare(password, usuario.password))) {
      return res.status(401).json({ error: 'Invalid password.' });
    }
    
    // ✅ CORREÇÃO: Usa a mesma técnica de desestruturação aqui.
    const { password: _, ...usuarioSemSenha } = usuario.toObject();

    const token = jwt.sign({ id: usuario._id }, process.env.JWT_SECRET as string, {
      expiresIn: '1d',
    });
    
    res.send({ usuario: usuarioSemSenha, token });
  } catch (err) {
    res.status(400).send({ error: 'Login failed' });
  }
});

// ROTAS DE RECUPERAÇÃO DE SENHA
router.post('/forgot-password', async (req: Request, res) => {
  // ... (código existente da recuperação de senha)
});
router.post('/reset-password', async (req: Request, res) => {
  // ... (código existente da redefinição de senha)
});


// ROTA GET /me - Busca os dados do usuário logado
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = await Usuario.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user data.' });
  }
});

// ROTA PUT /me - Atualiza as preferências do usuário logado
router.put('/me', authMiddleware, async (req: AuthRequest, res) => {
  console.log('--- BACKEND: Recebido pedido para atualizar preferências ---');
  console.log('DADOS RECEBIDOS:', req.body);

  try {
    const { language, accessibility } = req.body;
    const user = await Usuario.findByIdAndUpdate(
      req.userId,
      { language, accessibility },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    console.log('--- BACKEND: Preferências salvas com sucesso! ---');
    res.json(user);
  } catch (error) {
    console.error('--- BACKEND: ERRO AO SALVAR PREFERÊNCIAS ---', error);
    res.status(500).json({ error: 'Failed to update preferences.' });
  }
});

export default router;
