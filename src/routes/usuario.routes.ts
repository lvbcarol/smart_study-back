// src/routes/usuario.routes.ts
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario';

const router = Router();

// Rota de Registro - (Agora funcionando, podemos remover os logs extras se quisermos)
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  try {
    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }
    const usuario = await Usuario.create({ name, email, password });
    (usuario as any).password = undefined;
    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', usuario });
  } catch (error) {
    console.error('[REGISTER] ERRO NO BLOCO CATCH:', error);
    res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
});


// ROTA DE LOGIN - COM LOGS DE DEPURAÇÃO
router.post('/login', async (req: Request, res: Response) => {
  console.log('[LOGIN] Rota iniciada.');
  const { email, password } = req.body;
  console.log(`[LOGIN] Tentativa de login para o e-mail: ${email}`);

  try {
    console.log('[LOGIN] Passo 1: Buscando usuário no banco...');
    // Pede para o banco incluir o campo 'password' que normalmente é oculto
    const usuario = await Usuario.findOne({ email }).select('+password');
    console.log('[LOGIN] Passo 1.1: Busca no banco concluída.');

    if (!usuario) {
      console.log('[LOGIN] Erro: Usuário não encontrado.');
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    
    console.log('[LOGIN] Passo 2: Comparando senhas com bcrypt...');
    const isMatch = await bcrypt.compare(password, usuario.password);
    console.log('[LOGIN] Passo 2.1: Comparação de senhas concluída.');

    if (!isMatch) {
      console.log('[LOGIN] Erro: Senha incorreta.');
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    console.log('[LOGIN] Passo 3: Gerando token JWT...');
    const token = jwt.sign({ id: usuario.id }, process.env.JWT_SECRET as string, {
      expiresIn: '1d',
    });
    console.log('[LOGIN] Passo 3.1: Token gerado.');

    (usuario as any).password = undefined;

    console.log('[LOGIN] Passo 4: Enviando resposta de sucesso.');
    res.status(200).json({ message: 'Login bem-sucedido!', usuario, token });
    console.log('[LOGIN] Rota finalizada com sucesso.');

  } catch (error) {
    console.error('[LOGIN] ERRO NO BLOCO CATCH:', error);
    res.status(500).json({ error: 'Erro ao realizar login.' });
  }
});


// Suas outras rotas
router.post('/forgot-password', async (req: Request, res: Response) => {
    // ... código de forgot-password existente ...
});
router.post('/reset-password', async (req: Request, res: Response) => {
    // ... código de reset-password existente ...
});


export default router;