/** 供首頁隨機抽題與完整問題頁共同使用；不以陣列順序作為熱門排名。 */
export const commonQuestions = [
  { title: '第一次申請補助，我或我的團隊有資格嗎？', description: '申請身分、期程及計畫規定', id: 'subsidy-guide' },
  { title: '政府補助與政府標案有什麼差別？', description: '補助、履約及投標文件', id: 'tender' },
  { title: '計畫書要從哪裡開始寫？', description: '問題分析、策略及成果指標', id: 'proposal-writing' },
  { title: '講師費、人事費與自籌款怎麼編列？', description: '科目分類、單價及預算編列', id: 'budget-planning' },
  { title: '經費不足，可以勻支或流用嗎？', description: '核定經費調整與限制', id: 'budget-planning' },
  { title: '活動辦完，需要準備哪些核銷文件？', description: '發票、領據、簽到表與附件', id: 'reimbursement' },
  { title: '成果報告怎麼寫，才能看出成效？', description: '量化指標、質性成果及佐證', id: 'results-report-writing' },
  { title: '工作室、公司、合作社與協會怎麼選？', description: '不同組織功能與適用時機', id: 'which-status-saves-tax' },
  { title: '個人接案與成立商號，稅費差多少？', description: '接案情境與稅務差異', id: 'why-establish-business-studio' },
  { title: '設計費或講師費，需要預扣所得稅嗎？', description: '9A、9B、50 所得代碼與扣繳', id: 'income-withholding' },
  { title: '哪些收入會被扣二代健保補充保費？', description: '個人代扣與投保單位負擔', id: 'supplemental-premium' },
  { title: '聘請一名員工，實際人事成本有多少？', description: '勞健保、職災與勞退', id: 'labor-health-insurance' },
  { title: '協會立案後，就已經是社團法人嗎？', description: '立案與法人登記不同', id: 'legal-person-natural-person' },
  { title: '七名工作者一起接案，適合成立合作社嗎？', description: '社員互助、勞務與收益分配', id: 'why-establish-limited-cooperative' },
  { title: '社區營造與地方創生有什麼不同？', description: '理解地方工作的目標與脈絡', id: 'community-building' }
] as const;
