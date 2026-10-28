// src/theme/palettes.ts
// Fonte única dos tokens de cor (também lida por scripts/check-contrast.ts).
// Mantenha este arquivo com sintaxe "apagável" (sem enums) para rodar direto no Node.
//
// Estrutura: neutros quentes ("cozy") fixos por modo + uma rampa de marca por paleta.
// O que é da marca (logo, tipografia, formas, neutros) não muda entre paletas.

export type PaletteId = 'indigo' | 'matcha' | 'terracota' | 'oceano' | 'lavanda' | 'grafite';
export type ResolvedMode = 'light' | 'dark';

export interface ModeTokens {
  primary: string;
  primaryFg: string;
  accent: string; // fundo suave (tinta) da paleta
  accentFg: string;
  charts: [string, string, string, string, string];
}

export interface Palette {
  id: PaletteId;
  name: string;
  description: string;
  light: ModeTokens;
  dark: ModeTokens;
}

export interface Neutrals {
  background: string;
  foreground: string;
  card: string;
  secondary: string; // também usado como "muted"
  secondaryFg: string;
  mutedFg: string;
  border: string;
  destructive: string;
  destructiveFg: string;
  success: string;
  warning: string;
  shadow: string;
}

export const NEUTRALS: Record<ResolvedMode, Neutrals> = {
  light: {
    background: '#FBF8F3',
    foreground: '#231F1B',
    card: '#FFFFFF',
    secondary: '#F3EEE6',
    secondaryFg: '#3A332D',
    mutedFg: '#6B6259',
    border: '#E6DED2',
    destructive: '#C2362B',
    destructiveFg: '#FFFFFF',
    success: '#26704A',
    warning: '#9A4A06',
    shadow: '#3A2A1A',
  },
  dark: {
    background: '#171412',
    foreground: '#F4EFE8',
    card: '#211D1A',
    secondary: '#2B2622',
    secondaryFg: '#E7E1D8',
    mutedFg: '#A89F94',
    border: '#3A332D',
    destructive: '#F2766B',
    destructiveFg: '#2A0A07',
    success: '#6FD39A',
    warning: '#F5B14C',
    shadow: '#000000',
  },
};

export const PALETTES: Palette[] = [
  {
    id: 'indigo',
    name: 'Índigo',
    description: 'A cor da marca: foco e clareza.',
    light: { primary: '#4F46E5', primaryFg: '#FFFFFF', accent: '#ECEBFD', accentFg: '#3730A3', charts: ['#4F46E5', '#0E8F7E', '#D97706', '#DB2777', '#2563EB'] },
    dark: { primary: '#8B8CF8', primaryFg: '#15123A', accent: '#26244A', accentFg: '#C7C8FD', charts: ['#8B8CF8', '#4DC7BD', '#F5B14C', '#F472B6', '#60A5FA'] },
  },
  {
    id: 'matcha',
    name: 'Matcha',
    description: 'Verde calmo, como uma tarde de estudo.',
    light: { primary: '#2F6F4E', primaryFg: '#FFFFFF', accent: '#E4F1E8', accentFg: '#1F5538', charts: ['#2F6F4E', '#B45309', '#2563EB', '#9333EA', '#0F766E'] },
    dark: { primary: '#7BC99B', primaryFg: '#0E2A1A', accent: '#1E3328', accentFg: '#BFE6CF', charts: ['#7BC99B', '#F5B14C', '#60A5FA', '#C4A1FA', '#4DC7BD'] },
  },
  {
    id: 'terracota',
    name: 'Terracota',
    description: 'Tons de argila, aconchegante e quente.',
    light: { primary: '#B5472B', primaryFg: '#FFFFFF', accent: '#F8E6DF', accentFg: '#8A3420', charts: ['#B5472B', '#0F766E', '#B45309', '#4F46E5', '#BE185D'] },
    dark: { primary: '#F08A6B', primaryFg: '#3A140A', accent: '#3B231C', accentFg: '#F7C9BA', charts: ['#F08A6B', '#4DC7BD', '#F5B14C', '#8B8CF8', '#F472B6'] },
  },
  {
    id: 'oceano',
    name: 'Oceano',
    description: 'Azul-petróleo, fresco e concentrado.',
    light: { primary: '#0F766E', primaryFg: '#FFFFFF', accent: '#DDF2F0', accentFg: '#0B5A54', charts: ['#0F766E', '#4F46E5', '#B45309', '#BE185D', '#2563EB'] },
    dark: { primary: '#4DC7BD', primaryFg: '#072B28', accent: '#14302E', accentFg: '#A9E8E2', charts: ['#4DC7BD', '#8B8CF8', '#F5B14C', '#F472B6', '#60A5FA'] },
  },
  {
    id: 'lavanda',
    name: 'Lavanda',
    description: 'Violeta suave e criativo.',
    light: { primary: '#7C3AED', primaryFg: '#FFFFFF', accent: '#F0E8FD', accentFg: '#5B21B6', charts: ['#7C3AED', '#0F766E', '#D97706', '#DB2777', '#2563EB'] },
    dark: { primary: '#B197FC', primaryFg: '#1F1240', accent: '#2C2147', accentFg: '#D9CCFD', charts: ['#B197FC', '#4DC7BD', '#F5B14C', '#F472B6', '#60A5FA'] },
  },
  {
    id: 'grafite',
    name: 'Grafite',
    description: 'Neutro e minimalista, sem distração.',
    light: { primary: '#3D3A36', primaryFg: '#FFFFFF', accent: '#ECE7DF', accentFg: '#2B2825', charts: ['#3D3A36', '#B45309', '#0F766E', '#4F46E5', '#BE185D'] },
    dark: { primary: '#E7E1D8', primaryFg: '#1C1917', accent: '#2F2A26', accentFg: '#E7E1D8', charts: ['#E7E1D8', '#F5B14C', '#4DC7BD', '#8B8CF8', '#F472B6'] },
  },
];

export const DEFAULT_PALETTE: PaletteId = 'indigo';

export function isPaletteId(value: unknown): value is PaletteId {
  return PALETTES.some((p) => p.id === value);
}

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
