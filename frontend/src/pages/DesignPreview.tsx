// src/pages/DesignPreview.tsx — apenas em desenvolvimento (/design)
// Vitrine do novo design system para aprovação antes de aplicar no app.
import React, { useState } from 'react';
import { BookOpen, Check, Layers, ListChecks, Moon, RotateCcw, Sparkles, Sun, Monitor, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { PALETTES, NEUTRALS } from '../theme/palettes';
import type { ThemeMode } from '../types';
import { BrandLogo, BrandMark } from '../components/ds/BrandMark';
import { Button } from '../components/ds/Button';
import { Field } from '../components/ds/Field';
import { Modal } from '../components/ds/Modal';
import { Badge, EmptyState, Skeleton, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ds/Misc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { cn } from '@/lib/utils';

const MODES: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { id: 'light', label: 'Claro', icon: <Sun className="h-4 w-4" aria-hidden="true" /> },
  { id: 'dark', label: 'Escuro', icon: <Moon className="h-4 w-4" aria-hidden="true" /> },
  { id: 'system', label: 'Sistema', icon: <Monitor className="h-4 w-4" aria-hidden="true" /> },
];

const chartData = [
  { name: 'Derivadas', media: 82 },
  { name: 'Integrais', media: 64 },
  { name: 'Limites', media: 91 },
  { name: 'Séries', media: 58 },
];

const Section: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <section className="space-y-4">
    <div>
      <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
      {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
    </div>
    {children}
  </section>
);

const Swatch: React.FC<{ name: string; className: string }> = ({ name, className }) => (
  <div className="flex items-center gap-3">
    <span className={cn('h-10 w-10 shrink-0 rounded-xl border border-border', className)} aria-hidden="true" />
    <span className="text-sm font-medium">{name}</span>
  </div>
);

const DesignPreview: React.FC = () => {
  const { mode, palette, fontScale, resolvedMode, setMode, setPalette, setFontScale } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [notify, setNotify] = useState(true);
  const [picked, setPicked] = useState<number | null>(1);
  const [flipped, setFlipped] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Barra de controles do preview */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <BrandLogo />
          <div role="radiogroup" aria-label="Modo de cor" className="inline-flex rounded-xl bg-secondary p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={mode === m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold',
                  mode === m.id ? 'bg-card shadow-soft' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m.icon}{m.label}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Paleta" className="flex items-center gap-2">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                role="radio"
                aria-checked={palette === p.id}
                aria-label={p.name}
                title={p.name}
                onClick={() => setPalette(p.id)}
                style={{ backgroundColor: p[resolvedMode].primary }}
                className={cn(
                  'h-8 w-8 rounded-full border-2 border-card ring-offset-2 ring-offset-background',
                  palette === p.id ? 'ring-2 ring-foreground' : 'hover:scale-110 transition-transform'
                )}
              />
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 text-sm">
            Tamanho do texto
            <input
              type="range" min={0.85} max={1.4} step={0.05} value={fontScale}
              onChange={(e) => setFontScale(Number(e.target.value))}
              className="accent-[hsl(var(--primary))]"
            />
          </label>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-14 px-4 py-10">
        {/* Hero */}
        <section className="grid items-center gap-8 md:grid-cols-2">
          <div className="space-y-5">
            <Badge variant="primary"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Novo visual</Badge>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Estude com calma.<br />Aprenda com clareza.
            </h1>
            <p className="max-w-md text-lg text-muted-foreground">
              Resumos, quizzes e flashcards feitos por IA, num espaço acolhedor que se adapta ao seu jeito de estudar.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg">Começar a estudar</Button>
              <Button size="lg" variant="outline">Ver como funciona</Button>
            </div>
          </div>
          <div className="relative flex justify-center" aria-hidden="true">
            <div className="absolute inset-0 -z-10 rounded-[2.5rem] bg-accent" />
            <div className="grid grid-cols-2 gap-4 p-8">
              <div className="rounded-2xl bg-card p-5 shadow-lifted"><BookOpen className="mb-3 h-7 w-7 text-primary" /><p className="font-bold">Resumos</p><p className="text-sm text-muted-foreground">com seus materiais</p></div>
              <div className="mt-8 rounded-2xl bg-card p-5 shadow-lifted"><ListChecks className="mb-3 h-7 w-7 text-primary" /><p className="font-bold">Quizzes</p><p className="text-sm text-muted-foreground">que se adaptam a você</p></div>
              <div className="rounded-2xl bg-card p-5 shadow-lifted"><Layers className="mb-3 h-7 w-7 text-primary" /><p className="font-bold">Flashcards</p><p className="text-sm text-muted-foreground">revisão espaçada</p></div>
              <div className="mt-8 flex items-center justify-center rounded-2xl bg-card p-5 shadow-lifted"><BrandMark className="h-16 w-16" /></div>
            </div>
          </div>
        </section>

        {/* Tokens */}
        <Section title="Cores" subtitle={`Modo ${resolvedMode === 'dark' ? 'escuro' : 'claro'} · paleta ${PALETTES.find((p) => p.id === palette)?.name}. Neutros quentes fixos; só o destaque muda com a paleta.`}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            <Swatch name="Fundo" className="bg-background" />
            <Swatch name="Card" className="bg-card" />
            <Swatch name="Secundário" className="bg-secondary" />
            <Swatch name="Borda" className="bg-border" />
            <Swatch name="Primária" className="bg-primary" />
            <Swatch name="Tinta da paleta" className="bg-accent" />
            <Swatch name="Sucesso" className="bg-success" />
            <Swatch name="Aviso" className="bg-warning" />
            <Swatch name="Erro" className="bg-destructive" />
            {/* classes explícitas: o Tailwind não gera nomes montados dinamicamente */}
            <Swatch name="Gráfico 1" className="bg-chart-1" />
            <Swatch name="Gráfico 2" className="bg-chart-2" />
            <Swatch name="Gráfico 3" className="bg-chart-3" />
            <Swatch name="Gráfico 4" className="bg-chart-4" />
            <Swatch name="Gráfico 5" className="bg-chart-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            Todas as combinações texto/fundo das 6 paletas nos 2 modos passam no contraste WCAG AA (<code>npm run check:contrast</code>).
            Fundo atual: {NEUTRALS[resolvedMode].background}.
          </p>
        </Section>

        {/* Tipografia */}
        <Section title="Tipografia" subtitle="Plus Jakarta Sans nos títulos, Inter no texto.">
          <Card>
            <CardContent className="space-y-2 pt-6">
              <p className="font-display text-4xl font-extrabold">Título grande</p>
              <p className="font-display text-2xl font-bold">Título de seção</p>
              <p className="text-lg">Texto de leitura confortável, com bom espaçamento entre linhas para sessões longas de estudo.</p>
              <p className="text-sm text-muted-foreground">Texto de apoio, legendas e dicas.</p>
            </CardContent>
          </Card>
        </Section>

        {/* Componentes */}
        <Section title="Componentes">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Botões e etiquetas</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button>Primário</Button>
                  <Button variant="secondary">Secundário</Button>
                  <Button variant="outline">Contorno</Button>
                  <Button variant="ghost">Discreto</Button>
                  <Button variant="destructive">Excluir</Button>
                  <Button loading>Salvando</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>Neutro</Badge><Badge variant="primary">Nova tarefa</Badge>
                  <Badge variant="success">Entregue</Badge><Badge variant="warning">Vence amanhã</Badge>
                  <Badge variant="destructive">Atrasada</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Formulário</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Field label="E-mail" type="email" placeholder="voce@escola.com" hint="Usamos para entrar e para sua turma te encontrar." />
                <Field label="Senha" type="password" defaultValue="abc" error="A senha precisa de ao menos 6 caracteres." />
                <Switch label="Lembretes de revisão" description="Avisa quando houver flashcards para revisar." checked={notify} onCheckedChange={setNotify} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Abas e diálogo</CardTitle></CardHeader>
              <CardContent>
                <Tabs defaultValue="resumo">
                  <TabsList aria-label="Seções da aula">
                    <TabsTrigger value="resumo">Resumo</TabsTrigger>
                    <TabsTrigger value="quiz">Quiz</TabsTrigger>
                    <TabsTrigger value="cards">Flashcards</TabsTrigger>
                  </TabsList>
                  <TabsContent value="resumo"><p className="text-muted-foreground">Navegável por teclado (setas) e leitores de tela.</p></TabsContent>
                  <TabsContent value="quiz"><p className="text-muted-foreground">Cinco tipos de pergunta, com reforço adaptativo.</p></TabsContent>
                  <TabsContent value="cards"><p className="text-muted-foreground">Deslize para a direita se lembrou.</p></TabsContent>
                </Tabs>
                <Button className="mt-4" variant="outline" onClick={() => setModalOpen(true)}>Abrir diálogo</Button>
                <Modal
                  open={modalOpen} onOpenChange={setModalOpen}
                  title="Excluir caderno?" description="Isso remove as aulas e o histórico deste caderno. Não dá para desfazer."
                  footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button><Button variant="destructive" onClick={() => setModalOpen(false)}>Excluir</Button></>}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Carregando e vazio</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-4/5" /></div>
                <EmptyState icon={<BookOpen className="h-6 w-6" />} title="Nenhum caderno ainda" description="Crie o primeiro caderno para organizar suas aulas." action={<Button size="sm">Criar caderno</Button>} />
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* Telas de exemplo */}
        <Section title="Como as telas ficam" subtitle="Exemplos de quiz, flashcard e painel do professor.">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="shadow-soft">
              <CardHeader>
                <div className="flex items-center justify-between"><Badge variant="primary">Múltipla escolha</Badge><span className="text-sm text-muted-foreground">3 de 8</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={3} aria-valuemin={0} aria-valuemax={8} aria-label="Progresso do quiz"><div className="h-full w-3/8 rounded-full bg-primary" style={{ width: '37.5%' }} /></div>
                <CardTitle className="pt-2 text-xl">Qual é a derivada de x²?</CardTitle>
              </CardHeader>
              <CardContent>
                <div role="radiogroup" aria-label="Alternativas" className="space-y-2">
                  {['x', '2x', 'x²', '2'].map((opt, i) => (
                    <button
                      key={opt} role="radio" aria-checked={picked === i} onClick={() => setPicked(i)}
                      className={cn(
                        'flex min-h-11 w-full items-center gap-3 rounded-xl border px-4 text-left font-medium transition-colors',
                        picked === i ? 'border-primary bg-accent text-accent-foreground' : 'border-border bg-card hover:bg-secondary'
                      )}
                    >
                      <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border text-xs', picked === i ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>{String.fromCharCode(65 + i)}</span>
                      {opt}
                    </button>
                  ))}
                </div>
                <Button className="mt-4" fullWidth disabled={picked === null}>Confirmar</Button>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader>
                <div className="flex items-center justify-between"><Badge>Flashcard</Badge><span className="text-sm text-muted-foreground">12 para revisar</span></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <button
                  onClick={() => setFlipped((f) => !f)}
                  aria-label={flipped ? 'Mostrar a pergunta' : 'Mostrar a resposta'}
                  className="flex min-h-48 w-full items-center justify-center rounded-2xl border border-border bg-accent p-6 text-center text-accent-foreground shadow-lifted transition-transform hover:-rotate-1"
                >
                  <span className="font-display text-xl font-bold">{flipped ? 'Taxa de variação instantânea de uma função.' : 'O que é uma derivada?'}</span>
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline"><X className="h-4 w-4" aria-hidden="true" /> Não lembrei</Button>
                  <Button><Check className="h-4 w-4" aria-hidden="true" /> Lembrei</Button>
                </div>
                <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> No app, deslize para os lados</p>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader><CardTitle className="text-xl">3º Ano A · Matemática</CardTitle><CardDescription>Média por aula</CardDescription></CardHeader>
              <CardContent>
                <div className="h-44" role="img" aria-label="Gráfico de barras: Derivadas 82, Integrais 64, Limites 91, Séries 58">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ left: -20, right: 4, top: 4 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <Bar dataKey="media" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 divide-y divide-border text-sm">
                  {[['Ana', 100, 'success'], ['Bruno', 75, 'warning'], ['Carla', 50, 'destructive']].map(([n, s, v]) => (
                    <li key={n as string} className="flex items-center justify-between py-2">
                      <span className="font-medium">{n}</span>
                      <Badge variant={v as 'success' | 'warning' | 'destructive'}>{s}%</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </Section>

        <footer className="border-t border-border pt-6 text-sm text-muted-foreground">
          Página de preview — existe só em desenvolvimento (<code>/design</code>). Nada disso foi aplicado ao app ainda.
        </footer>
      </main>
    </div>
  );
};

export default DesignPreview;
