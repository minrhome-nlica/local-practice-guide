// V1.1 public index for search engines and social sharing.
// Generated from the static Astro pages after build and Pagefind indexing.
import {readdir,writeFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
const root = 'dist';
const hosted = process.env.GUIDE_CUSTOM_DOMAIN === 'true';
const domain = hosted ? 'https://guide.mountcounty.com' : 'https://minrhome-nlica.github.io';
const prefix = hosted ? '' : '/local-practice-guide';
const excluded = new Set(['/admin/feedback/','/search/','/downloads/','/tools/']);
const discovered = [];
async function visit(directory){
  for(const item of await readdir(directory,{withFileTypes:true})){
    const path=join(directory,item.name);
    if(item.isDirectory()) await visit(path);
    else if(item.isFile()&&item.name==='index.html'){
      const segment=relative(root,directory).replaceAll('\\','/');
      const route=segment?'/'+segment+'/':'/';
      if(!excluded.has(route))discovered.push(route);
    }
  }
}
await visit(root);
discovered.sort((a,b)=>a==='/'?-1:b==='/'?1:a.localeCompare(b));
const escapeXML=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const urls=discovered.map(route=>'  <url><loc>'+escapeXML(domain+prefix+route)+'</loc></url>');
const xml='<?xml version="1.0" encoding="UTF-8"?>\n'+
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+
  urls.join('\n')+'\n</urlset>\n';
await writeFile(join(root,'sitemap.xml'),xml);
const robots='User-agent: *\nDisallow: '+prefix+
  '/admin/\nDisallow: '+prefix+'/search/\nSitemap: '+domain+prefix+'/sitemap.xml\n';
await writeFile(join(root,'robots.txt'),robots);
console.log('Public sitemap and robots.txt: '+discovered.length+' canonical URLs');
