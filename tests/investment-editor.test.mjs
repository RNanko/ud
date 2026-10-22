import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, hookHarness, jsxRuntime, findNode, plain } from './helpers.mjs';

function fixture(position = null, blocked = false) {
  const hooks = hookHarness(), saves = [];
  const Editor = loadModule('app/(main)/account/investments/InvestmentEditor.tsx', {
    react: hooks.react, 'react/jsx-runtime': jsxRuntime, '@radix-ui/react-dialog': {}, '@radix-ui/react-popover': {}, 'lucide-react': {},
    '@/app/components/ui/button': { Button: 'Button' }, '@/app/components/ui/input': { Input: 'Input' },
    '@/lib/investments': loadModule('lib/investments.ts'), '@/hooks/use-account-calendar': { useAccountCalendar: () => ({ timezone: 'UTC', localDate: () => '2026-10-09' }) },
    '../finance/FinanceEditor': { financeDialogClass: '' }, './StockPicker': 'StockPicker', '@/app/components/shared/charts/ChartDatePicker': 'DatePicker',
  }, { FormData: class { get(key) { return { symbol: 'AAPL', name: 'Apple' }[key]; } } }).default;
  const render = () => hooks.render(() => Editor({ position, blocked, initialKind: 'other', assets: [], onSave: async (id, draft) => saves.push({ id, draft: plain(draft) }), onClose() {} }));
  const date = () => findNode(render(), node => node.type === 'DatePicker').props;
  const submit = () => findNode(render(), node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: {} });
  const field = name => findNode(render(), node => node.props?.name === name).props;
  return { render, date, submit, saves, field };
}

test('Add Position saves the app-calendar date and rejects empty or future purchase dates', async () => {
  const state = fixture();
  assert.equal(state.date().value, '2026-10-09');assert.equal(state.date().maximum, '2026-10-09');assert.equal(state.date().required, true);assert.equal(state.date().modal, true);
  state.field('buyPrice').onChange({ target: { value: '12.34' } });state.field('quantity').onChange({ target: { value: '2' } });
  state.date().onChange('2026-01-05');await state.submit();
  assert.equal(state.saves[0].id, null);assert.equal(state.saves[0].draft.boughtOn, '2026-01-05');
  for (const invalid of ['', '2999-01-01']) {
    state.date().onChange(invalid);await state.submit();
    assert.equal(state.saves.length, 1);assert.ok(findNode(state.render(), node => node.props?.role === 'alert'));
  }
});

test('Edit Position starts with the saved purchase date and blocks calendar edits during recovery', async () => {
  const position = { id: 'existing', kind: 'other', assetId: null, symbol: 'AAPL', name: 'Apple', buyPrice: '12.34', quantity: '2', boughtOn: '2026-01-06', manualPrice: null };
  const state = fixture(position);
  assert.equal(state.date().value, position.boughtOn);
  state.date().onChange('2026-01-07');await state.submit();assert.equal(state.saves[0].draft.boughtOn, '2026-01-07');
  const blocked = fixture(position, true);assert.equal(blocked.date().disabled, true);await blocked.submit();assert.equal(blocked.saves.length, 0);
});

test('position fields show short rounded values while unchanged saves retain exact purchase precision', async () => {
  const position = { id: 'existing', kind: 'other', assetId: null, symbol: 'AAPL', name: 'Apple', buyPrice: '7.689000000000', quantity: '2.060000000000', boughtOn: '2026-01-06', manualPrice: '8.125000000001' };
  const state = fixture(position);
  assert.equal(state.field('buyPrice').value, '7.69');
  assert.equal(state.field('quantity').value, '2.06');
  assert.equal(state.field('manualPrice').value, '8.13');
  state.field('buyPrice').onFocus();
  assert.equal(state.field('buyPrice').value, position.buyPrice);
  state.field('buyPrice').onBlur();
  assert.equal(state.field('buyPrice').value, '7.69');
  await state.submit();
  for (const name of ['buyPrice', 'quantity', 'manualPrice']) assert.equal(state.saves[0].draft[name], position[name]);
});

test('editing keeps entered decimals intact and small positive holdings never display as zero', async () => {
  const position = { id: 'existing', kind: 'other', assetId: null, symbol: 'AAPL', name: 'Apple', buyPrice: '1.005000000000', quantity: '0.000000000001', boughtOn: '2026-01-06', manualPrice: '0.000000000000' };
  const state = fixture(position);
  assert.equal(state.field('buyPrice').value, '1.01');
  assert.equal(state.field('quantity').value, position.quantity);
  assert.equal(state.field('manualPrice').value, '0');
  state.field('buyPrice').onFocus();
  state.field('buyPrice').onChange({ target: { value: '12.3400' } });
  assert.equal(state.field('buyPrice').value, '12.3400');
  state.field('buyPrice').onBlur();
  assert.equal(state.field('buyPrice').value, '12.34');
  await state.submit();
  assert.equal(state.saves[0].draft.buyPrice, '12.3400');
  assert.equal(state.saves[0].draft.quantity, position.quantity);
  assert.equal(state.saves[0].draft.manualPrice, position.manualPrice);
});
