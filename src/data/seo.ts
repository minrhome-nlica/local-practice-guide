/**
 * Search-result metadata for the guide's editorial articles.
 * This does not change the on-page article titles or Markdown contents.
 * Keep every description faithful to the corresponding article.
 */
export const articleSearchMetadata: Record<string, {title: string; description: string}> = {
  'budget-planning': {
    title: '經費編列指南：經常門、資本門、勻支與流用怎麼分？',
    description: '政府補助計畫的經費怎麼編？整理講師費、人事費、材料費、經常門與資本門，並以實例說明勻支、流用和經費表的編列方式。'
  },
  'business-income-tax': {
    title: '營業稅與營所稅差在哪？個人、商號、公司稅務比較',
    description: '以設計委託比較個人、免用發票商號、使用發票商號及公司，說明營業稅、營所稅、統一發票、進銷項與不同身分的稅務差異。'
  },
  'community-building': {
    title: '社區營造是什麼？臺灣社造歷史、公民參與與地方自治',
    description: '從臺灣社區營造的歷史、日本造町經驗與民主化脈絡，認識居民參與公共事務、討論社區議題及地方自治的意義。'
  },
  'comprehensive-income-tax': {
    title: '綜合所得稅怎麼算？個人接案、費用與扣除額',
    description: '以個人設計師接案為例，區分收入、成本、所得與稅額，認識綜合所得稅級距、扣除額、扣繳稅款的退補及工作室所得。'
  },
  'income-withholding': {
    title: '預扣所得稅怎麼扣？9A、9B、50 的門檻與申報',
    description: '社區協會支付講師費、設計費與稿費時，如何區分9A、9B、50？整理2026年扣繳門檻、實領金額試算及付款單位申報。'
  },
  'labor-health-insurance': {
    title: '勞健保怎麼算？2026級距、雇主負擔與實領薪資',
    description: '以2026年勞健保級距及月薪34,000元為例，認識勞保、健保、勞退的員工自付與雇主負擔，以及月薪和實領薪資的差異。'
  },
  'legal-person-natural-person': {
    title: '法人與自然人差在哪？工作室、公司、協會責任比較',
    description: '個人接案、工作室、公司和協會有什麼法律差異？從自然人與法人的權利義務、獨立財產及債務責任，了解團體立案的意義。'
  },
  'local-practice': {
    title: '地方實踐是什麼？從地方感與空間理解在地行動',
    description: '地方與空間有什麼差別？從人文地理學與人的生活經驗出發，理解地方感、共同記憶及在地行動如何形成對地方的連結。'
  },
  'local-revitalization': {
    title: '地方創生是什麼？人口流失、產業發展與地方韌性',
    description: '從日本地方消滅議題、臺灣的少子化與高齡化，到產業轉型和村落生活機能，認識地方創生與地方韌性的發展脈絡。'
  },
  'proposal-writing': {
    title: '計畫書怎麼寫？問題分析、工作項目與成果指標',
    description: '地方工作計畫書如何從問題分析開始？整理計畫撰寫的脈絡、策略、工作項目與成果指標，讓評審看懂為什麼做、如何執行。'
  },
  'reimbursement': {
    title: '政府補助怎麼核銷？憑證、領據與成果報告整理',
    description: '政府補助案核銷怎麼做？從核定函、原始憑證、領款憑單、經費支出明細到黏貼憑證及活動成果佐證，逐步整理核銷文件。'
  },
  'results-report-writing': {
    title: '成果報告怎麼寫？量化績效、質性成果與結報附件',
    description: '計畫成果報告如何撰寫？整理核定計畫、進度、量化績效、質性成果、問題分析、經費結報及附件佐證，讓執行成果清楚可查。'
  },
  'subsidy-guide': {
    title: '政府補助案申請指南：資格、期程、經費與撥款',
    description: '申請政府補助前，先確認補助宗旨、申請資格、執行期程、撥款方式和經費規定，判斷補助案是否符合團隊的工作與需求。'
  },
  'supplemental-premium': {
    title: '二代健保補充保費怎麼算？2026代扣與單位負擔',
    description: '以社區講師費、表演費、稿費和工作費為例，說明二代健保補充保費的所得分類、個人代扣、投保單位負擔與2026年試算。'
  },
  'tender': {
    title: '政府標案怎麼投？履約標的、總包價法與投標文件',
    description: '政府標案的履約標的、總包價法、撥款程序和投標文件怎麼看？整理標案與補助的差異，協助評估履約能力與資金週轉。'
  },
  'what-is-subsidy': {
    title: '政府補助是什麼？補助與標案的差異及公共目的',
    description: '補助與政府標案有何不同？從公共目的、民間行動與政府資源的關係出發，認識補助制度及如何找到適合地方工作的資源。'
  },
  'which-status-saves-tax': {
    title: '個人、工作室、公司與合作社怎麼選？組織身分比較',
    description: '比較個人接案、商號、有限公司、合作社及人民團體的功能，從營業登記、資金、社員互助與公共事務思考適合的組織身分。'
  },
  'why-establish-business-studio': {
    title: '為什麼要成立工作室或商號？登記與接案稅務',
    description: '認識執行業務所得和營業性勞務的差異，以及商號與工作室的登記、請款、補充保費、稅務及對外合作時需要注意的事項。'
  },
  'why-establish-company': {
    title: '為什麼要成立公司？與工作室差異、責任及成本',
    description: '從公司與商號的法律身分、收入與債務責任，到依法需採公司形式的情形，整理成立公司的好處、限制及經營成本。'
  },
  'why-establish-legal-person': {
    title: '為什麼要成立法人？法律責任、集體代表與運作',
    description: '法人不只涉及有限責任，也能代表團隊簽約、協商與共同處理法律爭議。從地方工作案例認識法人好處及個人仍需負責的情況。'
  },
  'why-establish-limited-cooperative': {
    title: '為什麼成立有限責任合作社？社員交易與共同經營',
    description: '認識有限責任合作社的社員合作、交易與盈餘分配方式，並透過藝文工作者案例了解合作社如何共同承接工作及分攤成本。'
  }
};

export const homepageSearch = {
  title: '地方實踐指南｜補助申請、經費編列、核銷與地方創生',
  description: '由社團法人花蓮縣牛犁社區交流協會整理的實務指南，涵蓋地方創生、社區營造、政府補助、計畫撰寫、經費編列、核銷、勞健保、稅務與實用計算工具。'
};
