/**
 * Build-time conversion for the site's original GitHub Pages project base.
 * Source Markdown/raw HTML may keep /local-practice-guide/ links until editors
 * choose to migrate them; this ensures the published custom-domain root works.
 * In default mode this is a deliberate no-op.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

if (process.env.GUIDE_CUSTOM_DOMAIN !== 'true') {
  console.log('Domain adapter: GitHub Pages project path (no changes).');
} else {
  const root = 'dist';
  const extensions = new Set(['.html', '.css', '.js', '.json', '.xml', '.txt', '.svg']);
  let touched = 0;
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(file);
      } else if (entry.isFile() && extensions.has(extname(file))) {
        const source = await readFile(file, 'utf8');
        if (!source.includes('/local-practice-guide/')) continue;
        await writeFile(file, source.replaceAll('/local-practice-guide/', '/'));
        touched++;
      }
    }
  }
  await walk(root);
  console.log('Domain adapter: rewrote legacy links in ' + touched + ' generated files.');
}
