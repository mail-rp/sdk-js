// Finitions du build :
// - dist/cjs/package.json fait lire les .js de ce dossier comme du CommonJS
// - tsc rewrites the ".ts" imports of the .js files but not those of the .d.ts files: they are switched to ".js" for the projects
//   TypeScript that do not accept .ts extensions in declarations
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;

writeFileSync(join(dist, 'cjs/package.json'), JSON.stringify({ type: 'commonjs' }, null, 4) + '\n');

for (const entry of readdirSync(dist, { recursive: true })) {
    const file = join(dist, String(entry));
    if (!file.endsWith('.d.ts')) continue;
    const content = readFileSync(file, 'utf8');
    const rewritten = content.replace(/(from\s+['"]\.{1,2}\/[^'"]+)\.ts(['"])/g, '$1.js$2');
    if (rewritten !== content) writeFileSync(file, rewritten);
}
