// src/utils/joinCode.ts — código curto para o aluno entrar em uma turma sozinho
import crypto from 'crypto';

// sem I, O, 0 e 1 para não confundir quando o professor dita ou escreve o código
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const JOIN_CODE_LENGTH = 6;

export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return code;
}

/** Aceita "abc-234", " ABC 234 " etc. */
export function normalizeJoinCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
