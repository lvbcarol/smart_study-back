import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import JSZip from 'jszip';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app';
import Usuario from '../src/models/Usuario';
import Turma from '../src/models/Turma';
import { buildMaterialsContext, extractText, CONTEXT_BUDGET_CHARS } from '../src/services/materials';
import Material from '../src/models/Material';
import { startQuiz } from './helpers';

let mongod: MongoMemoryServer;
const app = createApp();

let teacher: string, teacher2: string, ana: string, bia: string, outsider: string;
let anaId: string;
let turmaId: string, notebookId: string, lessonA: string, lessonB: string;

async function signup(email: string, extra: Record<string, unknown> = {}) {
  await request(app).post('/api/usuario/register').send({ name: email.split('@')[0], email, password: 'secret123', ...extra });
  const res = await request(app).post('/api/usuario/login').send({ email, password: 'secret123' });
  return { auth: `Bearer ${res.body.token}`, id: res.body.usuario._id as string };
}

/** PDF mínimo e válido com uma linha de texto */
function makePdf(text: string): Buffer {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${`BT /F1 18 Tf 20 80 Td (${text}) Tj ET`.length} >>\nstream\nBT /F1 18 Tf 20 80 Td (${text}) Tj ET\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

/** DOCX mínimo e válido com um parágrafo */
async function makeDocx(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri('turmas'));
  await Usuario.init();

  teacher = (await signup('prof@t.com', { role: 'teacher', inviteCode: 'invite-123' })).auth;
  teacher2 = (await signup('prof2@t.com', { role: 'teacher', inviteCode: 'invite-123' })).auth;
  const a = await signup('ana@t.com');
  ana = a.auth; anaId = a.id;
  bia = (await signup('bia@t.com')).auth;
  outsider = (await signup('fora@t.com')).auth;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('turmas', () => {
  it('só professor gerencia turmas', async () => {
    expect((await request(app).get('/api/turmas')).status).toBe(401);
    expect((await request(app).get('/api/turmas').set('Authorization', ana)).status).toBe(403);
    expect((await request(app).post('/api/turmas').set('Authorization', ana).send({ name: 'Hack' })).status).toBe(403);
  });

  it('cria, lista, renomeia e valida o nome', async () => {
    expect((await request(app).post('/api/turmas').set('Authorization', teacher).send({ name: '' })).status).toBe(400);
    const created = await request(app).post('/api/turmas').set('Authorization', teacher).send({ name: '3º Ano A' });
    expect(created.status).toBe(201);
    turmaId = created.body._id;

    const list = await request(app).get('/api/turmas').set('Authorization', teacher);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ name: '3º Ano A', studentsCount: 0, pendingCount: 0, notebooksCount: 0 });

    const renamed = await request(app).put(`/api/turmas/${turmaId}`).set('Authorization', teacher).send({ name: '3º Ano B' });
    expect(renamed.body.name).toBe('3º Ano B');
  });

  it('professor não enxerga nem altera a turma de outro', async () => {
    expect((await request(app).get(`/api/turmas/${turmaId}`).set('Authorization', teacher2)).status).toBe(404);
    expect((await request(app).put(`/api/turmas/${turmaId}`).set('Authorization', teacher2).send({ name: 'x' })).status).toBe(404);
    expect((await request(app).delete(`/api/turmas/${turmaId}`).set('Authorization', teacher2)).status).toBe(404);
    expect((await request(app).post(`/api/turmas/${turmaId}/students`).set('Authorization', teacher2).send({ emails: 'ana@t.com' })).status).toBe(404);
    expect((await request(app).get('/api/turmas')).status).toBe(401);
    expect((await request(app).get('/api/turmas/invalido').set('Authorization', teacher)).status).toBe(404);
  });
});

describe('matrícula por e-mail', () => {
  it('classifica cada e-mail e aceita lista separada por vírgula/linha', async () => {
    const res = await request(app).post(`/api/turmas/${turmaId}/students`).set('Authorization', teacher)
      .send({ emails: 'ana@t.com, ANA@t.com;\nnovo@t.com\nprof2@t.com\nnao-e-email' });
    expect(res.status).toBe(200);
    const byEmail = Object.fromEntries(res.body.results.map((r: any) => [r.email, r.status]));
    expect(byEmail).toEqual({
      'ana@t.com': 'enrolled', // duplicata no mesmo pedido é ignorada
      'novo@t.com': 'pending',
      'prof2@t.com': 'not_student',
      'nao-e-email': 'invalid',
    });

    const again = await request(app).post(`/api/turmas/${turmaId}/students`).set('Authorization', teacher).send({ emails: ['ana@t.com', 'novo@t.com'] });
    expect(Object.fromEntries(again.body.results.map((r: any) => [r.email, r.status]))).toEqual({ 'ana@t.com': 'already', 'novo@t.com': 'already_pending' });

    const detail = await request(app).get(`/api/turmas/${turmaId}`).set('Authorization', teacher);
    expect(detail.body.students.map((s: any) => s.email)).toEqual(['ana@t.com']);
    expect(detail.body.pendingEmails).toEqual(['novo@t.com']);
  });

  it('exige ao menos um e-mail e limita o tamanho do pedido', async () => {
    expect((await request(app).post(`/api/turmas/${turmaId}/students`).set('Authorization', teacher).send({ emails: '   ' })).status).toBe(400);
    const many = Array.from({ length: 101 }, (_, i) => `x${i}@t.com`);
    expect((await request(app).post(`/api/turmas/${turmaId}/students`).set('Authorization', teacher).send({ emails: many })).status).toBe(400);
  });

  it('o convite pendente vira matrícula quando a pessoa se cadastra', async () => {
    await signup('novo@t.com');
    const detail = await request(app).get(`/api/turmas/${turmaId}`).set('Authorization', teacher);
    expect(detail.body.students.map((s: any) => s.email).sort()).toEqual(['ana@t.com', 'novo@t.com']);
    expect(detail.body.pendingEmails).toEqual([]);
  });

  it('cancela convite pendente e remove aluno', async () => {
    await request(app).post(`/api/turmas/${turmaId}/students`).set('Authorization', teacher).send({ emails: 'depois@t.com' });
    expect((await request(app).delete(`/api/turmas/${turmaId}/pending/depois@t.com`).set('Authorization', teacher)).status).toBe(204);
    const novo = await Usuario.findOne({ email: 'novo@t.com' });
    expect((await request(app).delete(`/api/turmas/${turmaId}/students/${novo!._id}`).set('Authorization', teacher)).status).toBe(204);
    const detail = await request(app).get(`/api/turmas/${turmaId}`).set('Authorization', teacher);
    expect(detail.body.students.map((s: any) => s.email)).toEqual(['ana@t.com']);
    expect(detail.body.pendingEmails).toEqual([]);
  });
});

describe('matérias da turma e acesso dos alunos', () => {
  it('professor cria matéria na turma e o aluno matriculado a vê com o nome do professor e da turma', async () => {
    const nb = await request(app).post('/api/notebooks').set('Authorization', teacher).send({ title: 'Cálculo', turma: turmaId });
    expect(nb.status).toBe(201);
    notebookId = nb.body._id;
    await request(app).post(`/api/notebooks/${notebookId}/lessons`).set('Authorization', teacher).send({ title: 'Derivadas' });
    const withB = await request(app).post(`/api/notebooks/${notebookId}/lessons`).set('Authorization', teacher).send({ title: 'Integrais' });
    lessonA = withB.body.lessons[0]._id;
    lessonB = withB.body.lessons[1]._id;

    const list = await request(app).get('/api/notebooks').set('Authorization', ana);
    const mine = list.body.find((n: any) => n._id === notebookId);
    expect(mine).toMatchObject({ title: 'Cálculo', readOnly: true, turmaName: '3º Ano B', ownerName: 'prof' });

    const teacherList = await request(app).get('/api/notebooks').set('Authorization', teacher);
    expect(teacherList.body.find((n: any) => n._id === notebookId)).toMatchObject({ readOnly: false, turmaName: '3º Ano B' });
    expect(teacherList.body.find((n: any) => n._id === notebookId).ownerName).toBeUndefined();

    const turmas = await request(app).get('/api/turmas').set('Authorization', teacher);
    expect(turmas.body[0].notebooksCount).toBe(1);
  });

  it('aluno de fora da turma não vê a matéria; o professor pode desvincular e revincular', async () => {
    expect((await request(app).get('/api/notebooks').set('Authorization', bia)).body.find((n: any) => n._id === notebookId)).toBeUndefined();

    const unlinked = await request(app).put(`/api/notebooks/${notebookId}`).set('Authorization', teacher).send({ turma: null });
    expect(unlinked.status).toBe(200);
    expect((await request(app).get('/api/notebooks').set('Authorization', ana)).body.find((n: any) => n._id === notebookId)).toBeUndefined();

    expect((await request(app).put(`/api/notebooks/${notebookId}`).set('Authorization', teacher).send({ turma: String(new mongoose.Types.ObjectId()) })).status).toBe(404);
    expect((await request(app).put(`/api/notebooks/${notebookId}`).set('Authorization', teacher).send({})).status).toBe(400);
    expect((await request(app).put(`/api/notebooks/${notebookId}`).set('Authorization', teacher2).send({ turma: turmaId })).status).toBe(404);

    expect((await request(app).put(`/api/notebooks/${notebookId}`).set('Authorization', teacher).send({ turma: turmaId })).status).toBe(200);
    expect((await request(app).get('/api/notebooks').set('Authorization', ana)).body.find((n: any) => n._id === notebookId)).toBeTruthy();
  });

  it('remover o aluno da turma tira o acesso à matéria', async () => {
    await request(app).post(`/api/turmas/${turmaId}/students`).set('Authorization', teacher).send({ emails: 'bia@t.com' });
    expect((await request(app).get('/api/notebooks').set('Authorization', bia)).body.find((n: any) => n._id === notebookId)).toBeTruthy();
    const bi = await Usuario.findOne({ email: 'bia@t.com' });
    await request(app).delete(`/api/turmas/${turmaId}/students/${bi!._id}`).set('Authorization', teacher);
    expect((await request(app).get('/api/notebooks').set('Authorization', bia)).body.find((n: any) => n._id === notebookId)).toBeUndefined();
  });
});

describe('extração de texto', () => {
  it('lê TXT, MD, PDF e DOCX', async () => {
    expect((await extractText(Buffer.from('Olá, mundo.\r\n\r\n\r\n\r\nFim'), 'a.txt')).text).toBe('Olá, mundo.\n\nFim');
    expect((await extractText(Buffer.from('# Título\n\ntexto'), 'a.md')).text).toContain('# Título');
    expect((await extractText(makePdf('Regra da cadeia'), 'a.pdf')).text).toContain('Regra da cadeia');
    expect((await extractText(await makeDocx('Integral definida'), 'a.docx')).text).toContain('Integral definida');
  });

  it('rejeita tipo não suportado, arquivo vazio e arquivo ilegível', async () => {
    await expect(extractText(Buffer.from('x'), 'virus.exe')).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    await expect(extractText(Buffer.from('   \n  '), 'vazio.txt')).rejects.toMatchObject({ code: 'EMPTY' });
    await expect(extractText(Buffer.from('isto não é um pdf'), 'quebrado.pdf')).rejects.toMatchObject({ code: 'UNREADABLE' });
    await expect(extractText(Buffer.from('isto não é um docx'), 'quebrado.docx')).rejects.toMatchObject({ code: 'UNREADABLE' });
  });

  it('limita o texto guardado por material', async () => {
    const big = 'a'.repeat(400_000);
    const r = await extractText(Buffer.from(big), 'grande.txt');
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBe(300_000);
  });
});

describe('materiais de apoio (API)', () => {
  it('professor envia texto colado e arquivos; aluno matriculado só lista', async () => {
    const text = await request(app).post(`/api/notebooks/${notebookId}/materials/text`).set('Authorization', teacher)
      .send({ title: 'Resumo da professora', text: 'Derivada é a taxa de variação instantânea.' });
    expect(text.status).toBe(201);
    expect(text.body).toMatchObject({ title: 'Resumo da professora', kind: 'text', lesson: null });
    expect(text.body.extractedText).toBeUndefined();

    const txt = await request(app).post(`/api/notebooks/${notebookId}/materials/file`).set('Authorization', teacher)
      .field('lessonId', lessonA).attach('file', Buffer.from('Regra do produto: (fg)\' = f\'g + fg\''), 'regras.txt');
    expect(txt.status).toBe(201);
    expect(txt.body).toMatchObject({ title: 'regras', kind: 'file', fileName: 'regras.txt', lesson: lessonA, lessonTitle: 'Derivadas' });

    const pdf = await request(app).post(`/api/notebooks/${notebookId}/materials/file`).set('Authorization', teacher)
      .field('title', 'Slides em PDF').attach('file', makePdf('Slide sobre limites'), 'slides.pdf');
    expect(pdf.status).toBe(201);
    expect(pdf.body.title).toBe('Slides em PDF');

    const docx = await request(app).post(`/api/notebooks/${notebookId}/materials/file`).set('Authorization', teacher)
      .attach('file', await makeDocx('Lista de exercícios'), 'Lista de exercícios à mão.docx');
    expect(docx.status).toBe(201);
    expect(docx.body.fileName).toBe('Lista de exercícios à mão.docx'); // acentos preservados

    const asStudent = await request(app).get(`/api/notebooks/${notebookId}/materials`).set('Authorization', ana);
    expect(asStudent.status).toBe(200);
    expect(asStudent.body).toHaveLength(4);
    expect(JSON.stringify(asStudent.body)).not.toContain('taxa de variação'); // nunca vai o texto na lista
  });

  it('aluno não envia, apaga nem lê o texto; quem está fora nem lista', async () => {
    const base = `/api/notebooks/${notebookId}/materials`;
    expect((await request(app).post(`${base}/text`).set('Authorization', ana).send({ title: 'x', text: 'y' })).status).toBe(403);
    expect((await request(app).post(`${base}/file`).set('Authorization', ana).attach('file', Buffer.from('x'), 'a.txt')).status).toBe(403);
    const list = await request(app).get(base).set('Authorization', teacher);
    const id = list.body[0]._id;
    expect((await request(app).delete(`${base}/${id}`).set('Authorization', ana)).status).toBe(403);
    expect((await request(app).get(`${base}/${id}`).set('Authorization', ana)).status).toBe(403);
    expect((await request(app).get(base).set('Authorization', outsider)).status).toBe(404);
    expect((await request(app).get(base).set('Authorization', teacher2)).status).toBe(404);
    expect((await request(app).get(base)).status).toBe(401);
  });

  it('valida entrada: tipo, vazio, aula de outro caderno', async () => {
    const base = `/api/notebooks/${notebookId}/materials`;
    expect((await request(app).post(`${base}/file`).set('Authorization', teacher).attach('file', Buffer.from('x'), 'virus.exe')).status).toBe(415);
    expect((await request(app).post(`${base}/file`).set('Authorization', teacher).attach('file', Buffer.from('  '), 'vazio.txt')).status).toBe(422);
    expect((await request(app).post(`${base}/file`).set('Authorization', teacher)).status).toBe(400);
    expect((await request(app).post(`${base}/text`).set('Authorization', teacher).send({ title: '', text: 'x' })).status).toBe(400);
    expect((await request(app).post(`${base}/text`).set('Authorization', teacher).send({ title: 'x', text: 'y', lessonId: String(new mongoose.Types.ObjectId()) })).status).toBe(400);
  });

  it('dono vê a prévia e apaga', async () => {
    const base = `/api/notebooks/${notebookId}/materials`;
    const list = await request(app).get(base).set('Authorization', teacher);
    const id = list.body[0]._id;
    const preview = await request(app).get(`${base}/${id}`).set('Authorization', teacher);
    expect(preview.body.preview).toContain('Derivada');
    expect((await request(app).delete(`${base}/${id}`).set('Authorization', teacher)).status).toBe(204);
    expect((await request(app).delete(`${base}/${id}`).set('Authorization', teacher)).status).toBe(404);
    // devolve o material para os próximos testes
    await request(app).post(`${base}/text`).set('Authorization', teacher).send({ title: 'Resumo da professora', text: 'Derivada é a taxa de variação instantânea.' });
  });
});

describe('IA usa os materiais da aula', () => {
  it('o contexto inclui materiais do caderno e da própria aula, e só deles', async () => {
    const forA = await buildMaterialsContext(notebookId, lessonA);
    const forB = await buildMaterialsContext(notebookId, lessonB);
    expect(forA.titles).toContain('regras'); // material só da aula A
    expect(forB.titles).not.toContain('regras');
    expect(forB.titles).toContain('Resumo da professora'); // material do caderno inteiro
    expect(forA.text).toContain('### Material: Resumo da professora');
    expect(forA.count).toBe(forA.titles.length);
  });

  it('respeita o orçamento de caracteres', async () => {
    const huge = await Material.create({
      notebook: notebookId, title: 'Enorme', kind: 'text', extractedText: 'x'.repeat(200_000), charCount: 200_000, truncated: false, uploadedBy: anaId,
    });
    const ctx = await buildMaterialsContext(notebookId, lessonA);
    expect(ctx.text.length).toBeLessThanOrEqual(CONTEXT_BUDGET_CHARS);
    expect(ctx.truncated).toBe(true);
    await huge.deleteOne();
  });

  it('resumo e chat do aluno citam os materiais; quiz informa quantos usou', async () => {
    const summary = await request(app).post('/api/ai/summarize').set('Authorization', ana).send({ topic: 'Derivadas', language: 'pt-BR', lessonId: lessonA });
    expect(summary.status).toBe(200);
    expect(summary.body.materialsUsed).toBeGreaterThanOrEqual(2);
    expect(summary.body.summary).toContain('Baseado nos materiais do professor');
    expect(summary.body.summary).toContain('Resumo da professora');

    const chat = await request(app).post('/api/ai/chat').set('Authorization', ana)
      .send({ lessonId: lessonA, message: 'O que é a regra do produto?', language: 'pt-BR', history: [{ sender: 'bot', text: 'Oi!' }] });
    expect(chat.status).toBe(200);
    expect(chat.body.reply).toContain('regra do produto');
    expect(chat.body.reply).toContain('Consultei os materiais');

    const quiz = await startQuiz(app, ana, lessonB, 'Integrais');
    expect(quiz.draft.questions.length).toBe(8);
    const created = await request(app).post('/api/quizz/drafts').set('Authorization', ana).send({ lessonId: lessonB, topic: 'Integrais' });
    expect(created.body.materialsUsed).toBe((await buildMaterialsContext(notebookId, lessonB)).count);
  });

  it('sem acesso à aula não há resumo, chat nem material', async () => {
    expect((await request(app).post('/api/ai/summarize').set('Authorization', outsider).send({ topic: 'x', lessonId: lessonA })).status).toBe(404);
    expect((await request(app).post('/api/ai/chat').set('Authorization', outsider).send({ lessonId: lessonA, message: 'oi' })).status).toBe(404);
    expect((await request(app).post('/api/ai/chat').set('Authorization', ana).send({ lessonId: lessonA, message: '' })).status).toBe(400);
  });

  it('o resumo sem aula continua funcionando (sem materiais)', async () => {
    const res = await request(app).post('/api/ai/summarize').set('Authorization', ana).send({ topic: 'Física', language: 'en' });
    expect(res.status).toBe(200);
    expect(res.body.materialsUsed).toBe(0);
    expect(res.body.summary).not.toContain("teacher's materials");
  });

  it('a aula informa quantos materiais a IA usa', async () => {
    const a = await request(app).get(`/api/lessons/${lessonA}`).set('Authorization', ana);
    const b = await request(app).get(`/api/lessons/${lessonB}`).set('Authorization', ana);
    expect(a.body.materialsCount).toBeGreaterThan(b.body.materialsCount);
  });
});

describe('apagar', () => {
  it('apagar a aula leva os materiais dela; apagar a turma preserva a matéria', async () => {
    const before = await Material.countDocuments({ lesson: lessonA });
    expect(before).toBeGreaterThan(0);
    await request(app).delete(`/api/notebooks/${notebookId}/lessons/${lessonA}`).set('Authorization', teacher);
    expect(await Material.countDocuments({ lesson: lessonA })).toBe(0);

    expect((await request(app).delete(`/api/turmas/${turmaId}`).set('Authorization', teacher)).status).toBe(204);
    expect(await Turma.countDocuments({ _id: turmaId })).toBe(0);
    const own = await request(app).get('/api/notebooks').set('Authorization', teacher);
    expect(own.body.find((n: any) => n._id === notebookId)).toBeTruthy();
    expect((await request(app).get('/api/notebooks').set('Authorization', ana)).body.find((n: any) => n._id === notebookId)).toBeUndefined();
  });

  it('apagar o caderno leva todos os materiais', async () => {
    expect(await Material.countDocuments({ notebook: notebookId })).toBeGreaterThan(0);
    await request(app).delete(`/api/notebooks/${notebookId}`).set('Authorization', teacher);
    expect(await Material.countDocuments({ notebook: notebookId })).toBe(0);
  });
});
