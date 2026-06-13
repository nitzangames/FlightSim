import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

// Guards against dead code shipping to players. The deploy zips the whole
// game directory minus .zipignore (which only knows about dev files), so an
// unreferenced lib/ module sails into the player bundle unnoticed — exactly
// how jet-exhaust.js shipped for months after FlameCone replaced it.
//
// This walks the real import graph from the single entry point (shell/main.js)
// and asserts every shipped .js module is actually reachable. Add a new module
// → import it, or this fails. Genuinely-standalone files (e.g. the web worker,
// loaded by URL not import) must be listed in ENTRY_POINTS below.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Files that are real entry points but reached by URL/string, not by a static
// `import` the graph walk can see. The chunk worker is spawned via
// `new Worker(new URL('./chunk-worker.js', ...))`.
const ENTRY_POINTS = ['shell/main.js', 'lib/terrain/chunk-worker.js'];

// Directories whose .js files are shipped to players (mirror .zipignore: tests,
// tools, node_modules etc. are excluded from the deploy and from this check).
const SHIPPED_DIRS = ['shell', 'lib'];

// Matches static `import ... from '...'`, side-effect `import '...'`, and
// dynamic `import('...')`. Only relative specifiers (./ or ../) resolve to
// local files; bare specifiers (three, the CDN play-sdk) are external.
const IMPORT_RE = /import\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function listJsFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) out.push(...listJsFiles(full));
    else if (name.endsWith('.js')) out.push(full);
  }
  return out;
}

function importsFrom(file) {
  const src = readFileSync(file, 'utf8');
  const here = dirname(file);
  const specs = [];
  let m;
  while ((m = IMPORT_RE.exec(src)) !== null) {
    const spec = m[1] || m[2];
    if (spec && (spec.startsWith('./') || spec.startsWith('../'))) {
      specs.push(resolve(here, spec));
    }
  }
  return specs;
}

function reachableFrom(entries) {
  const seen = new Set();
  const stack = entries.map((e) => resolve(ROOT, e));
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const dep of importsFrom(file)) {
      if (!seen.has(dep)) stack.push(dep);
    }
  }
  return seen;
}

describe('no orphan modules', () => {
  it('every shipped .js is reachable from an entry point', () => {
    const reachable = reachableFrom(ENTRY_POINTS);
    const shipped = SHIPPED_DIRS.flatMap((d) => listJsFiles(resolve(ROOT, d)));
    const orphans = shipped
      .filter((f) => !reachable.has(f))
      .map((f) => relative(ROOT, f))
      .sort();
    expect(orphans, `Unreferenced modules will ship to players as dead code. ` +
      `Import them, delete them, or (if loaded by URL) add to ENTRY_POINTS:\n  ${orphans.join('\n  ')}`)
      .toEqual([]);
  });
});
