// src/services/materials.ts — extração de texto (PDF/DOCX/TXT/MD) e montagem do contexto que a IA recebe
import path from 'path';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import Material from '../models/Material';

export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'];
/** Limite de texto guardado por material */
export const MAX_MATERIAL_CHARS = 300_000;
/** Limite de texto de materiais enviado à IA em cada chamada */
export const CONTEXT_BUDGET_CHARS = 120_000;

export class ExtractionError extends Error {
  constructor(public code: 'UNSUPPORTED' | 'EMPTY' | 'UNREADABLE', message: string) {
    super(message);
  }
}

export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function limitText(text: string): { text: string; truncated: boolean } {
  return text.length > MAX_MATERIAL_CHARS ? { text: text.slice(0, MAX_MATERIAL_CHARS), truncated: true } : { text, truncated: false };
}

export async function extractText(buffer: Buffer, filename: string): Promise<{ text: string; truncated: boolean }> {
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new ExtractionError('UNSUPPORTED', `Unsupported file type: ${ext || '(none)'}`);
  }

  let raw: string;
  try {
    if (ext === '.pdf') {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        raw = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    } else if (ext === '.docx') {
      raw = (await mammoth.extractRawText({ buffer })).value;
    } else {
      raw = buffer.toString('utf8');
    }
  } catch (error) {
    throw new ExtractionError('UNREADABLE', 'Could not read this file.');
  }

  const text = cleanText(raw);
  if (!text) throw new ExtractionError('EMPTY', 'No text found in this file (scanned PDFs have no text to extract).');
  return limitText(text);
}

export interface MaterialsContext {
  text: string;
  count: number;
  titles: string[];
  truncated: boolean;
}

/** Materiais que valem para a aula: os do caderno inteiro + os da própria aula, dentro de um orçamento de caracteres. */
export async function buildMaterialsContext(
  notebookId: unknown,
  lessonId?: unknown,
  budget = CONTEXT_BUDGET_CHARS
): Promise<MaterialsContext> {
  const scope = lessonId ? [{ lesson: null }, { lesson: lessonId }] : [{ lesson: null }];
  const materials = await Material.find({ notebook: notebookId, $or: scope }).sort({ createdAt: 1 }).lean();

  const parts: string[] = [];
  const titles: string[] = [];
  let used = 0;
  let truncated = false;
  for (const m of materials) {
    const header = `### Material: ${m.title}\n`;
    const room = budget - used - header.length;
    if (room <= 0) { truncated = true; break; }
    const body = m.extractedText.length > room ? m.extractedText.slice(0, room) : m.extractedText;
    if (body.length < m.extractedText.length) truncated = true;
    parts.push(header + body);
    titles.push(m.title);
    used += header.length + body.length + 2;
  }
  return { text: parts.join('\n\n'), count: titles.length, titles, truncated };
}

export async function countMaterials(notebookId: unknown, lessonId?: unknown): Promise<number> {
  const scope = lessonId ? [{ lesson: null }, { lesson: lessonId }] : [{ lesson: null }];
  return Material.countDocuments({ notebook: notebookId, $or: scope });
}
