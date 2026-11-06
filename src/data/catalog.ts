export const categories = [
  { slug: 'basics', number: '01', name: '認識地方實踐', english: 'THE FOUNDATIONS', description: '從社區營造到地方創生，理解工作的起點與目的。' },
  { slug: 'organizations', number: '02', name: '組織成立與經營', english: 'RUNNING AN ORGANIZATION', description: '成立團隊、組織運作、行政制度與知識傳承。' },
  { slug: 'plans', number: '03', name: '計畫與資源', english: 'PROJECTS & RESOURCES', description: '尋找補助與標案、計畫撰寫、執行及成果報告。' },
  { slug: 'finance', number: '04', name: '經費與財務', english: 'FINANCE & ACCOUNTING', description: '經費編列、自籌款、核銷及各種會計憑證。' },
  { slug: 'people', number: '05', name: '人事與法律', english: 'PEOPLE & LEGAL', description: '聘僱、勞健保、補充保費與法律實務。' },
  { slug: 'tools', number: '06', name: '工作工具與技能', english: 'TOOLS & SKILLS', description: '計算機、可下載的實務文件、表格與工作範本，協助處理日常工作。' }
];
export const categoryName = (slug: string) =>
  categories.find((item) => item.slug === slug)?.name ?? '未分類';

// Maintain an editorial reading sequence for subjects that build on one another.
// Other entries remain alphabetically ordered by their Traditional Chinese titles.
const categoryFeaturedOrder: Record<string, string[]> = {
  organizations: ['legal-person-natural-person', 'which-status-saves-tax', 'why-establish-business-studio', 'why-establish-company', 'why-establish-limited-cooperative', 'why-establish-legal-person', 'income-withholding', 'business-income-tax'],
  finance: ['budget-planning', 'reimbursement', 'income-withholding', 'business-income-tax', 'comprehensive-income-tax'],
  people: ['labor-health-insurance', 'supplemental-premium', 'comprehensive-income-tax']
};

// Some practical guides are discoverable from two categories while remaining a
// single canonical article, so future corrections never diverge across copies.
const categoryCrossListings: Record<string, string[]> = {
  finance: ['income-withholding', 'business-income-tax'],
  people: ['comprehensive-income-tax']
};
export const entriesInCategory = <T extends { id: string; data: { category: string } }>(items: T[], slug: string): T[] =>
  items.filter((item) => item.data.category === slug || (categoryCrossListings[slug] ?? []).includes(item.id));
export const otherCategoriesForEntry = (entryId: string, primaryCategory: string) =>
  categories.filter((cat) => cat.slug !== primaryCategory && (categoryCrossListings[cat.slug] ?? []).includes(entryId));
export const sortEntriesForCategory = <T extends { id: string; data: { title: string } }>(items: T[], categorySlug: string): T[] => {
  const order = categoryFeaturedOrder[categorySlug] ?? [];
  const rank = (id: string) => {
    const index = order.indexOf(id);
    return index < 0 ? Number.POSITIVE_INFINITY : index;
  };
  return [...items].sort((a, b) => rank(a.id) - rank(b.id) || a.data.title.localeCompare(b.data.title, 'zh-Hant'));
};
export const learningPaths = [
  { number: '01', title: '第一次開始地方實踐', desc: '從地方、社區營造與地方創生出發，再了解資源和補助。', slugs: ['local-practice', 'community-building', 'local-revitalization', 'what-is-subsidy', 'subsidy-guide'] },
  { number: '02', title: '第一次執行政府計畫', desc: '從閱讀規定、規劃經費，到完成核銷。', slugs: ['subsidy-guide', 'tender', 'proposal-writing', 'budget-planning', 'results-report-writing', 'reimbursement'] },
  { number: '03', title: '開始整理組織的工作制度', desc: '先選擇經營身分與組織形式，再建立聘人、所得給付與財務管理制度。', slugs: ['legal-person-natural-person', 'which-status-saves-tax', 'why-establish-business-studio', 'why-establish-company', 'why-establish-limited-cooperative', 'why-establish-legal-person', 'labor-health-insurance', 'income-withholding', 'supplemental-premium', 'business-income-tax', 'comprehensive-income-tax'] }
];