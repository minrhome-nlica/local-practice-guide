// 2026 general full-time worker insurance example. Does not calculate special statuses.
(() => {
  'use strict';
  const pane = document.getElementById('wage-calculator-2026');
  if (!pane) return;
  const grades = (name) => String(pane.dataset[name] || '').split(',').map(Number);
  const labor = grades('labor'), health = grades('health'),
        pension = grades('pension'), accident = grades('accident');
  const el = id => document.getElementById(id);
  const fmt = value => Math.round(value).toLocaleString('zh-TW') + ' 元';
  const round = Math.round;
  const bracket = (value, list) => list.find(amount => value <= amount) || list[list.length-1];
  const salary = el('wage-monthly'), type = el('wage-coverage'), dep = el('wage-dependents');
  const voluntary = el('wage-voluntary'), accidentChoice = el('wage-accident-choice');
  const accidentCustomWrap = el('wage-accident-custom-wrap');
  const accidentCustom = el('wage-accident-custom');
  const error = el('wage-error'), output = el('wage-output');
  function set(key,value){ el('out-'+key).textContent = typeof value === 'number' ? fmt(value) : value; }
  function update() {
    const raw = salary.value.replace(/[\s,，]/g, '');
    const wage = Number(raw);
    if(!Number.isFinite(wage) || wage<29500 || wage>100000000 || !/^\d+$/.test(raw)) {
      output.hidden = true;
      error.hidden = false;
      error.textContent = wage<29500 && wage>0 ?
        '此頁以一般全時月薪至少 29,500 元為前提；部分工時、短期工作或特殊身分請查官方分級表，不能直接套用。' :
        '請輸入有效的 2026 年約定月薪（例如 34,000 元）。';
      return;
    }
    error.hidden = true;output.hidden = false;
    const laborGrade = bracket(wage,labor), healthGrade = bracket(wage,health);
    const pensionGrade = bracket(wage,pension), accidentGrade = bracket(wage,accident);
    const cover=type.value, healthDep=Math.max(0,Math.min(3,Number(dep.value)||0));
    const selfRate=Math.max(0,Math.min(6,Number(voluntary.value)||0))/100;
    const laborEmp=cover==='employment' ? 0 : round(laborGrade*.115*.2);
    const laborOrg=cover==='employment' ? 0 : round(laborGrade*.115*.7);
    const jobEmp=cover==='labor' ? 0 : round(laborGrade*.01*.2);
    const jobOrg=cover==='labor' ? 0 : round(laborGrade*.01*.7);
    // Health employee premium is rounded per person, then multiplied by dependents.
    const healthEmp=round(healthGrade*.0517*.3)*(1+healthDep);
    const healthOrg=round(healthGrade*.0517*.6*1.56);
    const pensionOrg=round(pensionGrade*.06), pensionSelf=round(pensionGrade*selfRate);
    const employeeTotal=laborEmp+jobEmp+healthEmp+pensionSelf;
    const employerKnown=laborOrg+jobOrg+healthOrg+pensionOrg;
    accidentCustomWrap.hidden=accidentChoice.value!=='custom';
    let rate=null;
    if(accidentChoice.value==='custom') {
      const n=Number(accidentCustom.value);
      if(accidentCustom.value && Number.isFinite(n) && n>=.12 && n<=.96) rate=n;
    }else if(accidentChoice.value) rate=Number(accidentChoice.value);
    const occ=(rate===null)?null:round(accidentGrade*rate/100);
    set('labor-grade',laborGrade);
    set('health-grade',healthGrade);
    set('pension-grade',pensionGrade);
    set('accident-grade',accidentGrade);
    set('employee-labor',laborEmp);set('employee-job',jobEmp);set('employee-health',healthEmp);
    set('employee-pension',pensionSelf);set('employee-total',employeeTotal);
    set('takehome',wage-employeeTotal);
    set('employer-labor',laborOrg);set('employer-job',jobOrg);set('employer-health',healthOrg);
    set('employer-pension',pensionOrg);
    set('employer-accident',occ===null?'未計入':occ);
    set('employer-total',employerKnown+(occ||0));
    set('company-cost',wage+employerKnown+(occ||0));
    el('wage-cost-note').textContent = occ === null
      ? '注意：上面兩項雇主合計未含職災保險費，並非完整的人事成本；先選擇實際職災費率，才能計入。'
      : '本例職災費率採 '+rate.toFixed(2)+'%；雇主額外費用已包含職災保險，但不包含其他可能的人事費用。';
  }
  salary.addEventListener('input', event => {
    const field=event.currentTarget;
    const old=field.value, index=field.selectionStart??old.length;
    const count=old.slice(0,index).replace(/\D/g,'').length;
    const digits=old.replace(/[\uFF10-\uFF19]/g,x=>String.fromCharCode(x.charCodeAt(0)-0xFEE0)).replace(/\D/g,'');
    const pretty=digits.replace(/\B(?=(\d{3})+(?!\d))/g,',');
    field.value=pretty;
    let pos=0, n=0;
    while(pos<pretty.length&&n<count) if(/\d/.test(pretty[pos++]))n++;
    field.setSelectionRange(pos,pos);
    update();
  });
  [type,dep,voluntary,accidentChoice,accidentCustom].forEach(field=>
    field.addEventListener(field.tagName==='SELECT'?'change':'input',update));
  el('wage-form-2026').addEventListener('submit',e=>e.preventDefault());
  update();
})();
