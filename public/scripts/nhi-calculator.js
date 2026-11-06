/* 二代健保補充保費計算機，2026年（115年）。
   所有計算皆在使用者裝置執行，不傳送個人資料。 */
(function () {
  "use strict";
  var form = document.getElementById("nhi-calc-form");
  if (!form) return;
  var RATE = .0211, MIN = 29500, PROFESSIONAL = 20000, CAP = 10000000;
  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (number) { return Math.round(number).toLocaleString("zh-TW") + "元"; };
  var positiveNumber = function (id) {
    var v = $(id).value.trim().replace(/,/g, "");
    return v === "" ? null : (Number.isFinite(Number(v)) && Number(v) >= 0 && Number.isSafeInteger(Number(v)) ? Number(v) : null);
  };
  // Whole NT dollars: format as the user types, but always compute using raw digits.
  var moneyInputs = [...form.querySelectorAll("[data-money-input]")];
  var formatMoneyValue = function (value) {
    var normalized = String(value).replace(/[\uFF10-\uFF19]/g, function (digit) {
      return String.fromCharCode(digit.charCodeAt(0) - 0xFEE0);
    });
    var digits = normalized.replace(/\D/g, "");
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  function wireMoneyInput(input) {
    function update() {
      var previous = input.value;
      var selection = input.selectionStart === null ? previous.length : input.selectionStart;
      var numbersBeforeCaret = previous.slice(0, selection).replace(/[\uFF10-\uFF19]/g, "0").replace(/\D/g, "").length;
      var formatted = formatMoneyValue(previous);
      input.value = formatted;
      var nextCaret = 0, count = 0;
      while (nextCaret < formatted.length && count < numbersBeforeCaret) {
        if (/\d/.test(formatted[nextCaret])) count++;
        nextCaret++;
      }
      input.setSelectionRange(nextCaret, nextCaret);
    }
    input.addEventListener("input", update);
    input.addEventListener("blur", function () { input.value = formatMoneyValue(input.value); });
    input.value = formatMoneyValue(input.value);
  }
  moneyInputs.forEach(wireMoneyInput);
  var expenses = {
    salary: { code: "50", desc: "固定薪資一般屬薪資所得50；在原單位加保者，固定薪資本身通常不另扣兼職薪資補充保費。" },
    temporary: { code: "50", desc: "臨時工資一般屬薪資所得50。是否應依法加保，仍要看實際受僱關係。" },
    class: { code: "50", desc: "有課表的課程、講習或訓練班，授課鐘點費一般屬薪資所得50；政府補助不會讓它自動變成9A。" },
    controlled: { code: "50", desc: "由單位出材料並指揮監督完成的工作，通常較接近薪資所得50；實際仍需認定工作關係。" },
    attendance: { code: "50", desc: "一般會議出席費、評審出席報酬常按薪資所得50；若另有專業審查委託，所得類別須另確認。" },
    bonus: { code: "50", desc: "年終、獎金等屬薪資所得；對本單位健保受僱者的獎勵性給付，須按年度累計超過投保金額四倍部分計算。" },
    host: { code: "50", desc: "受主辦單位工作安排、指揮的主持費可能屬薪資所得50；獨立承攬主持服務需另判斷。" },
    independent: { code: "9A", desc: "獨立專業工作者自行安排工作、負擔成本與盈虧，符合規定時可能屬執行業務所得9A。" },
    consultant: { code: "9A", desc: "具專業技能並獨立提供設計、攝影、工藝等服務者，符合條件時可能屬9A；若受僱則可能為50。" },
    performance: { code: "9A", desc: "個人獨立表演所得通常屬執行業務所得9A；不宜一律列為講演稿費9B。受僱表演另須評估50。" },
    speech: { code: "9B", desc: "單次符合規定的專題講演可列講演鐘點費9B；有課表的正式授課則通常為薪資所得50。" },
    manuscript: { code: "9B", desc: "符合規定的稿費、翻譯稿費、編撰費等常屬9B，和依單位指揮進行的文字行政工作不同。" },
    royalty: { code: "9B", desc: "符合規定的版稅及著作報酬可能屬9B；若實為買賣或持續營業，應另按實際性質判斷。" },
    rent: { code: "51", desc: "向個人支付租金，可有租金收入補充保費；若付給合法營業人並取得其適用的銷售憑證須另判斷。" },
    interest: { code: "5A", desc: "付給個人的符合規定利息收入，原則上適用六類個人補充保費之一。" },
    dividend: { code: "54", desc: "公司發放股利可能涉及個人補充保費；部分自營業主或雇主的股利已計入投保金額時有免扣計算規則。" },
    reimbursement: { code: "none", desc: "由領款人代墊、提供單據並核實報支且沒有額外報酬時，原則上不是所得給付。" },
    other: { code: "unknown", desc: "費用名稱無法直接決定所得代碼；請先向國稅局確認再計算，避免錯誤扣費。" }
  };
  var select = function (id) { return $(id).value; };
  var setVisible = function (id, visible) { $(id).hidden = !visible; };
  function syncFields() {
    var payer = select("nhi-payer"), recipient = select("nhi-recipient"), item = select("nhi-item");
    var isPersonal = recipient !== "business", isPrivate = payer === "person";
    var e = expenses[item];
    $("nhi-item-hint").textContent = "建議分類：" + (e.code === "none" ? "核實報支（非所得）" : e.code === "unknown" ? "需先確認" : e.code + "所得") + "。 " + e.desc;
    $("nhi-party-hint").textContent = recipient === "business"
      ? "收款方以登記營業人或團體身分收款，並依法提供銷售憑證時，本筆一般不是給付個人的薪資或執行業務收入。"
      : isPrivate ? "純私人生活支出一般沒有機關團體的補充保費扣費義務；若實際經營事業或僱用員工，請改選相應身分。" : "付給個人時，須判斷實際所得類別、領款人的健保資格與給付金額。";
    setVisible("nhi-person-box", isPersonal && !isPrivate);
    setVisible("nhi-employer-box", !isPrivate);
    setVisible("nhi-private-note", isPrivate);
    setVisible("nhi-bonus-box", !isPrivate && isPersonal && item === "bonus" && recipient === "inside");
    setVisible("nhi-employer-details", !isPrivate && select("nhi-employer") === "yes");
    $("nhi-union-professional").disabled = !["union", "professional"].includes(select("nhi-insurance"));
    if ($("nhi-union-professional").disabled) $("nhi-union-professional").checked = false;
    if ($("nhi-result").hidden === false) $("nhi-result").hidden = true;
  }
  function compute() {
    var payer = select("nhi-payer"), recipient = select("nhi-recipient"), kind = select("nhi-item");
    var amount = positiveNumber("nhi-amount");
    if (amount === null || amount < 1) {
      $("nhi-amount").focus();
      $("nhi-amount").setCustomValidity("請輸入大於0的整數給付金額");
      $("nhi-amount").reportValidity();
      $("nhi-amount").setCustomValidity("");
      return;
    }
    var expected = expenses[kind], override = select("nhi-code");
    var code = ["none","unknown"].includes(expected.code) ? expected.code : override === "auto" ? expected.code : override;
    if (recipient === "business") code = "business";
    if (kind === "reimbursement") code = "none";
    if (kind === "other") code = "unknown";
    var insurance = select("nhi-insurance"), person = null, personNote = "", unit = null, unitNote = "", factors = [];
    var cap = Math.min(amount, CAP), privatePayer = payer === "person", addToWages = false;
    var name = $("nhi-item").selectedOptions[0].textContent.trim();
    var showAmount = function (n) { return n === null ? "待確認" : fmt(n); };
    if (code === "unknown") {
      personNote = "先確認所得類別";
      factors.push("「" + name + "」的所得分類尚未確認。不能只看名目就判定是否要代扣。");
    } else if (code === "none") {
      person = 0; personNote = "核實報支，非所得";
      factors.push("此處假設確實依單據核實報支，不含任何個人工作報酬，所以沒有六類所得的補充保費。");
    } else if (code === "business") {
      person = 0; personNote = "付給營業人／團體";
      factors.push("付款對象是依法開立銷售憑證的營業人或團體，不是直接付款給個人；本筆不按個人薪資或執行業務收入代扣。");
    } else if (privatePayer) {
      person = 0; personNote = "一般私人生活給付";
      factors.push("本例假設為私人生活上的給付，不是機關、事業、團體或執行業務者的扣費義務人付款；一般無須代扣。");
    } else if (["lowincome","uninsured"].includes(insurance)) {
      person = 0; personNote = "符合身分免扣";
      factors.push(insurance === "lowincome" ? "領款者若確實為第五類低收入戶被保險人，符合規定的六類所得可免扣；請保留有效證明。" : "本例假設領款者確實不具健保投保資格，依規定免扣；須核實資格。");
    } else if (insurance === "unknown") {
      personNote = "先確認領款人健保身分";
      factors.push("不知道領款者的健保投保類別，不能判斷是否符合免扣資格；請先向領款者確認並取得必要證明。");
    } else if (code === "50" && recipient === "inside" && kind !== "bonus") {
      person = 0; personNote = "在本單位投保的薪資";
      factors.push("本筆為由本人健保投保單位發放的薪資所得，通常不是非所屬單位給付的兼職薪資，因此不按兼職薪資代扣個人補充保費。");
    } else if (code === "50" && kind === "bonus" && recipient === "inside") {
      var insuranceBase = positiveNumber("nhi-bonus-insured"), before = positiveNumber("nhi-bonus-prior");
      if (insuranceBase === null || insuranceBase <= 0 || before === null) {
        personNote = "缺少獎金累計資料";
        factors.push("在本單位投保者的獎金需先輸入當月投保金額及本年度已計入的獎金累計，才能判斷超過四倍的部分。");
      } else {
        var threshold = insuranceBase * 4;
        var excess = Math.max(0, before + amount - threshold) - Math.max(0, before - threshold);
        var assessable = Math.min(CAP, excess);
        person = Math.round(assessable * RATE);
        personNote = person ? "超過當月投保金額四倍的部分" : "未超過投保金額四倍";
        factors.push("獎金累計門檻：" + fmt(insuranceBase) + " × 4＝" + fmt(threshold) + "。本次應計費部分＝max(0,此前" + fmt(before) + "＋本次" + fmt(amount) + "－" + fmt(threshold) + ")－此前已超額部分＝" + fmt(excess) + "；取單次1,000萬元上限後 × 2.11%＝" + fmt(person) + "。");
      }
    } else if (code === "50") {
      if (insurance === "union") {
        person = 0; personNote = "第二類本人薪資免扣";
        factors.push("領款人如為健保第二類職業工會被保險人本人，其薪資收入依規定免扣個人補充保費；須核實有效在保證明。");
      } else if (amount < MIN) {
        person = 0; personNote = "未達兼職薪資門檻";
        factors.push("此筆屬非所屬健保投保單位給付的薪資所得50，" + fmt(amount) + "未達2026年每次" + fmt(MIN) + "的兼職薪資扣費門檻，不必代扣。");
      } else {
        person = Math.round(cap * RATE); personNote = "兼職薪資應代扣";
        factors.push("本筆屬非所屬健保投保單位給付的薪資所得50，達2026年單次" + fmt(MIN) + "門檻；計算：" + fmt(cap) + " × 2.11%＝" + fmt(person) + "。");
      }
    } else if (["9A","9B","51","5A","54"].includes(code)) {
      var isBusinessIncome = code === "9A" || code === "9B";
      var title = isBusinessIncome ? "執行業務收入" : code === "51" ? "租金" : code === "5A" ? "利息" : "股利";
      var isExemptProfession = isBusinessIncome && (
        insurance === "professional" || (insurance === "union" && $("nhi-union-professional").checked)
      );
      if (isExemptProfession) {
        person = 0; personNote = "已計入投保金額的執行業務收入";
        factors.push("本例假設領款人以自行執業者或職業工會被保險人身分，且此項執行業務收入符合免扣規定；請取得投保證明及實際所得性質的佐證。");
      } else if (isBusinessIncome && insurance === "union" && !$("nhi-union-professional").checked) {
        personNote = "需確認工會投保與勞務性質";
        factors.push("職業工會投保者是否適用執行業務收入免扣，須確認收入是否為自行執業或自營作業收入；請勾選確認，或保留人工認定。");
      } else if (code === "54" && ["professional"].includes(insurance)) {
        personNote = "須確認股利是否計入投保金額";
        factors.push("特定雇主或自營業主的股利已計入一般保費投保金額時，可能適用股利補充保費的免扣或調整，不能直接計算。");
      } else if (insurance === "disadvantaged" && amount < MIN) {
        person = 0; personNote = "弱勢身分的特殊門檻";
        factors.push("本例假設有符合規定的中低收入、特殊境遇等有效證明，且" + title + "單次" + fmt(amount) + "未達2026年最低工資" + fmt(MIN) + "，可適用免扣。");
      } else if (amount < PROFESSIONAL) {
        person = 0; personNote = "未達每次2萬元門檻";
        factors.push(title + "單次給付" + fmt(amount) + "，未達一般" + fmt(PROFESSIONAL) + "門檻，因此不必代扣。");
      } else if (code === "54" && recipient === "inside") {
        personNote = "股利需確認已列入投保金額部分";
        factors.push("股利所得可能需要扣費，但公司負責人、自營業主或已納入投保金額者有特殊規定；請先確認身分及已計入部分。");
      } else {
        person = Math.round(cap * RATE); personNote = title + "達門檻";
        factors.push(title + "單次給付達" + fmt(PROFESSIONAL) + "；計算：" + fmt(cap) + " × 2.11%＝" + fmt(person) + "。");
      }
    } else {
      personNote = "須確認所得性質";
      factors.push("這筆收入尚無法套用本工具可判斷的六類所得，請提供契約、工作內容及收款憑證確認。");
    }
    if (code === "50" && recipient !== "business" && !privatePayer) addToWages = true;
    if (privatePayer) {
      unit = 0; unitNote = "私人生活支出";
    } else if (select("nhi-employer") === "no") {
      unit = 0; unitNote = "非有受僱員工的投保單位";
    } else if (select("nhi-employer") === "unknown") {
      unitNote = "尚未確認是否為投保單位";
      factors.push("是否須另繳單位補充保費，須先確認付款者是不是有受僱員工健保加保的投保單位。");
    } else {
      var wages = positiveNumber("nhi-month-wages"), insured = positiveNumber("nhi-insured-total");
      if (wages === null || insured === null) {
        unitNote = "未提供當月兩個總額";
        factors.push("若付款者是健保投保單位，需輸入本月其他薪資所得總額及員工投保金額合計；單筆報酬不能直接乘2.11%。");
      } else {
        var allWages = wages + (addToWages ? amount : 0);
        var excessUnit = Math.max(0, allWages - insured);
        unit = Math.round(excessUnit * RATE);
        unitNote = unit ? "投保單位應自行繳納" : "本月差額不為正";
        factors.push("單位當月薪資所得總額＝其他薪資" + fmt(wages) + (addToWages ? "＋本筆薪資" + fmt(amount) : "（本筆非薪資所得，不另加入）") + "＝" + fmt(allWages) + "；扣除當月員工投保金額總額" + fmt(insured) + "，正差額" + fmt(excessUnit) + " × 2.11%＝" + fmt(unit) + "。這是付款單位本月總額，不是單筆新增的成本。");
      }
    }
    if (code === "9B" && kind === "class" && override === "9B") factors.push("你手動將有課程安排的授課費改為9B；請先依財政部對授課與專題講演的區分確認，不能直接照表面名稱更改。");
    if (kind === "performance" && override === "9B") factors.push("獨立演出通常不是9B稿費／講演；請先確認表演者與付款方的實際關係。");
    if (code === "50" && recipient === "inside" && insurance === "union") factors.push("「在本單位投保」與「職業工會本人投保」不應同時成立，請更正身分後重新計算。");
    if (amount > CAP && person !== null) factors.push("單次個人補充保費一般計費金額以1,000萬元為上限；超過部分未納入。");
    factors.push("例外：健保第二類本人、第五類低收入戶、無投保資格、依法核定的弱勢身分、獎金四倍門檻，以及股利已納入投保金額等，都可能改變結果。核實報支與虛假拆分給付不能一概等同。");
    var resultTitle = person === null || unit === null ? "部分條件待確認" : person > 0 || unit > 0 ? "這筆款項涉及補充保費" : "依填寫條件，這筆不需扣取個人補充保費";
    $("nhi-result-title").textContent = resultTitle;
    $("nhi-person-amount").textContent = showAmount(person);
    $("nhi-person-status").textContent = personNote;
    $("nhi-unit-amount").textContent = showAmount(unit);
    $("nhi-unit-status").textContent = unitNote;
    $("nhi-takehome").textContent = person === null ? "待確認" : fmt(amount - person);
    $("nhi-result-code").textContent = "本次項目：「" + name + "」／建議所得類別：" + (code === "business" ? "營業人銷售憑證" : code === "none" ? "核實報支" : code === "unknown" ? "待確認" : "代碼 " + code) + "／給付額：" + fmt(amount) + "。";
    var list = document.createElement("ul");
    factors.forEach(function (line) { var li = document.createElement("li"); li.textContent = line; list.append(li); });
    $("nhi-reasons").replaceChildren(list);
    var explanation = [
      "【二代健保補充保費給付試算說明｜2026年】",
      "本筆費用：" + name + "；給付總額：" + fmt(amount) + "。",
      "所得判斷：" + (code === "business" ? "支付營業人／團體" : code === "none" ? "核實報支，非所得" : code === "unknown" ? "尚待確認所得性質" : "所得代碼" + code) + "。",
      "個人補充保費：" + (person === null ? "待確認資格與分類" : fmt(person) + (person ? "，由付款者依法代扣並繳交健保署" : "，依本例條件無須代扣")) + "。",
      "投保單位補充保費：" + (unit === null ? "尚待確認是否為健保投保單位及當月薪資差額" : fmt(unit) + "（屬付款單位當月應自行負擔的總額，不得直接當成單筆代扣款）") + "。",
      "本筆扣除個人補充保費後：" + (person === null ? "待確認" : fmt(amount - person) + "（未計所得稅等其他扣款）") + "。",
      "說明：" + (personNote || "須人工確認") + "；" + (unitNote || "須人工確認") + "。",
      "※ 依實際付款、受僱關係、領款者身分、年度及其他例外規定辦理，本試算不取代主管機關認定。"
    ].join("\n");
    $("nhi-public-text").textContent = explanation;
    $("nhi-copy-status").textContent = "";
    $("nhi-result").hidden = false;
    $("nhi-result").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("nhi-employer").addEventListener("change", syncFields);
  ["nhi-payer","nhi-recipient","nhi-item","nhi-insurance","nhi-code"].forEach(function (id) { $(id).addEventListener("change", syncFields); });
  form.addEventListener("submit", function (event) { event.preventDefault(); compute(); });
  $("nhi-copy").addEventListener("click", function () {
    var txt = $("nhi-public-text").textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { $("nhi-copy-status").textContent = "已複製，可貼到付款資料。"; }, function () { $("nhi-copy-status").textContent = "複製失敗，請手動選取文字。"; });
    } else {
      var range = document.createRange(); range.selectNodeContents($("nhi-public-text")); window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
      $("nhi-copy-status").textContent = "已選取文字，請按 Ctrl+C 複製。";
    }
  });
  form.addEventListener("reset", function () { window.setTimeout(function () { moneyInputs.forEach(function (input) { input.value = formatMoneyValue(input.value); }); syncFields(); $("nhi-result").hidden = true; }, 0); });
  syncFields();
})();
