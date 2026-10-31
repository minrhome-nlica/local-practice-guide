export const categories = [
  { slug: 'basics', number: '01', name: '認識地方實踐', english: 'THE FOUNDATIONS', description: '從社區營造到地方創生，理解工作的起點與目的。' },
  { slug: 'organizations', number: '02', name: '組織成立與經營', english: 'RUNNING AN ORGANIZATION', description: '成立團隊、組織運作、行政制度與知識傳承。' },
  { slug: 'plans', number: '03', name: '計畫與資源', english: 'PROJECTS & RESOURCES', description: '尋找補助與標案、計畫撰寫、執行及成果報告。' },
  { slug: 'finance', number: '04', name: '經費與財務', english: 'FINANCE & ACCOUNTING', description: '經費編列、自籌款、核銷及各種會計憑證。' },
  { slug: 'people', number: '05', name: '人事與法律', english: 'PEOPLE & LEGAL', description: '聘僱、勞健保、補充保費與法律實務。' },
  { slug: 'tools', number: '06', name: '工作工具與技能', english: 'TOOLS & SKILLS', description: '公文、文書軟體、表格和實用文件範本。' }
];
export const categoryName = (slug: string) =>
  categories.find((item) => item.slug === slug)?.name ?? '未分類';

// Maintain an editorial reading sequence for subjects that build on one another.
// Other entries remain alphabetically ordered by their Traditional Chinese titles.
const categoryFeaturedOrder: Record<string, string[]> = {
  organizations: ['legal-person-natural-person', 'why-establish-legal-person'],
  people: ['labor-health-insurance', 'supplemental-premium']
};
export const sortEntriesForCategory = <T extends { id: string; data: { title: string } }>(items: T[], categorySlug: string): T[] => {
  const order = categoryFeaturedOrder[categorySlug] ?? [];
  const rank = (id: string) => {
    const index = order.indexOf(id);
    return index < 0 ? Number.POSITIVE_INFINITY : index;
  };
  return [...items].sort((a, b) => rank(a.id) - rank(b.id) || a.data.title.localeCompare(b.data.title, 'zh-Hant'));
};
export const learningPaths = [
  { number: '01', title: '第一次開始地方實踐', desc: '先理解地方工作的目的，再學習尋找資源。', slugs: ['local-practice', 'community-building', 'local-revitalization', 'what-is-subsidy', 'subsidy-guide', 'proposal-writing'] },
  { number: '02', title: '第一次執行政府計畫', desc: '從閱讀規定、規劃經費，到完成核銷。', slugs: ['subsidy-guide', 'tender', 'proposal-writing', 'budget-planning', 'results-report-writing', 'reimbursement'] },
  { number: '03', title: '開始整理組織的工作制度', desc: '先理解法律身分，再從聘人與行政實務建立可持續的工作方法。', slugs: ['legal-person-natural-person', 'why-establish-legal-person', 'labor-health-insurance', 'supplemental-premium', 'reimbursement', 'proposal-writing'] }
];