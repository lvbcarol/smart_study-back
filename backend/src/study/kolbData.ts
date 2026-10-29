// src/study/kolbData.ts — junta do banco o que o perfil de Kolb precisa (respostas por tipo e minutos por atividade)
import { Types } from 'mongoose';
import StudySession from '../models/StudySession';
import WeaknessStat from '../models/WeaknessStat';
import type { QuestionType } from '../quiz/questions';
import { decayed } from '../quiz/weakness';
import { computeKolb, KolbInput, KolbProfile } from './kolb';

const DAY_MS = 24 * 60 * 60 * 1000;
export const KOLB_WINDOW_DAYS = 30;

/** Perfil de um aluno. `includeTime` = false ignora o tempo de estudo (quando ele não o compartilha com o professor). */
export async function loadKolbInput(userIds: unknown[], now: Date, includeTime = true): Promise<Map<string, KolbInput>> {
  const ids = userIds.map((u) => new Types.ObjectId(String(u)));
  const [stats, sessions] = await Promise.all([
    WeaknessStat.find({ user: { $in: ids } }).select('user type seen wrong lastAt').lean(),
    includeTime
      ? StudySession.aggregate<{ _id: { user: Types.ObjectId; kind: string }; seconds: number }>([
          { $match: { user: { $in: ids }, startedAt: { $gte: new Date(now.getTime() - KOLB_WINDOW_DAYS * DAY_MS) } } },
          { $group: { _id: { user: '$user', kind: '$kind' }, seconds: { $sum: '$seconds' } } },
        ])
      : Promise.resolve([]),
  ]);

  const out = new Map<string, KolbInput>(ids.map((id) => [String(id), { byType: {}, minutesByKind: {} }]));
  for (const s of stats) {
    const input = out.get(String(s.user))!;
    const d = decayed(s, now);
    const cur = input.byType[s.type as QuestionType] ?? { seen: 0, wrong: 0 };
    input.byType[s.type as QuestionType] = { seen: cur.seen + d.seen, wrong: cur.wrong + d.wrong };
  }
  for (const g of sessions) {
    const input = out.get(String(g._id.user));
    if (input) input.minutesByKind[g._id.kind] = (input.minutesByKind[g._id.kind] ?? 0) + g.seconds / 60;
  }
  return out;
}

export async function loadKolbProfile(userId: string, now: Date): Promise<KolbProfile> {
  const input = (await loadKolbInput([userId], now)).get(userId)!;
  return computeKolb(input);
}
