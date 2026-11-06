// About-the-guide affiliations. Keep one canonical link catalog for the
// About page and footer. URLs are supplied by the association.
export const organizations = [
  {
    id: 'nlica',
    name: '社團法人花蓮縣牛犁社區交流協會',
    shortName: '牛犁協會',
    links: [
      { type: '網站', label: '協會網站', href: 'https://www.nlica.org/' },
      { type: 'Facebook', label: '牛犁協會 Facebook', href: 'https://www.facebook.com/e7968' },
      { type: 'Instagram', label: '牛犁協會 Instagram', href: 'https://www.instagram.com/e7968e7968/' }
    ]
  },
  {
    id: 'mountcounty',
    name: '山下線',
    shortName: '山下線',
    links: [
      { type: '網站', label: '山下線網站', href: 'https://mountcounty.com/' },
      { type: 'Facebook', label: '山下線 Facebook', href: 'https://www.facebook.com/mountcounty' },
      { type: 'Instagram', label: '山下線 Instagram', href: 'https://www.instagram.com/mountcounty/' }
    ]
  }
] as const;
