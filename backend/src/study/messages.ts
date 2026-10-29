// src/study/messages.ts — textos do plano de estudo (a explicação "por quê?" de cada sugestão)
export type PlanLang = 'pt' | 'en' | 'es';

export function planLang(language?: string): PlanLang {
  const l = (language ?? '').toLowerCase();
  return l.startsWith('pt') ? 'pt' : l.startsWith('es') ? 'es' : 'en';
}

type Params = Record<string, string | number>;

const MESSAGES = {
  pt: {
    kolbTitleEC: 'Praticar com um caso real',
    kolbTitleOR: 'Ler o resumo e refletir',
    kolbTitleCA: 'Revisar os conceitos',
    kolbTitleEA: 'Resolver um exercício prático',
    kolbNameEC: 'experiência concreta (casos reais)',
    kolbNameOR: 'observação reflexiva (ler e refletir)',
    kolbNameCA: 'conceituação abstrata (teoria e conceitos)',
    kolbNameEA: 'experimentação ativa (praticar)',
    kolbReason: 'Pelo ciclo de Kolb, só {pct}% do seu estudo é de {name}. Experimentar esse jeito de aprender completa o ciclo e ajuda a fixar melhor.',
    taskOverdue: 'A tarefa "{title}" está atrasada. Entregar logo evita perder mais pontos.',
    taskToday: 'A tarefa "{title}" vence nas próximas 24 horas.',
    taskSoon: 'A tarefa "{title}" vence em {days} dia(s).',
    taskLater: 'A tarefa "{title}" ainda tem prazo, mas adiantar alivia a semana.',
    taskNoDue: 'A tarefa "{title}" está pendente e não tem prazo definido.',
    taskResume: ' Você já começou, então falta menos.',
    agendaOverdue: '"{title}" estava marcado na sua agenda e ficou para trás.',
    agendaToday: '"{title}" está na sua agenda para hoje.',
    agendaSoon: '"{title}" está na sua agenda para daqui a {days} dia(s).',
    weakness: 'Você errou "{topic}" em {pct}% das respostas recentes ({lesson}). Um quiz de reforço ajuda a fixar.',
    flashcards: 'Você tem {due} cartão(ões) para revisar. Revisar no dia certo é o que faz a memória durar.',
    explore: 'Você não tem pendências hoje. Que tal revisar "{lesson}" ({notebook}) e treinar um pouco?',
    exploreTitle: 'Revisar {lesson}',
    weaknessTitle: 'Quiz de reforço: {topic}',
    flashcardsTitle: 'Revisar flashcards',
    introBusy: 'Montei seu plano de {minutes} minutos, começando pelo que é mais urgente.',
    introFree: 'Sem pendências por aqui. Montei um plano leve de {minutes} minutos.',
    introEmpty: 'Ainda não há o que sugerir: crie um caderno ou entre em uma turma para eu montar seu plano.',
  },
  en: {
    kolbTitleEC: 'Practice with a real case',
    kolbTitleOR: 'Read the summary and reflect',
    kolbTitleCA: 'Review the concepts',
    kolbTitleEA: 'Solve a practical exercise',
    kolbNameEC: 'concrete experience (real cases)',
    kolbNameOR: 'reflective observation (reading and reflecting)',
    kolbNameCA: 'abstract conceptualization (theory and concepts)',
    kolbNameEA: 'active experimentation (practicing)',
    kolbReason: 'In the Kolb cycle, only {pct}% of your study is {name}. Trying this way of learning completes the cycle and helps things stick.',
    taskOverdue: 'The task "{title}" is overdue. Handing it in soon avoids losing more points.',
    taskToday: 'The task "{title}" is due within 24 hours.',
    taskSoon: 'The task "{title}" is due in {days} day(s).',
    taskLater: 'The task "{title}" still has time, but getting ahead lightens your week.',
    taskNoDue: 'The task "{title}" is pending and has no due date.',
    taskResume: ' You already started, so there is less left.',
    agendaOverdue: '"{title}" was on your agenda and fell behind.',
    agendaToday: '"{title}" is on your agenda for today.',
    agendaSoon: '"{title}" is on your agenda in {days} day(s).',
    weakness: 'You missed "{topic}" in {pct}% of recent answers ({lesson}). A reinforcement quiz helps it stick.',
    flashcards: 'You have {due} card(s) to review. Reviewing on the right day is what makes memory last.',
    explore: 'You have nothing pending today. How about reviewing "{lesson}" ({notebook}) and practicing a bit?',
    exploreTitle: 'Review {lesson}',
    weaknessTitle: 'Reinforcement quiz: {topic}',
    flashcardsTitle: 'Review flashcards',
    introBusy: 'I built your {minutes}-minute plan, starting with what is most urgent.',
    introFree: 'Nothing pending here. I built a light {minutes}-minute plan.',
    introEmpty: 'Nothing to suggest yet: create a notebook or join a class and I will build your plan.',
  },
  es: {
    kolbTitleEC: 'Practicar con un caso real',
    kolbTitleOR: 'Leer el resumen y reflexionar',
    kolbTitleCA: 'Repasar los conceptos',
    kolbTitleEA: 'Resolver un ejercicio práctico',
    kolbNameEC: 'experiencia concreta (casos reales)',
    kolbNameOR: 'observación reflexiva (leer y reflexionar)',
    kolbNameCA: 'conceptualización abstracta (teoría y conceptos)',
    kolbNameEA: 'experimentación activa (practicar)',
    kolbReason: 'En el ciclo de Kolb, solo el {pct}% de tu estudio es de {name}. Probar esta forma de aprender completa el ciclo y ayuda a fijar mejor.',
    taskOverdue: 'La tarea "{title}" está atrasada. Entregarla pronto evita perder más puntos.',
    taskToday: 'La tarea "{title}" vence en las próximas 24 horas.',
    taskSoon: 'La tarea "{title}" vence en {days} día(s).',
    taskLater: 'La tarea "{title}" aún tiene plazo, pero adelantarla alivia tu semana.',
    taskNoDue: 'La tarea "{title}" está pendiente y no tiene fecha límite.',
    taskResume: ' Ya empezaste, así que falta menos.',
    agendaOverdue: '"{title}" estaba en tu agenda y quedó atrás.',
    agendaToday: '"{title}" está en tu agenda para hoy.',
    agendaSoon: '"{title}" está en tu agenda para dentro de {days} día(s).',
    weakness: 'Fallaste "{topic}" en el {pct}% de las respuestas recientes ({lesson}). Un quiz de refuerzo ayuda a fijarlo.',
    flashcards: 'Tienes {due} tarjeta(s) para repasar. Repasar en el día correcto hace que la memoria dure.',
    explore: 'Hoy no tienes pendientes. ¿Qué tal repasar "{lesson}" ({notebook}) y practicar un poco?',
    exploreTitle: 'Repasar {lesson}',
    weaknessTitle: 'Quiz de refuerzo: {topic}',
    flashcardsTitle: 'Repasar flashcards',
    introBusy: 'Armé tu plan de {minutes} minutos, empezando por lo más urgente.',
    introFree: 'Sin pendientes por aquí. Armé un plan ligero de {minutes} minutos.',
    introEmpty: 'Aún no hay qué sugerir: crea un cuaderno o únete a una clase y armaré tu plan.',
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)['pt'];

export function msg(lang: PlanLang, key: MessageKey, params: Params = {}): string {
  return MESSAGES[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''));
}
