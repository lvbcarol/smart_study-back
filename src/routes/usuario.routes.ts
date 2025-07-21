// src/routes/usuario.routes.ts
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario';

const router = Router();

// Rota de Registro
router.post('/register', async (req: Request, res: Response) => {
  const { name, email, password } = req.body;

  try {
    if (await Usuario.findOne({ email })) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    const usuario = await Usuario.create({ name, email, password });
    
    // Não retorna a senha no response
    (usuario as any).password = undefined;

    res.status(201).json({ message: 'Usuário cadastrado com sucesso!', usuario });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
});

// Rota de Login
router.post('/login', async function(req: Request, res: Response) {
  const { email, password } = req.body;

  try {
    const usuario = await Usuario.findOne({ email }).select('+password');

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Compara a senha enviada com a senha criptografada no banco
    if (!(await bcrypt.compare(password, usuario.password))) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }
    
    // Gera o Token JWT
    const token = jwt.sign({ id: usuario.id }, process.env.JWT_SECRET as string, {
      expiresIn: '1d', // Token válido por 1 dia
    });

    // Não retorna a senha no response
    (usuario as any).password = undefined;

    res.status(200).json({ message: 'Login bem-sucedido!', usuario, token });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao realizar login.' });
  }
});

export default router;