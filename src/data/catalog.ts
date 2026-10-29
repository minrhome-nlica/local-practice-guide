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
export const learningPaths = [
  { number: '01', title: '第一次開始地方實踐', desc: '先理解地方工作的目的，再學習尋找資源。', slugs: ['local-practice', 'community-building', 'local-revitalization', 'what-is-subsidy', 'subsidy-guide', 'proposal-writing'] },
  { number: '02', title: '第一次執行政府計畫', desc: '從閱讀規定、規劃經費，到完成核銷。', slugs: ['subsidy-guide', 'tender', 'proposal-writing', 'budget-planning', 'reimbursement'] },
  { number: '03', title: '開始整理組織的工作制度', desc: '從聘人與行政實務著手，建立可持續的工作方法。', slugs: ['supplemental-premium', 'reimbursement', 'proposal-writing'] }
];