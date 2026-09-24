const assert = require('node:assert/strict');
const {koreanWon,parseAmount} = require('./app.js');
assert.equal(koreanWon(167000),'16만 7천 원');
assert.equal(koreanWon(167000.5),'16만 7천 1 원');
assert.equal(koreanWon(9999.5),'1만 원');
assert.equal(koreanWon(0),'0원');
assert.equal(koreanWon(100000001),'1억 1 원');
assert.equal(koreanWon(123456789),'1억 2,345만 6천 789 원');
assert.equal(parseAmount('1,200.50'),1200.5);
assert.equal(parseAmount(''),null);
for(const value of ['-1','abc','1.234','1000000000','Infinity']) assert.throws(()=>parseAmount(value));
assert.equal(Math.round(parseAmount('200')*835.0025),167001);
console.log('All conversion and validation checks passed.');

const {simpleRate,convert}=require('./app.js');
for(const [input,expected] of [[1366.70,1370],[863.44,870],[1555.99,1560],[27.98,28],[1370,1370],[28,28],[100,100],[100.01,110]]) assert.equal(simpleRate(input),expected);
assert.equal(convert(200,1555.99),312000);
assert.equal(convert(1000,863.44,100),8700);
assert.equal(convert(200,1366.70),274000);
assert.equal(convert(200,27.98),5600);
for(const value of ['',0,-1,'abc']) assert.throws(()=>simpleRate(value));
console.log('Simplified rates and 100-yen basis passed.');

const {kstDate, untilKstMidnight, exchangeRatesFromApi} = require('./app.js');
assert.equal(kstDate(Date.parse('2026-09-24T14:59:59Z')), '2026-09-24');
assert.equal(kstDate(Date.parse('2026-09-24T15:00:00Z')), '2026-09-25');
assert.equal(untilKstMidnight(Date.parse('2026-09-24T14:59:59Z')), 1000);
const live = exchangeRatesFromApi([
  {date:'2026-09-24',base:'EUR',quote:'KRW',rate:1560},
  {date:'2026-09-24',base:'EUR',quote:'USD',rate:1.2},
  {date:'2026-09-23',base:'EUR',quote:'JPY',rate:180},
  {date:'2026-09-24',base:'EUR',quote:'VND',rate:30000}
]);
assert.deepEqual(live.EUR,{value:'1560.00',date:'2026-09-24'});
assert.deepEqual(live.USD,{value:'1300.00',date:'2026-09-24'});
assert.deepEqual(live.JPY,{value:'866.67',date:'2026-09-23'});
assert.deepEqual(live.VND,{value:'5.20',date:'2026-09-24'});
assert.throws(() => exchangeRatesFromApi([{date:'2026-09-24',base:'EUR',quote:'USD',rate:1.2}]));
console.log('Korean midnight and live-rate conversion passed.');
