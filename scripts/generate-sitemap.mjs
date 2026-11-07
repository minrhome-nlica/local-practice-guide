// Build canonical URLs only. Article lastmod comes from its editorial metadata,
// never from deployment time (otherwise every rebuild would fake an update).
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = 'dist';
const hosted = process.env.GUIDE_CUSTOM_DOMAIN === 'true';
const domain = hosted ? 'https://guide.mountcounty.com' : 'https://minrhome-nlica.github.io';
const prefix = hosted ? '' : '/local-practice-guide';
const excluded = new Set(['/admin/feedback/', '/search/', '/downloads/', '/tools/']);
const discovered = [];

const escapeXML = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

async function lastModified(route) {
  const match = /^\/entries\/([a-z0-9][a-z0-9-]{0,100})\/$/.exec(route);
  if (!match) return '';
  try {
    const md = await readFile(join('src', 'content', 'entries', match[1] + '.md'), 'utf8');
    // Limit the lookup to YAML frontmatter to avoid mistaking body dates for edits.
    const header = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md)?.[1] || '';
    const value = /^updated:\s*["']?(\d{4}-\d{2}-\d{2})/m.exec(header)?.[1] || '';
    if (!value || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
      return '';
    }
    return value;
  } catch {
    return '';
  }
}

async function visit(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, item.name);
    if (item.isDirectory()) {
      await visit(file);
    } else if (item.isFile() && item.name === 'index.html') {
      const segment = relative(root, directory).replaceAll('\\', '/');
      const route = segment ? '/' + segment + '/' : '/';
      if (excluded.has(route)) continue;
      const html = await readFile(file, 'utf8');
      if (/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*\bnoindex\b/i.test(html)) {
        continue;
      }
      discovered.push({ route, lastmod: await lastModified(route) });
    }
  }
}

await visit(root);
discovered.sort((a, b) => a.route === '/' ? -1 : b.route === '/' ? 1 : a.route.localeCompare(b.route));

const urls = discovered.map(({ route, lastmod }) => {
  const loc = '    <loc>' + escapeXML(domain + prefix + route) + '</loc>';
  return '  <url>\n' + loc +
    (lastmod ? '\n    <lastmod>' + lastmod + '</lastmod>' : '') +
    '\n  </url>';
});
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.join('\n') + '\n</urlset>\n';
await writeFile(join(root, 'sitemap.xml'), xml);

// Search pages must remain crawlable to expose their noindex meta tag;
// do not add a robots.txt Disallow for /search/.
const robots = 'User-agent: *\nDisallow: ' + prefix +
  '/admin/\nSitemap: ' + domain + prefix + '/sitemap.xml\n';
await writeFile(join(root, 'robots.txt'), robots);
console.log('Public sitemap and robots.txt: ' + discovered.length +
  ' canonical URLs, ' + discovered.filter(x => x.lastmod).length + ' verified article update dates.');
