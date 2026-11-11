const vi = document.documentElement.lang === 'vi';
const t = (vietnamese, english) => vi ? vietnamese : english;
const format = new Intl.NumberFormat(vi ? 'vi-VN' : 'en-US');
const get = id => document.getElementById(id);
const day = get('pilot-day');
const next = get('pilot-next');
const runAll = get('pilot-run-all');
const reset = get('pilot-reset');
const initialShares = 1000n;
const transferred = 400n;
const period = 30n;
const pool = 6000000n;
const lastStep = 5;
let step = 0;

function amounts(transferDay) {
  const remainingDays = period - transferDay;
  const weights = [
    initialShares * transferDay + (initialShares - transferred) * remainingDays,
    transferred * remainingDays
  ];
  return weights.map(weight => pool * weight / (initialShares * period));
}

function render() {
  const transferDay = BigInt(day.value);
  const [aRent, bRent] = amounts(transferDay);
  const a = format.format(aRent);
  const b = format.format(bRent);
  const shares = step === 0 ? [initialShares, 0n] : [initialShares - transferred, transferred];
  const funded = step >= 3 ? pool : 0n;
  const paid = step >= 4 ? aRent + bRent : 0n;
  const f = value => format.format(value);
  const messages = [
    t('Hồ sơ giá còn hiệu lực. Chọn thời điểm chuyển hoặc chạy trọn mô phỏng.',
      'The price record is current. Choose a transfer day or run the full simulation.'),
    t('Đã chuyển 400 phần sau ' + transferDay + ' ngày. A còn 600 phần, B giữ 400 phần.',
      'Transferred 400 shares after ' + transferDay + ' days. A holds 600 and B holds 400.'),
    t('Giá đã hết hạn. Lượt chuyển tiếp theo bị chặn và số phần giữ nguyên.',
      'The price expired. A further transfer is blocked and holdings stay the same.'),
    t('Kỳ đã đóng và quỹ đã đủ. A được nhận ' + a + ', B được nhận ' + b + ' đơn vị thử.',
      'The period closed and the vault is funded. A can claim ' + a + ' and B can claim ' + b + ' test units.'),
    t('A đã nhận ' + a + ' và B đã nhận ' + b + '. Giá hết hạn không làm mất khoản thuê đã tích lũy.',
      'A received ' + a + ' and B received ' + b + '. Price expiry does not cancel accrued rent.'),
    t('Đã hoàn tất. Lượt nhận lần hai bị chặn và tổng tiền đã chi giữ nguyên.',
      'Complete. The second claim is blocked and total payments remain unchanged.')
  ];
  const actions = [
    t('Chuyển 400 phần', 'Transfer 400 shares'),
    t('Cho giá hết hạn và thử chuyển', 'Expire price and retry transfer'),
    t('Đóng kỳ và cấp quỹ thử', 'Close the period and fund the vault'),
    t('Nhận tiền thuê cho A và B', 'Claim rent for A and B'),
    t('Thử nhận lần hai', 'Try claiming again')
  ];

  get('pilot-day-output').textContent = transferDay.toString();
  day.disabled = step > 0;
  get('pilot-step').textContent = t('Bước ', 'Step ') + step + '/' + lastStep;
  get('pilot-progress').value = step;
  get('shares-a').textContent = f(shares[0]);
  get('shares-b').textContent = f(shares[1]);
  get('entitled-a').textContent = a;
  get('entitled-b').textContent = b;
  get('claimed-a').textContent = step >= 4 ? a : '0';
  get('claimed-b').textContent = step >= 4 ? b : '0';
  get('pilot-fund-summary').textContent =
    t('Quỹ đã cấp: ', 'Funded: ') + f(funded) +
    t(' · Đã chi: ', ' · Paid: ') + f(paid) +
    t(' · Còn lại: ', ' · Remaining: ') + f(funded - paid);
  get('pilot-status').textContent = messages[step];
  next.textContent = actions[step] ?? t('Đã hoàn tất', 'Finished');
  next.disabled = step === lastStep;
  runAll.disabled = step === lastStep;
  reset.disabled = false;
  get('pilot-result').hidden = step !== lastStep;
  get('pilot-result-transfer').textContent = t(
    'A chuyển 400 phần sang B sau ' + transferDay + ' ngày. Số phần cuối kỳ là 600 và 400.',
    'A transferred 400 shares to B after ' + transferDay + ' days. Closing holdings were 600 and 400.');
  get('pilot-result-payout').textContent = t(
    'A nhận ' + a + ', B nhận ' + b + '. Tổng đã chi ' + f(paid) + ', quỹ còn ' + f(funded - paid) + '.',
    'A received ' + a + ' and B received ' + b + '. Total paid ' + f(paid) + ', vault remaining ' + f(funded - paid) + '.');
}

day.addEventListener('input', render);
next.addEventListener('click', () => {
  step = Math.min(step + 1, lastStep);
  render();
  if (step === lastStep) reset.focus();
});
runAll.addEventListener('click', () => {
  step = lastStep;
  render();
  reset.focus();
});
reset.addEventListener('click', () => {
  step = 0;
  day.value = '15';
  render();
  day.focus();
});
render();
