'use strict';
function koreanWon(value) {
  const n = Math.round(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('금액 범위를 벗어났어요');
  if (n === 0) return '0원';
  const units = ['', '만', '억', '조'];
  const parts = [];
  let rest = n;
  for (let i = 0; rest > 0; i++) {
    const group = rest % 10000;
    if (group) {
      let chunk = group.toLocaleString('ko-KR');
      if (i === 0 && group >= 1000) chunk = Math.floor(group / 1000) + '천' + (group % 1000 ? ' ' + group % 1000 : '');
      parts.unshift(chunk + units[i]);
    }
    rest = Math.floor(rest / 10000);
  }
  return parts.join(' ') + ' 원';
}
function parseAmount(value) {
  const clean = value.replace(/,/g, '').trim();
  if (!clean) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) throw new Error('0 이상의 숫자를 입력해 주세요. 소수점은 두 자리까지 가능해요.');
  const n = Number(clean);
  if (n > 999999999) throw new Error('금액은 999,999,999 이하로 입력해 주세요.');
  return n;
}
function simpleRate(value) {
  const n = parseAmount(String(value));
  if (n === null || n <= 0 || n > 1000000) throw new Error('환율은 0보다 크고 1,000,000 이하인 숫자로 입력해 주세요.');
  // Integer hundredths avoid floating-point errors at exact step boundaries.
  const step = n >= 100 ? 10 : 1;
  return Math.ceil(Math.round(n * 100) / (step * 100)) * step;
}
function convert(amount, rawRate, basis = 1) {
  return Math.round(amount * simpleRate(rawRate) / basis);
}
if (typeof module !== 'undefined') module.exports = {koreanWon, parseAmount, simpleRate, convert};
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const names = {EUR:'유로',USD:'달러',JPY:'엔',TRY:'리라',CNY:'위안',GBP:'파운드',VND:'동',THB:'바트',TWD:'달러',HKD:'달러',SGD:'달러',AUD:'달러',CAD:'달러',CHF:'프랑',PHP:'페소'};
  const rates = {EUR:'1555.99',USD:'1366.70',JPY:'863.44',TRY:'27.98'};
  const basisFor = currency => ['JPY','VND'].includes(currency) ? 100 : 1;
  function calculate() {
    $('input-error').textContent = '';
    $('rate-error').textContent = '';
    $('amount').removeAttribute('aria-invalid');
    $('manual-rate').removeAttribute('aria-invalid');
    $('result').textContent = '—';
    const currency = $('currency').value;
    const basis = basisFor(currency);
    let rounded;
    try {
      rounded = simpleRate($('manual-rate').value);
      $('applied-rate').textContent = basis + names[currency] + ' = ' + rounded.toLocaleString('ko-KR') + '원으로 계산';
      $('rate-help').textContent = '입력 환율을 ' + (Number($('manual-rate').value.replace(/,/g,'')) >= 100 ? '10원' : '1원') + ' 단위로 올림해요.';
    } catch(e) {
      $('applied-rate').textContent = '';
      $('rate-help').textContent = '알고 계신 환율을 입력해 주세요.';
      if ($('manual-rate').value.trim()) {
        $('rate-error').textContent = e.message;
        $('manual-rate').setAttribute('aria-invalid','true');
      }
      $('words').textContent = '환율을 입력해 주세요';
      return;
    }
    try {
      const amount = parseAmount($('amount').value);
      if (amount === null) { $('words').textContent = '금액을 입력해 주세요'; return; }
      const won = Math.round(amount * rounded / basis);
      $('result').textContent = won.toLocaleString('ko-KR');
      $('words').textContent = koreanWon(won);
      return won;
    } catch(e) {
      $('input-error').textContent = e.message;
      $('amount').setAttribute('aria-invalid','true');
      $('words').textContent = '입력한 금액을 확인해 주세요';
    }
  }
  function changeCurrency() {
    const currency = $('currency').value;
    $('unit').textContent = names[currency];
    $('rate-label').textContent = basisFor(currency) + names[currency] + ' 환율 (원)';
    $('manual-rate').value = rates[currency] || '';
    calculate();
  }
  $('amount').addEventListener('input', calculate);
  $('amount').addEventListener('blur', () => {try {const n=parseAmount($('amount').value); if(n!==null) $('amount').value=n.toLocaleString('en-US',{maximumFractionDigits:2});}catch{} });
  $('currency').addEventListener('change', changeCurrency);
  $('manual-rate').addEventListener('input', () => {rates[$('currency').value]=$('manual-rate').value;calculate();});
  $('reset').addEventListener('click', () => {
    $('amount').value='';
    calculate();
    $('amount').focus();
  });
  document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => {
    try {const value=(parseAmount($('amount').value) || 0)+Number(button.dataset.add); parseAmount(String(value));$('amount').value=value.toLocaleString('en-US',{maximumFractionDigits:2});calculate();}catch(e){$('input-error').textContent=e.message;}
  }));
  changeCurrency();
}
