// src/routes/usuario.routes.ts
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario';

const router = Router();

// ... (Suas rotas de /register e /login continuam aqui, sem alterações)
router.post('/register', async (req: Request, res: Response) => {
  // ... (código existente)
});

router.post('/login', async (req: Request, res: Response) => {
  // ... (código existente)
});


// ROTA DE ESQUECEU A SENHA - VERSÃO CORRIGIDA
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      // Por segurança, não informamos se o e-mail foi encontrado ou não
      return res.status(200).json({ message: 'Se um usuário com este e-mail existir, um link de recuperação será enviado.' });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hora

    usuario.passwordResetToken = resetToken;
    usuario.passwordResetExpires = resetTokenExpires;
    await usuario.save();

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT as string, 10),
      auth: {
        user: process.env.EMAIL_USER, // <- Seu login da Brevo
        pass: process.env.EMAIL_PASS, // <- Sua senha SMTP da Brevo
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL || `http://localhost:5173`}/reset-password/${resetToken}`;

    await transporter.sendMail({
      // ✅ CORREÇÃO PRINCIPAL AQUI:
      // Usamos o EMAIL_USER (login da Brevo) como o remetente técnico.
      from: `"Smart Study" <${process.env.EMAIL_USER}>`, 
      // Adicionamos seu e-mail pessoal como o endereço para "Responder Para".
      replyTo: 'carolcontamaua@gmail.com', 
      to: email, // O destinatário continua sendo o usuário
      subject: 'Recuperação de Senha - Smart Study',
      html: `
        <div style="font-family: sans-serif; text-align: center; padding: 20px;">
          <h2>Recuperação de Senha</h2>
          <p>Você solicitou a redefinição de senha para sua conta no Smart Study.</p>
          <p>Clique no botão abaixo para criar uma nova senha:</p>
          <a href="${resetUrl}" style="background-color: #5B21B6; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Redefinir Senha</a>
          <p>Este link expira em 1 hora.</p>
          <p style="font-size: 0.9em; color: #888;">Se você não solicitou isso, pode ignorar este e-mail com segurança.</p>
        </div>
      `,
    });

    res.status(200).json({ message: 'Se um usuário com este e-mail existir, um link de recuperação será enviado.' });
  } catch (error) {
    console.error('ERRO AO ENVIAR E-MAIL DE RECUPERAÇÃO:', error);
    // Não envie o erro detalhado para o frontend por segurança
    res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  }
});


// ROTA DE REDEFINIR A SENHA - SEM ALTERAÇÕES
router.post('/reset-password', async (req: Request, res: Response) => {
    // ... (o código aqui permanece o mesmo da resposta anterior)
});

export default router;