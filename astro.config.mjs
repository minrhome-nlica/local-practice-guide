import { defineConfig } from 'astro/config';

// Keep the existing GitHub Pages URL active until the owner connects DNS.
// Set the repository Actions variable GUIDE_CUSTOM_DOMAIN=true when ready.
const customDomainReady = process.env.GUIDE_CUSTOM_DOMAIN === 'true';

export default defineConfig({
  site: customDomainReady ? 'https://guide.mountcounty.com' : 'https://minrhome-nlica.github.io',
  base: customDomainReady ? '/' : '/local-practice-guide',
  trailingSlash: 'always',
  output: 'static'
});
