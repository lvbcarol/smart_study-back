// Garante que as paletas do app mobile são idênticas às do web (frontend/src/theme/palettes.ts).
// Se mudar uma, copie para a outra e rode `npm run check:contrast` no frontend.
import { readFileSync } from 'node:fs';

const norm = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n').trim();
const web = norm('../../frontend/src/theme/palettes.ts');
const mobile = norm('../src/theme/palettes.ts');

if (web !== mobile) {
  console.error('✗ mobile/src/theme/palettes.ts diverge de frontend/src/theme/palettes.ts');
  process.exit(1);
}
console.log('✓ paletas do mobile idênticas às do web');
