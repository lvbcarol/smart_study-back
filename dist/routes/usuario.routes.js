"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Usuario_1 = __importDefault(require("../models/Usuario"));
const router = express_1.default.Router();
router.post('/cadastro', async (req, res) => {
    const { nomeCompleto, email, senha, confirmarSenha } = req.body;
    if (senha !== confirmarSenha) {
        return res.status(400).json({ erro: 'As senhas não coincidem.' });
    }
    try {
        const usuarioExistente = await Usuario_1.default.findOne({ email });
        if (usuarioExistente) {
            return res.status(400).json({ erro: 'Email já cadastrado.' });
        }
        const novoUsuario = new Usuario_1.default({ nomeCompleto, email, senha });
        await novoUsuario.save();
        res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso!' });
    }
    catch (erro) {
        res.status(500).json({ erro: 'Erro ao cadastrar usuário.' });
    }
});
exports.default = router;
