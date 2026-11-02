/* 地方實踐指南｜經營身分比較機（前端純試算，不連線傳送資料）
   規則版本：115年度/2026。不可用本結果直接報稅或作為簽約身分決定。 */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const tool = $("tc-tool");
  if (!tool) return;

  const root = tool.dataset.base || "/local-practice-guide";
  const money = (value) => "NT$ " + Math.round(value).toLocaleString("zh-TW");
  const num = (value) => Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const abbr = (value) => Number.isFinite(value) ? money(value) : "待確認";
  const IDS = [
    { id: "individual", name: "個人接案", kind: "person" },
    { id: "sole-small", name: "商號｜免用發票", kind: "sole" },
    { id: "sole-invoice", name: "商號｜使用發票", kind: "sole" },
    { id: "company", name: "有限公司", kind: "company" },
    { id: "association", name: "社團法人", kind: "association" },
    { id: "coop", name: "合作社", kind: "cooperative" }
  ];
  const WORK = {
    design: ["設計、攝影、創作委託", "個人承接暫以9A執行業務所得為示範；是否適用，須依實際業務判斷。"],
    teaching: ["授課、講演、課程帶領", "可能涉及9B講演費或50薪資等類別，先保留待確認；進階設定可切換假設。"],
    event: ["活動執行、工作人力、其他勞務", "可能屬勞務委託或薪資，須確認契約與實際工作關係，不能只憑名稱認定。"],
    goods: ["販售商品、農產品或手作商品", "商品銷售可能涉及營業登記、營業稅及農民自產自銷例外，不能直接當作9A勞務。"],
    other: ["其他工作／還不確定", "所得類別尚未確認，暫不計算個人預扣與補充保費。"]
  };
  const STORIES = {
    individual: {
      responsible: "個人以自己的名義接案，原則上對相關契約與債務自行負責。",
      income: "工作收入與依法認列的必要成本、費用，可能計入個人全年綜合所得稅。付款時的扣繳只是預繳。",
      cost: "可能需要自備設備、負擔交通與委外費用；是否可列為業務必要成本，須依所得分類、憑證與規定確認。",
      legal: "必須確認交易是否真正屬個人執行業務；持續販售商品或提供營業性服務，可能需要辦理營業或稅籍登記。",
      article: "income-withholding"
    },
    "sole-small": {
      responsible: "此處假設為獨資商號，負責人仍可能以個人財產承擔營業債務，並非有限公司。",
      income: "免用統一發票不等於免營業稅。營業稅通常由國稅局按查定銷售額課徵1%；獨資商號的營利所得仍併入負責人綜所稅。",
      cost: "登記、帳務及行政維護需要成本；1%不是逐筆收據的扣款，也不能保證所有營業人都能免開發票。",
      legal: "免用發票與否取決於國稅局依規模、業別、營業性質核定，不能自己選擇是否開立。",
      article: "business-income-tax"
    },
    "sole-invoice": {
      responsible: "此處同樣假設為獨資商號。即使使用統一發票，也不因此取得有限公司的有限責任。",
      income: "一般應稅交易開立5%發票，銷項稅額減去合法可扣抵進項，才是可能實繳的營業稅。獨資商號營利所得歸入負責人綜所稅。",
      cost: "需要處理統一發票、營業稅申報及帳務等維護成本，實際額度因規模不同而變化。",
      legal: "開立發票必須符合營業登記與稅籍規定；若交易免稅、零稅率或非一般應稅情況，不能直接套用5%。",
      article: "business-income-tax"
    },
    company: {
      responsible: "公司原則上具有獨立法人格與有限責任，但保證、違法或其他例外情形，仍可能造成個人責任。",
      income: "公司營收扣除可認列成本後，依課稅所得額計算營所稅。公司稅後盈餘仍屬公司，股東領薪資或分配股利時另有個人稅務。",
      cost: "除業務成本，還可能有設立、記帳、會計申報、勞健保與公司行政維護等費用。",
      legal: "公司收到的款項不能直接當作負責人的個人收入；分配與帳務都須依法辦理。",
      article: "why-establish-legal-person"
    },
    association: {
      responsible: "社團法人有獨立法人格，但須依宗旨、章程與治理制度執行業務。",
      income: "協會收入歸組織所有，不可把盈餘直接分配給會員。稅務是否免稅需依所得性質及符合的條件認定。",
      cost: "可能涉及會務、會計、會員大會、理監事運作及人事等費用，不能因為是非營利組織就假設沒有成本。",
      legal: "實際承接的業務要符合協會宗旨，營業稅與所得稅免稅條件需要另外確認。",
      article: "why-establish-legal-person"
    },
    coop: {
      responsible: "合作社以社員共同經營、自治治理為核心；不是把個人案件換個名字請款。",
      income: "合作社收入屬合作社。稅務和社員報酬、結餘處理須依合作社種類、交易及適用法令判斷，不能直接視為某位社員個人的錢。",
      cost: "需考慮社員治理、設立、帳務、共同管理與可能的人事費用。",
      legal: "是否符合組織設立、社員人數與業務性質等要求要先確認，結餘分配及限制依合作社法與章程辦理。",
      article: "legal-person-natural-person"
    }
  };
  const defaults = () => ({
    goal: null,
    work: "design",
    amount: 1000000,
    basis: "quote",
    owned: ["individual"],
    filter: "all",
    costPct: 30,
    code: "auto",
    otherIncome: null,
    companyAdmin: null,
    selectedDetail: null,
    hasResult: false,
    meetingOpinion: "",
    meetingNext: ""
  });
  let state = defaults();
  let scenarios = [];
  const readingLink = (slug) => root + "/entries/" + slug + "/";

  function positiveMoney(value) {
    const x = Number(value);
    return Number.isFinite(x) && x >= 1 && x <= 1000000000 ? Math.round(x) : null;
  }
  function optionalMoney(value) {
    if (String(value).trim() === "") return null;
    const x = Number(value);
    return Number.isFinite(x) && x >= 0 && x <= 1000000000 ? Math.round(x) : null;
  }
  function annualIndividualTax(taxableIncome) {
    const net = Math.max(0, taxableIncome - 101000 - 136000);
    const levels = [
      [610000, .05], [1380000, .12], [2770000, .20],
      [5190000, .30], [Infinity, .40]
    ];
    let tax = 0, lower = 0;
    for (const entry of levels) {
      const upper = entry[0], rate = entry[1];
      if (net <= lower) break;
      tax += (Math.min(net, upper) - lower) * rate;
      lower = upper;
    }
    return num(tax);
  }
  function annualCorporateTax(profit) {
    const p = Math.max(0, profit);
    if (p <= 120000) return 0;
    if (p <= 200000) return num((p - 120000) * .5);
    return num(p * .2);
  }
  function personCode() {
    if (state.code === "unknown") return null;
    if (state.code !== "auto") return state.code;
    return state.work === "design" ? "9A" : null;
  }
  function ageOfTrial() {
    return state.goal === "future" ? "全年收入情境" : "單筆案件情境";
  }
  function isOwned(id) {
    return state.owned.includes(id);
  }
  function scenario() {
    return {
      goal: state.goal, work: state.work, amount: state.amount,
      basis: state.basis, owned: [...state.owned], costPct: state.costPct,
      code: state.code, otherIncome: state.otherIncome,
      companyAdmin: state.companyAdmin
    };
  }
  function acceptScenario(raw) {
    if (!raw || !["future", "deal", "payer"].includes(raw.goal)) return false;
    const amount = positiveMoney(raw.amount);
    if (!amount || !WORK[raw.work] || !["quote", "budget"].includes(raw.basis)) return false;
    state.goal = raw.goal;
    state.work = raw.work;
    state.amount = amount;
    state.basis = raw.basis;
    state.owned = Array.isArray(raw.owned) ?
      IDS.map((item) => item.id).filter((id) => raw.owned.includes(id)) : ["individual"];
    state.costPct = Number.isFinite(Number(raw.costPct)) ? Math.max(0, Math.min(90, Number(raw.costPct))) : 30;
    state.code = ["auto", "9A", "9B", "50", "unknown"].includes(raw.code) ? raw.code : "auto";
    state.otherIncome = optionalMoney(raw.otherIncome === null || raw.otherIncome === undefined ? "" : raw.otherIncome);
    state.companyAdmin = optionalMoney(raw.companyAdmin === null || raw.companyAdmin === undefined ? "" : raw.companyAdmin);
    state.selectedDetail = null;
    state.filter = "all";
    state.hasResult = true;
    return true;
  }

  /* 單筆比較。若所得分類不明，不能虛構「實領金額」。 */
  function dealRows() {
    const amount = state.amount;
    const quoted = state.basis === "quote";
    const vatNet = quoted ? amount : num(amount / 1.05);
    const vat = quoted ? num(amount * .05) : amount - vatNet;
    const invoicePaid = quoted ? amount + vat : amount;
    const code = personCode();
    let withhold = null, nhi = null;
    if (code === "9A" || code === "9B") {
      withhold = amount >= 20010 ? num(amount * .10) : 0;
      nhi = amount >= 20000 ? num(amount * .0211) : 0;
    } else if (code === "50") {
      withhold = amount >= 90501 ? num(amount * .05) : 0;
      nhi = amount >= 29500 ? num(amount * .0211) : 0;
    }
    const transfer = withhold === null ? null : amount - withhold - nhi;
    const codeNotes = code === "9A" || code === "9B"
      ? "假設臺灣境內居住者、由依法扣繳的單位付款，適用 " + code + "；達門檻時預扣10%，並假設符合個人補充保費扣費條件。"
      : code === "50"
      ? "假設單次兼職薪資50；達門檻時預扣5%，並假設個人符合兼職薪資補充保費條件。付款方可能另負擔補充保費或雇主成本。"
      : "個人所得類別尚待確認，不能只憑工作名稱決定9A、9B或50，也不能直接推估實際匯款。";
    const person = {
      id:"individual", payer:money(amount), payerNote:code === "50" ? "至少此金額；單位額外費用待確認" : "未含可能的其他雇主費用",
      received:transfer===null ? "待確認" : money(transfer),
      receivedNote:transfer===null ? "需確認所得類別" : "假設扣繳及補充保費後，當下匯款",
      tax:withhold===null ? "預扣：待確認" : "預扣 " + money(withhold),
      taxNote:withhold===null ? "二代健保亦待確認" : "另假設個人補充保費 " + money(nhi),
      explain:codeNotes, calc:transfer===null ? "分類尚未確定，所以不計算當下實領。" :
      money(amount) + "－" + money(withhold) + "（預扣所得稅）－" + money(nhi) + "（補充保費）＝" + money(transfer) + "。預扣是預繳，非最終所得稅。"
    };
    const small = {
      id:"sole-small", payer:money(amount), payerNote:"交易假設免用統一發票",
      received:money(amount), receivedNote:"商號收取價款；尚未扣查定稅及成本",
      tax:"查定1%（待核定）", taxNote:"按核定銷售額，不是每筆乘1%",
      explain:"免用統一發票商號通常依國稅局查定課稅，實際是否適用由稽徵機關認定。這一筆收入不直接按個人9A預扣。",
      calc:"本案先顯示名目收款 " + money(amount) + "；尚無法由單筆價款計算查定營業稅與年度綜所稅。"
    };
    const inv = (id) => ({
      id, payer:money(invoicePaid), payerNote:quoted ? "未稅報價外加5%銷項稅" : "付款總額已含5%銷項稅",
      received:money(invoicePaid), receivedNote:"含銷項稅之收款；未稅營收 " + money(vatNet),
      tax:"銷項稅 " + money(vat), taxNote:"須扣除依法可扣抵進項才是可能實繳稅額",
      explain:"一般應稅、應使用發票的交易才套用5%；此處為銷項稅示意，尚未計算進項稅額與年度所得稅。",
      calc:(quoted ? "未稅報價 " + money(amount) + " ＋ " : "含稅預算 " + money(amount) + " 內含 ") +
        "5%銷項稅 " + money(vat) + "；未稅營收 " + money(vatNet) + "，含稅收款 " + money(invoicePaid) + "。"
    });
    const org = (id) => ({
      id, payer:state.basis==="budget" ? money(amount) + " 以內" : "待確認",
      payerNote:state.basis==="budget" ? "須再確認這筆交易是否另含稅費" : "依交易性質與發票／收據而定",
      received:"待確認", receivedNote:"組織收入，不是個人可自由領取金額",
      tax:"適用資格／稅制待確認", taxNote:"不得把非營利或合作社視為當然免稅",
      explain:"社團法人或合作社承接該業務，需要符合宗旨、章程與實際交易條件。不能僅憑金額判定免稅。",
      calc:"須先確定承接資格、是否屬應稅交易，以及是否依法開立發票，才能確認總收款與稅費。"
    });
    return [person,small,inv("sole-invoice"),inv("company"),org("association"),org("coop")];
  }

  /* 年度情境：讓讀者看出制度差異。實際成本、所得分類、所有稅務調整都需要另行確認。 */
  function annualRows() {
    const revenue = state.amount, costs = num(revenue*state.costPct/100);
    const profit = Math.max(0,revenue-costs);
    const other = state.otherIncome===null ? 0 : state.otherIncome;
    const personalTax = annualIndividualTax(profit+other) - annualIndividualTax(other);
    const companyAdmin = state.companyAdmin;
    const compProfit = Math.max(0,profit-(companyAdmin===null?0:companyAdmin));
    const compTax = annualCorporateTax(compProfit);
    const personalCanModel = personCode()==="9A";
    const person = {
      id:"individual", payer:personalCanModel?money(personalTax):"待確認",
      payerNote:personalCanModel?"綜所稅示範：假設單身、已扣成本":"所得分類、扣除方式仍需確認",
      received:personalCanModel?money(Math.max(0,profit-personalTax)):"待確認",
      receivedNote:personalCanModel?"個人假設稅後結餘；未含健保等":"仍須確認所得類別及成本認列",
      tax:personalCanModel?"綜所稅增額 " + money(personalTax):"綜所稅待確認",
      taxNote:personalCanModel?"按2026年度級距；不含預扣抵繳及補充保費":"非所有工作都適用9A必要費用估計",
      explain:personalCanModel?"假設符合個人9A所得情境，以估計成本減除收入，並按2026年個人綜所稅級距試算。只算本項所得造成的稅額變化。":"此工作未確認為9A；薪資、講演稿費與商品交易會有不同所得計算規則。",
      calc:personalCanModel?"示範所得：" + money(revenue) + "－估計成本 " + money(costs) + "＝" + money(profit) + "；全年新增綜所稅 " + money(personalTax) + "（其他非薪資所得假設 " + money(other) + "）。":"請先在進階設定確認適用的所得類別，才可能進一步推算全年綜所稅。"
    };
    const service=state.work!=="goods";
    const smallThreshold=service?50000:100000;
    const avg=revenue/12;
    let smallVatText, smallVatDetail;
    if(avg>=200000){
      smallVatText="免發票資格待確認";
      smallVatDetail="平均每月已達一般使用發票門檻，通常不能假設適用免開發票查定稅。";
    }else if(avg<smallThreshold) {
      smallVatText="可能未達營業稅起徵點";
      smallVatDetail="平均每月 " + money(avg) + "；是否免課仍以國稅局認定及實際營業方式為準。";
    }else{
      smallVatText="查定1%示意 " + money(revenue*.01);
      smallVatDetail="以全年營收乘1%作概念示例，實際依法按稽徵機關查定銷售額課徵。";
    }
    const sole = (id) => ({
      id, payer:money(personalTax), payerNote:"獨資商號所得併入負責人綜所稅",
      received:money(Math.max(0,profit-personalTax)), receivedNote:"負責人示範稅後所得；尚未扣營業稅與行政費",
      tax:id==="sole-small"?smallVatText:"銷項5%（另計）",
      taxNote:id==="sole-small"?smallVatDetail:"一般應稅情境，實繳額須扣除可抵進項；未納入上方所得稅",
      explain:id==="sole-small"?"免用統一發票與否由國稅局核定；查定1%不是對每筆收據直接扣款。獨資商號所得併入負責人綜所稅。":"使用統一發票的獨資商號，須處理5%銷項稅及合法可抵進項；營利所得仍併入負責人綜所稅。",
      calc:"全年營收 " + money(revenue) + "－假設成本 " + money(costs) + "＝示範營利所得 " + money(profit) + "；所得併入負責人綜所稅，本例增加 " + money(personalTax) + "。營業稅及維護成本另計。"
    });
    const company={
      id:"company", payer:money(compTax), payerNote:"公司年度營所稅情境；股東個人稅未算",
      received:money(Math.max(0,compProfit-compTax)), receivedNote:"公司留存的示範金額，不是股東實領",
      tax:"一般銷項5%（另計）", taxNote:"所得稅與營業稅為不同稅；實繳營業稅尚未算",
      explain:"公司按全年課稅所得計算營所稅。公司收到的錢仍屬公司，股東如領薪資、股利，可能另有個人稅負。",
      calc:"營收 " + money(revenue) + "－假設工作成本 " + money(costs) +
        (companyAdmin===null?"（未提供年度行政費用）":"－公司行政費 " + money(companyAdmin)) +
        "＝示範公司課稅所得 " + money(compProfit) + "；營所稅 " + money(compTax) +
        "。不含實際營業稅、股利與股東所得稅。"
    };
    const org = (id) => ({
      id,payer:"待確認",payerNote:"法人所得稅／免稅適用條件各異",
      received:"待確認",receivedNote:"組織收入不可當作個人可支配所得",
      tax:"資格與交易性質待確認",taxNote:"不能只用營收和預設成本推定免稅",
      explain:"此類組織的所得免稅資格、收入性質、營業稅、社員或會員相關規定與一般公司不同。",
      calc:"本例營收 " + money(revenue) + "、假設工作成本 " + money(costs) + "。因欠缺組織與交易相關資料，不顯示推測性稅額或個人所得。"
    });
    return [person,sole("sole-small"),sole("sole-invoice"),company,org("association"),org("coop")];
  }

  function setGoal(goal, options) {
    if (!["future","deal","payer"].includes(goal)) return;
    const changed=state.goal!==goal;
    state.goal=goal;
    if(changed && !(options&&options.keepAmount)){
      state.amount=goal==="future"?1000000:100000;
      state.basis=goal==="payer"?"budget":"quote";
    }
    $("tc-goal-step").hidden=true;
    $("tc-setup").hidden=false;
    $("tc-results").hidden=true;
    $("tc-goal-label").textContent=goal==="future"?"經營方向｜簡易年度比較":goal==="payer"?"付款單位｜單筆支出比較":"接案者｜單筆請款比較";
    $("tc-form-title").textContent=goal==="future"?"只要填工作類型與預估年收入":"只要填工作類型與這筆金額";
    $("tc-form-intro").textContent=goal==="future"
      ?"先看相同全年營收下的制度差異；成本先使用清楚標示的示範假設。"
      :"先從一筆交易看六種身分的付款與收款差異；不確定的年度稅額會保留待確認。";
    $("tc-amount-label").textContent=goal==="future"?"03｜預估全年營業收入":"03｜這筆案件的金額";
    $("tc-amount-hint").textContent=goal==="future"
      ?"請填全年銷售或提供服務的收入總額；這不是淨利，也未包含其他組織的收入。"
      :goal==="payer"?"可以先輸入付款單位最多願意支出的金額。":"可以先輸入你要報的未稅價格，也能切換成對方固定預算。";
    $("tc-basis-box").hidden=goal==="future";
    $("tc-amount").value=String(state.amount);
    renderInputState();
    progress(2);
    if (!(options&&options.noScroll)) $("tc-setup").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function renderInputState() {
    $("tc-work").value=state.work;
    $("tc-work-hint").textContent=WORK[state.work][1];
    $("tc-amount").value=String(state.amount);
    document.querySelectorAll("[data-basis]").forEach((b)=>b.setAttribute("aria-pressed",String(b.dataset.basis===state.basis)));
    document.querySelectorAll("[data-owned]").forEach((el)=>{el.checked=isOwned(el.dataset.owned)});
    $("tc-cost-pct").value=String(state.costPct);
    $("tc-cost-value").textContent=state.costPct+"%";
    $("tc-income-code").value=state.code;
    $("tc-other-income").value=state.otherIncome===null?"":String(state.otherIncome);
    $("tc-company-admin").value=state.companyAdmin===null?"":String(state.companyAdmin);
  }
  function progress(step){
    [1,2,3,4].forEach((n)=>$("tc-step-"+n).classList.toggle("tc-current",n===step));
  }
  function resetToGoal() {
    $("tc-goal-step").hidden=false;
    $("tc-setup").hidden=true;
    $("tc-results").hidden=true;
    state.hasResult=false;
    document.querySelectorAll("[data-goal]").forEach((b)=>b.setAttribute("aria-pressed",String(b.dataset.goal===state.goal)));
    progress(1);
    $("tc-goal-step").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function formToState() {
    const amount=positiveMoney($("tc-amount").value);
    if(!amount){
      $("tc-validation").textContent="請輸入1元至10億元之間的有效金額。";
      $("tc-validation").hidden=false;
      $("tc-amount").focus();
      return false;
    }
    $("tc-validation").hidden=true;
    state.amount=amount;
    state.work=$("tc-work").value;
    state.owned=[...document.querySelectorAll("[data-owned]:checked")].map((e)=>e.dataset.owned);
    return true;
  }

  function renderRows(){
    const rows=state.goal==="future"?annualRows():dealRows();
    const filtered=rows.filter((r)=>state.filter==="all" || (state.filter==="current")===isOwned(r.id));
    const a=state.goal==="future"?"年度所得稅（示範）":"付款方總支出";
    const b=state.goal==="future"?"估算稅後結餘":"承接方入帳／匯款";
    const c=state.goal==="future"?"其他稅與限制":"稅費或憑證重點";
    $("tc-col-a").textContent=a;
    $("tc-col-b").textContent=b;
    $("tc-col-c").textContent=c;
    $("tc-results-body").replaceChildren();
    if(filtered.length===0){
      const tr=document.createElement("tr"),td=document.createElement("td");
      td.colSpan=5;
      td.textContent=state.filter==="current"?"尚未勾選任何已具備的身分；請返回上一步勾選，或切換「全部六種」。":"沒有符合條件的身分。";
      tr.appendChild(td);
      $("tc-results-body").appendChild(tr);
    }
    filtered.forEach((r)=>{
      const id=IDS.find((x)=>x.id===r.id);
      const tr=document.createElement("tr");
      if(state.selectedDetail===r.id) tr.className="tc-expanded";
      const th=document.createElement("th"); th.scope="row";
      th.textContent=id.name;
      const meta=document.createElement("span");meta.className="tc-meta";
      meta.appendChild(document.createTextNode(isOwned(r.id)?"目前具備":"未來假設"));
      th.appendChild(meta);tr.appendChild(th);
      const pair=(value,note,label,heavy)=>{
        const td=document.createElement("td"); td.dataset.label=label;
        const span=document.createElement("span");span.className=heavy?"tc-money":"tc-money tc-warn-value";
        span.textContent=value;td.appendChild(span);
        const p=document.createElement("span");p.className="tc-meta";p.textContent=note;td.appendChild(p);
        tr.appendChild(td);
      };
      pair(r.payer,r.payerNote,a,!r.payer.includes("待確認"));
      pair(r.received,r.receivedNote,b,!r.received.includes("待確認"));
      pair(r.tax,r.taxNote,c,false);
      const td=document.createElement("td");td.className="tc-row-action";
      const button=document.createElement("button");
      button.type="button";button.className="tc-detail-trigger";
      button.dataset.detail=r.id;
      button.setAttribute("aria-expanded",String(state.selectedDetail===r.id));
      button.textContent=state.selectedDetail===r.id?"收合說明 ↑":"查看原因 →";
      td.appendChild(button);tr.appendChild(td);
      $("tc-results-body").appendChild(tr);
    });
    renderDetail(rows);
  }
  function renderDetail(rows){
    const area=$("tc-detail-panel"),row=rows.find((r)=>r.id===state.selectedDetail);
    if(!row || (state.filter!=="all" && (state.filter==="current")!==isOwned(row.id))){
      area.hidden=true;area.replaceChildren();return;
    }
    const id=IDS.find((x)=>x.id===row.id),story=STORIES[row.id];
    area.replaceChildren();
    const title=document.createElement("h3"); title.textContent=id.name+"｜為什麼會得到這個結果？";area.appendChild(title);
    const intro=document.createElement("p");intro.className="tc-detail-subtitle";intro.textContent=isOwned(row.id)?"這是你已勾選具備的身分；實際是否能承接仍須看工作與法規條件。":"這是尚未具備的身分，顯示的是未來假設，不代表可以立即用來請款。";area.appendChild(intro);
    const math=document.createElement("p"); const strong=document.createElement("strong");
    strong.textContent="本次計算：";math.appendChild(strong);math.appendChild(document.createTextNode(row.calc));area.appendChild(math);
    const detail=document.createElement("p");detail.textContent=row.explain;area.appendChild(detail);
    const grid=document.createElement("div");grid.className="tc-detail-list";
    for(const [label,value] of [
      ["錢最後屬於誰？",story.income],
      ["工作成本與行政成本",story.cost],
      ["法律責任",story.responsible],
      ["能否使用此身分？",story.legal]
    ]){
      const col=document.createElement("div"),head=document.createElement("strong"),span=document.createElement("span");
      head.textContent=label;span.textContent=value;col.append(head,span);grid.appendChild(col);
    }
    area.appendChild(grid);
    const link=document.createElement("a");link.href=readingLink(story.article);link.textContent="閱讀相關知識詞條 →";area.appendChild(link);
    area.hidden=false;
  }
  function renderSummary(){
    const title=state.goal==="future"?"同一筆全年收入，六種經營身分如何不同？":
      state.goal==="payer"?"同一筆預算，付給不同身分有什麼差異？":"同一筆案子，用哪個身分請款有什麼差異？";
    $("tc-result-title").textContent=title;
    $("tc-table-title").textContent=state.goal==="future"?"六種身分｜年度經營試算":"六種身分｜單筆請款與付款比較";
    $("tc-metric-a-label").textContent=state.goal==="future"?"全年收入（未扣工作成本）":state.basis==="budget"?"付款方總預算":"這筆工作的未稅報價";
    $("tc-metric-a").textContent=money(state.amount);
    $("tc-metric-a-note").textContent=state.goal==="future"?"年度示範情境":state.basis==="budget"?"含可能的發票稅額":"使用發票者可能外加5%銷項稅";
    $("tc-metric-b").textContent=WORK[state.work][0];
    $("tc-metric-b-note").textContent=state.work==="design"?"個人9A為示範假設":"個人所得分類須另確認";
    const lead = state.goal==="future"?
      "以下用你提供的全年收入、目前估計的工作成本比例，比較個人、商號與公司；協會與合作社保留制度與稅務待確認。":
      state.goal==="payer"?
      "先比較付款方的總支出、承接對象的憑證與可能的扣繳義務。薪資型給付的單位額外成本可能需補充資料。":
      "先比較這筆工作當下的匯款、發票與預扣差異。要知道真正的全年稅額，還需要收入、成本及其他個人條件。";
    $("tc-result-lead").textContent=lead;
    $("tc-assumption-note").textContent=state.goal==="future"?
      "本次先假設工作成本占營收 "+state.costPct+"%（只是示例，不是法定費用率）、單身且未額外申報扶養或其他扣除。個人與獨資商號按可適用的情況示範2026年綜所稅；公司按全年獲利示範營所稅。未提供的行政費用、營業稅可扣抵進項、股利及個人補充保費均未計入。":
      "單筆交易以臺灣境內付款及收款為示範。設計委託暫假設符合9A（可在進階設定調整）；其他工作若性質不明則保留待確認。預扣所得稅只是預繳，不是最後稅負。";
    $("tc-result-disclaimer").textContent=state.goal==="future"?
      "重要：年度稅額是簡化情境示範，不包含所有所得來源與稅務調整；商號的營業稅、公司的進項扣抵與行政維護成本需另確認。公司顯示的是「公司留存」，不是股東個人實領；社團法人和合作社亦然。":
      "重要：「個人當下匯款」和「組織收到的含稅價款」不是可直接比較的最終所得。個人預扣稅款是預繳、發票銷項稅可依法扣抵進項，協會與合作社的組織收入也不屬於某個人的自由所得。";
  }
  function render(){
    if(!state.goal || !state.hasResult)return;
    renderSummary();
    renderRows();
    document.querySelectorAll("[data-filter]").forEach((b)=>b.setAttribute("aria-pressed",String(b.dataset.filter===state.filter)));
    $("tc-advanced-feedback").textContent="已套用工作成本 "+state.costPct+"% 的示範假設；"+(state.companyAdmin===null?"公司行政費用尚未提供，未計入。":"公司年度行政費已納入公司示範所得："+money(state.companyAdmin)+"。");
    $("tc-results").hidden=false;
  }
  function run(){
    if(!formToState())return;
    state.hasResult=true; state.selectedDetail=null;state.filter="all";
    $("tc-setup").hidden=true;render();progress(4);
    $("tc-results").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function feedback(value){$("tc-feedback").textContent=value;}
  function applyAdvanced(){
    const cost=Number($("tc-cost-pct").value);
    state.costPct=Number.isFinite(cost)?Math.max(0,Math.min(90,cost)):30;
    state.code=$("tc-income-code").value;
    state.otherIncome=optionalMoney($("tc-other-income").value);
    state.companyAdmin=optionalMoney($("tc-company-admin").value);
    $("tc-cost-value").textContent=state.costPct+"%";
    render();
  }
  function saveScenario(){
    if(!state.hasResult) return;
    if(scenarios.length>=6){feedback("最多先保留六組方案，請刪除不需要的方案後再加入。");return;}
    scenarios.push({title:"方案 "+String.fromCharCode(65+scenarios.length),data:scenario()});
    renderScenarios();feedback("已保留目前試算為方案 "+scenarios[scenarios.length-1].title+"。");
  }
  function renderScenarios(){
    const area=$("tc-scenario-list"); area.replaceChildren();
    if(!scenarios.length){const p=document.createElement("p");p.className="tc-small";p.textContent="目前還沒有保留任何方案。";area.appendChild(p);return}
    scenarios.forEach((entry,index)=>{
      const row=document.createElement("div");row.className="tc-scenario-row";
      const label=document.createElement("span");
      label.textContent=entry.title+"｜"+(entry.data.goal==="future"?"全年收入":"單筆金額")+" "+money(entry.data.amount)+"，工作成本假設 "+entry.data.costPct+"%";
      const actions=document.createElement("span");
      const apply=document.createElement("button");apply.type="button";apply.dataset.applyScenario=String(index);apply.textContent="套用";
      const del=document.createElement("button");del.type="button";del.dataset.deleteScenario=String(index);del.textContent="刪除";
      actions.append(apply,document.createTextNode("　"),del);
      row.append(label,actions);area.appendChild(row);
    });
  }
  function snapshot(){
    return {v:1,trial:scenario(),scenarios:scenarios,meetingOpinion:$("tc-meeting-opinion").value,meetingNext:$("tc-meeting-next").value};
  }
  function applySnapshot(data){
    if(!acceptScenario(data&&data.trial))return false;
    scenarios=Array.isArray(data.scenarios)?data.scenarios.filter((x)=>x && x.data && positiveMoney(x.data.amount)).slice(0,6):[];
    $("tc-meeting-opinion").value=typeof data.meetingOpinion==="string"?data.meetingOpinion.slice(0,6000):"";
    $("tc-meeting-next").value=typeof data.meetingNext==="string"?data.meetingNext.slice(0,6000):"";
    setGoal(state.goal,{keepAmount:true,noScroll:true});
    renderInputState();
    $("tc-setup").hidden=true;
    render();renderScenarios();progress(4);
    $("tc-results").scrollIntoView({behavior:"smooth",block:"start"});
    return true;
  }
  function buildShareUrl(){
    const url=new URL(window.location.href);url.search="";
    url.searchParams.set("goal",state.goal);
    url.searchParams.set("work",state.work);
    url.searchParams.set("amount",String(state.amount));
    url.searchParams.set("basis",state.basis);
    url.searchParams.set("cost",String(state.costPct));
    url.searchParams.set("code",state.code);
    url.searchParams.set("owned",state.owned.join(","));
    if(state.otherIncome!==null)url.searchParams.set("other",String(state.otherIncome));
    if(state.companyAdmin!==null)url.searchParams.set("admin",String(state.companyAdmin));
    return url.toString();
  }
  function loadUrl(){
    const qs=new URLSearchParams(window.location.search);
    if(!qs.has("goal"))return;
    const loaded=acceptScenario({
      goal:qs.get("goal"),work:qs.get("work"),amount:qs.get("amount"),
      basis:qs.get("basis")||"quote",owned:(qs.get("owned")||"individual").split(","),
      costPct:qs.get("cost")||30,code:qs.get("code")||"auto",
      otherIncome:qs.get("other"),companyAdmin:qs.get("admin")
    });
    if(loaded){
      setGoal(state.goal,{keepAmount:true,noScroll:true});
      renderInputState();$("tc-setup").hidden=true;render();progress(4);
      feedback("已載入分享情境；請留意這些數字是情境假設，不是正式稅額。");
    }
  }
  function makePrintNotes(){
    const target=$("tc-print-notes");target.replaceChildren();
    const h=document.createElement("h2");h.textContent="經營身分比較｜團隊討論報告";target.appendChild(h);
    const meta=document.createElement("p");
    meta.textContent="採2026（民國115）年度規則；"+ageOfTrial()+"，輸入 "+money(state.amount)+"，工作類型："+WORK[state.work][0]+"；示範成本 "+state.costPct+"%。僅供內部討論。";
    target.appendChild(meta);
    for(const id of IDS){
      const story=STORIES[id.id];
      const section=document.createElement("section");
      const sub=document.createElement("h3");sub.textContent=id.name+"｜稅務及經營限制";
      const one=document.createElement("p");one.textContent=story.income;
      const two=document.createElement("p");two.textContent=story.legal;
      section.append(sub,one,two);target.appendChild(section);
    }
    if(scenarios.length){
      const sh=document.createElement("h3");sh.textContent="討論中的其他方案";target.appendChild(sh);
      scenarios.forEach((entry)=>{
        const p=document.createElement("p");p.textContent=entry.title+"："+WORK[entry.data.work][0]+"，"+money(entry.data.amount)+"，估計成本 "+entry.data.costPct+"%。";
        target.appendChild(p);
      });
    }
    for(const [heading,val] of [["團隊意見與待確認事項",$("tc-meeting-opinion").value],["會議決定與後續行動",$("tc-meeting-next").value]]){
      const h3=document.createElement("h3");h3.textContent=heading;
      const p=document.createElement("p");p.textContent=val.trim()||"（尚未填寫）";p.style.whiteSpace="pre-wrap";target.append(h3,p);
    }
    const foot=document.createElement("p");
    foot.textContent="這份報告使用固定規則與情境假設產生，無法代替會計師、記帳士或主管機關認定，不可作為申報或核銷憑證。";
    target.appendChild(foot);target.classList.remove("tc-empty");
  }

  document.querySelectorAll("[data-goal]").forEach((b)=>b.addEventListener("click",()=>setGoal(b.dataset.goal)));
  $("tc-back-goal").addEventListener("click",resetToGoal);
  $("tc-work").addEventListener("change",(ev)=>{
    state.work=ev.target.value;
    $("tc-work-hint").textContent=WORK[state.work][1];
  });
  document.querySelectorAll("[data-basis]").forEach((b)=>b.addEventListener("click",()=>{
    state.basis=b.dataset.basis;
    renderInputState();
  }));
  $("tc-run").addEventListener("click",run);
  $("tc-amount").addEventListener("keydown",(ev)=>{if(ev.key==="Enter")run()});
  $("tc-edit").addEventListener("click",()=>{
    $("tc-results").hidden=true;$("tc-setup").hidden=false;
    renderInputState();progress(3);$("tc-setup").scrollIntoView({behavior:"smooth",block:"start"});
  });
  $("tc-results-body").addEventListener("click",(ev)=>{
    const button=ev.target.closest("[data-detail]");if(!button)return;
    const id=button.dataset.detail;
    state.selectedDetail=state.selectedDetail===id?null:id;
    renderRows();
    if(state.selectedDetail)$("tc-detail-panel").scrollIntoView({behavior:"smooth",block:"nearest"});
  });
  document.querySelectorAll("[data-filter]").forEach((b)=>b.addEventListener("click",()=>{
    state.filter=b.dataset.filter;render();
  }));
  ["tc-cost-pct","tc-income-code","tc-other-income","tc-company-admin"].forEach((id)=>{
    $(id).addEventListener(id==="tc-cost-pct"?"input":"change",applyAdvanced);
  });
  $("tc-owned-details").addEventListener("change",()=>{
    state.owned=[...document.querySelectorAll("[data-owned]:checked")].map((el)=>el.dataset.owned);
  });
  $("tc-save-scenario").addEventListener("click",saveScenario);
  $("tc-scenario-list").addEventListener("click",(ev)=>{
    const apply=ev.target.closest("[data-apply-scenario]");
    const del=ev.target.closest("[data-delete-scenario]");
    if(apply){
      const item=scenarios[Number(apply.dataset.applyScenario)];
      if(item&&acceptScenario(item.data)){
        setGoal(state.goal,{keepAmount:true,noScroll:true});renderInputState();
        $("tc-setup").hidden=true;render();progress(4);
        feedback("已套用 "+item.title+"，可以展開進階設定或修改金額。");
      }
    } else if(del){
      scenarios.splice(Number(del.dataset.deleteScenario),1);
      scenarios.forEach((entry,index)=>entry.title="方案 "+String.fromCharCode(65+index));
      renderScenarios();
    }
  });
  $("tc-print").addEventListener("click",()=>{
    if(!state.hasResult)return;
    state.filter="all";render();makePrintNotes();window.print();
  });
  $("tc-save-local").addEventListener("click",()=>{
    try{
      window.localStorage.setItem("mountcounty-taxcalc-2026-v1",JSON.stringify(snapshot()));
      feedback("已將本次試算、方案與討論紀錄儲存在這台裝置的瀏覽器。此資料不會主動傳送到網站。");
    }catch(e){feedback("此瀏覽器無法儲存資料，請改用列印／另存PDF。")}
  });
  $("tc-load-local").addEventListener("click",()=>{
    try{
      const data=window.localStorage.getItem("mountcounty-taxcalc-2026-v1");
      if(!data){feedback("這台裝置尚未保存試算。");return}
      feedback(applySnapshot(JSON.parse(data))?"已載入儲存在這台裝置的試算。":"保存資料格式不符，無法載入。");
    }catch(e){feedback("讀取保存資料時發生問題，請重新試算。")}
  });
  $("tc-copy-link").addEventListener("click",async()=>{
    const url=buildShareUrl();
    try{
      if(!navigator.clipboard||!navigator.clipboard.writeText)throw Error("Clipboard unavailable");
      await navigator.clipboard.writeText(url);
      feedback("已複製情境連結。請注意：連結包含工作類型、試算金額及已勾選的身分，分享前請自行確認。");
    }catch(e){
      window.prompt("請手動複製這個試算連結（內含你輸入的金額）：",url);
      feedback("已提供可手動複製的連結。");
    }
  });
  loadUrl();
})();
