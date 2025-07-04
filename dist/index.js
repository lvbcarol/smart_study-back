"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const cors_1 = __importDefault(require("cors"));
const usuario_routes_1 = __importDefault(require("./routes/usuario.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
mongoose_1.default.connect('mongodb+srv://24004308:0TheFlash1#!@cluster0.ukgdnyc.mongodb.net/smart_study?retryWrites=true&w=majority')
    .then(() => console.log('🟢 MongoDB conectado'))
    .catch((err) => console.error('🔴 Erro MongoDB:', err));
// aqui é importante que o segundo argumento seja `usuarioRoutes`
app.use('/usuario', usuario_routes_1.default);
const PORT = 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
