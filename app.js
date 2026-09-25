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
const CURRENCIES = ['EUR','TRY'];
const RATE_API = 'https://api.frankfurter.dev/v2/rates?base=EUR&quotes=' + ['KRW', ...CURRENCIES.filter(code => code !== 'EUR')].join(',');
function kstDate(now = Date.now()) {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function untilKstMidnight(now = Date.now()) {
  return 86400000 - (now + 9 * 60 * 60 * 1000) % 86400000;
}
function exchangeRatesFromApi(rows) {
  if (!Array.isArray(rows)) throw new Error('환율 데이터 형식이 올바르지 않아요.');
  const byQuote = new Map();
  for (const row of rows) {
    if (row.base === 'EUR' && typeof row.quote === 'string' &&
        Number.isFinite(row.rate) && row.rate > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      byQuote.set(row.quote.toUpperCase(), row);
    }
  }
  const won = byQuote.get('KRW');
  if (!won) throw new Error('원화 환율을 찾지 못했어요.');
  const result = {};
  for (const code of CURRENCIES) {
    const quote = code === 'EUR' ? {rate:1, date:won.date} : byQuote.get(code);
    if (!quote) continue;
    const basis = code === 'JPY' || code === 'VND' ? 100 : 1;
    const rate = won.rate / quote.rate * basis;
    if (!Number.isFinite(rate) || rate <= 0 || rate > 1000000) continue;
    result[code] = {value:rate.toFixed(2), date:won.date < quote.date ? won.date : quote.date};
  }
  if (!Object.keys(result).length) throw new Error('사용할 수 있는 환율이 없어요.');
  return result;
}
if (typeof module !== 'undefined') module.exports = {koreanWon, parseAmount, simpleRate, convert, kstDate, untilKstMidnight, exchangeRatesFromApi};
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const names = {EUR:'유로',TRY:'리라'};
  const rates = {EUR:'1555.99',TRY:'27.98'};
  const rateMeta = {};
  const manualOverrides = new Set();
  let lastRefreshDay = '';
  let pendingRefresh = null;
  let fetchFailed = false;
  let midnightTimer;
  const basisFor = currency => ['JPY','VND'].includes(currency) ? 100 : 1;
  function loadCachedRates() {
    try {
      const saved = JSON.parse(localStorage.getItem('easyExchangeRates') || '{}');
      for (const code of CURRENCIES) {
        const item = saved[code];
        if (item && /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
            typeof item.value === 'string' && Number(item.value) > 0 && Number(item.value) <= 1000000) {
          rates[code] = item.value;
          rateMeta[code] = {date:item.date};
        }
      }
    } catch { /* Private browsing may block local storage. */ }
  }
  function showRateStatus() {
    const code = $('currency').value;
    const meta = rateMeta[code];
    if (manualOverrides.has(code)) {
      $('rate-status').textContent = '직접 입력한 환율이에요. 다음 날 00:00(한국시간)에 자동 환율을 다시 확인해요.';
    } else if (fetchFailed) {
      $('rate-status').textContent = meta
        ? '새 환율을 가져오지 못했어요. 자료 기준일 ' + meta.date + '의 환율을 사용 중입니다.'
        : '환율을 가져오지 못했어요. 표시된 값은 예시이거나 직접 입력한 환율입니다.';
    } else if (meta) {
      $('rate-status').textContent = '자동 환율 · 자료 기준일 ' + meta.date + ' · 한국시간 매일 00:00 확인';
    } else if (lastRefreshDay) {
      $('rate-status').textContent = '선택한 통화의 자동 환율을 찾지 못했어요. 직접 입력해 주세요.';
    } else if (rates[code]) {
      $('rate-status').textContent = '예시 환율이에요. 최신 환율을 확인하는 중입니다.';
    } else {
      $('rate-status').textContent = '최신 환율을 확인하는 중입니다.';
    }
  }
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
    showRateStatus();
    calculate();
  }
  async function refreshRates() {
    if (pendingRefresh) return pendingRefresh;
    pendingRefresh = (async () => {
      try {
        const response = await fetch(RATE_API, {cache:'no-store'});
        if (!response.ok) throw new Error('환율 서버 응답 오류');
        const received = exchangeRatesFromApi(await response.json());
        fetchFailed = false;
        for (const [code, item] of Object.entries(received)) {
          if (!manualOverrides.has(code)) rates[code] = item.value;
          rateMeta[code] = {date:item.date};
        }
        try {localStorage.setItem('easyExchangeRates', JSON.stringify(received));} catch {}
        lastRefreshDay = kstDate();
        $('manual-rate').value = rates[$('currency').value] || '';
        showRateStatus();
        calculate();
      } catch (error) {
        fetchFailed = true;
        showRateStatus();
      } finally {
        pendingRefresh = null;
      }
    })();
    return pendingRefresh;
  }
  function scheduleMidnight() {
    clearTimeout(midnightTimer);
    midnightTimer = setTimeout(() => {
      manualOverrides.clear();
      refreshRates().finally(scheduleMidnight);
    }, untilKstMidnight() + 1000);
  }
  function refreshIfNewDay() {
    if (lastRefreshDay !== kstDate()) {
      manualOverrides.clear();
      refreshRates();
      scheduleMidnight();
    }
  }
  $('amount').addEventListener('input', calculate);
  $('amount').addEventListener('blur', () => {try {const n=parseAmount($('amount').value); if(n!==null) $('amount').value=n.toLocaleString('en-US',{maximumFractionDigits:2});}catch{} });
  $('currency').addEventListener('change', changeCurrency);
  $('manual-rate').addEventListener('input', () => {rates[$('currency').value]=$('manual-rate').value;manualOverrides.add($('currency').value);showRateStatus();calculate();});
  $('reset').addEventListener('click', () => {
    $('amount').value='';
    calculate();
    $('amount').focus();
  });
  $('rate-definition-open').addEventListener('click', () => $('rate-definition').showModal());
  $('rate-definition-close').addEventListener('click', () => $('rate-definition').close());
  document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => {
    try {const value=(parseAmount($('amount').value) || 0)+Number(button.dataset.add); parseAmount(String(value));$('amount').value=value.toLocaleString('en-US',{maximumFractionDigits:2});calculate();}catch(e){$('input-error').textContent=e.message;}
  }));
  loadCachedRates();
  changeCurrency();
  refreshRates();
  scheduleMidnight();
  document.addEventListener('visibilitychange', () => {if (!document.hidden) refreshIfNewDay();});
  window.addEventListener('pageshow', refreshIfNewDay);
}
