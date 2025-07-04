import { Router, Request, Response } from 'express';
import Usuario from '../models/Usuario';

const router = Router();

// Cadastro
router.post('/cadastro', async function(req: Request, res: Response) {
  const { nomeCompleto, email, senha, confirmarSenha } = req.body;

  if (senha !== confirmarSenha) {
    return res.status(400).json({ erro: 'As senhas não coincidem.' });
  }

  try {
    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ erro: 'Email já cadastrado.' });
    }

    const novoUsuario = new Usuario({ nomeCompleto, email, senha });
    await novoUsuario.save();

    res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso!' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
  }
});

// ✅ Login
router.post('/login', async function(req: Request, res: Response) {
  const { email, senha } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    if (usuario.senha !== senha) {
      return res.status(401).json({ erro: 'Senha incorreta.' });
    }

    res.status(200).json({ mensagem: 'Login bem-sucedido!', usuario });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao realizar login.' });
  }
});

export default router;
