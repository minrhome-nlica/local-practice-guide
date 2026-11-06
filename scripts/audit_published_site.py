#!/usr/bin/env python3
"""V1.1 release preflight: inspect every generated page's local links and assets.

Usage: python3 scripts/audit_published_site.py
No third-party Python dependencies required.
"""
from __future__ import annotations

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlparse
import re
import sys

DIST = Path('dist')
SITE = 'https://guide.mountcounty.com/'
SKIP_SCHEMES = ('mailto:', 'tel:', 'javascript:', 'data:', 'blob:')
TARGETS = {'a': 'href', 'img': 'src', 'script': 'src', 'link': 'href', 'source': 'srcset'}
known = set()
problems = []
warnings = []
counts = Counter()


def target_path(url: str, owner: Path) -> Path | None:
    if not url or url.startswith(('#', *SKIP_SCHEMES)):
        return None
    url = url.strip()
    base = SITE + owner.relative_to(DIST).as_posix()
    resolved = urlparse(urljoin(base, url))
    if resolved.netloc and resolved.netloc.lower() != 'guide.mountcounty.com':
        return None
    decoded = unquote(resolved.path)
    if decoded.startswith('/local-practice-guide/'):
        problems.append(f'{owner}: legacy project-prefix link not rewritten: {url}')
        return None
    local = decoded.lstrip('/')
    if '..' in Path(local).parts:
        problems.append(f'{owner}: unsafe internal path {url}')
        return None
    if not local or decoded.endswith('/'):
        return DIST / local / 'index.html'
    file = DIST / local
    if file.suffix == '':
        return file / 'index.html' if not (DIST / (local + '.html')).exists() else DIST / (local + '.html')
    return file


class DocParser(HTMLParser):
    def __init__(self, owner: Path):
        super().__init__(convert_charrefs=True)
        self.owner = owner
        self.has_title = False
        self.has_description = False
        self.noindex = False
        self.images = 0
        self.html_lang = None
        self._title_active = False
        self._title_text = ''

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == 'html':
            self.html_lang = d.get('lang')
        if tag == 'title':
            self._title_active = True
        if tag == 'meta' and d.get('name', '').lower() == 'description' and d.get('content', '').strip():
            self.has_description = True
        if tag == 'meta' and d.get('name', '').lower() == 'robots' and 'noindex' in d.get('content', '').lower():
            self.noindex = True
        if tag == 'img':
            self.images += 1
            if not d.get('alt'):
                warnings.append(f'{self.owner}: image has no meaningful alt text')
        if tag not in TARGETS:
            return
        attr = TARGETS[tag]
        raw = d.get(attr, '')
        if not raw:
            return
        values = raw.split(',') if attr == 'srcset' else [raw]
        for value in values:
            ref = value.strip().split()[0] if value.strip() else ''
            target = target_path(ref, self.owner)
            if target is None:
                continue
            counts['local_references'] += 1
            key = (self.owner, target)
            if key in known:
                continue
            known.add(key)
            if not target.is_file():
                problems.append(f'{self.owner}: {tag}[{attr}] missing target {ref} -> {target}')

    def handle_data(self, data):
        if self._title_active:
            self._title_text += data

    def handle_endtag(self, tag):
        if tag == 'title':
            self._title_active = False


def main():
    if not DIST.exists():
        print('ERROR: dist/ not built; run npm run build first', file=sys.stderr)
        return 2
    pages = sorted(DIST.rglob('*.html'))
    if len(pages) < 30:
        problems.append(f'Too few generated pages ({len(pages)}): expected at least 30')
    for page in pages:
        p = DocParser(page)
        p.feed(page.read_text(encoding='utf-8', errors='replace'))
        counts['html_pages'] += 1
        counts['images'] += p.images
        if not p._title_text.strip():
            problems.append(f'{page}: missing page title')
        if not p.has_description:
            problems.append(f'{page}: missing meta description')
        if p.html_lang != 'zh-Hant':
            warnings.append(f'{page}: html lang not zh-Hant')
    image = DIST / 'images/about/nlica-team-2026.avif'
    fallback = DIST / 'images/about/nlica-team-2026.webp'
    if not image.exists() or not fallback.exists():
        problems.append('V1.1 team photo and fallback missing from generated assets')
    about = DIST / 'about/index.html'
    if not about.exists() or '社團法人花蓮縣牛犁社區交流協會2026' not in about.read_text(encoding='utf-8'):
        problems.append('V1.1 team photo caption not in About page')
    homepage = DIST / 'index.html'
    if not homepage.exists() or '地方實踐指南・V1.1' not in homepage.read_text(encoding='utf-8'):
        problems.append('V1.1 footer label missing from homepage')
    for doc in ['經費案例.xlsx', 'downloads/youth-workstation-proposal-114.pdf']:
        if not (DIST / doc).exists():
            problems.append(f'Download asset missing: {doc}')
    print(f'Inspected {counts["html_pages"]} pages, {counts["images"]} image tags, '
          f'{counts["local_references"]} local references, {len(known)} unique page/asset edges.')
    for warning in warnings[:30]:
        print('WARN:', warning)
    if len(warnings) > 30:
        print(f'... {len(warnings)-30} additional warnings')
    if problems:
        for problem in problems:
            print('ERROR:', problem)
        print(f'FAILED: {len(problems)} broken links or missing assets.')
        return 1
    print('PASS: all referenced local pages and assets exist, including V1.1 photo and footer.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
