// Garante que as paletas do app mobile são idênticas às do web (frontend/src/theme/palettes.ts).
// Se mudar uma, copie para a outra e rode `npm run check:contrast` no frontend.
import { readFileSync } from 'node:fs';

const norm = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n').trim();

// arquivos que precisam ser idênticos nos dois apps
const SHARED = [
  ['frontend/src/theme/palettes.ts', 'mobile/src/theme/palettes.ts'],
  ['frontend/src/components/mascot/shapes.ts', 'mobile/src/components/mascot/shapes.ts'],
];

let ok = true;
for (const [web, mobile] of SHARED) {
  if (norm(`../../${web}`) !== norm(`../../${mobile}`)) {
    console.error(`✗ ${mobile} diverge de ${web}`);
    ok = false;
  }
}
if (!ok) process.exit(1);
console.log('✓ paletas e mascote do mobile idênticos aos do web');
