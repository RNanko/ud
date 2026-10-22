import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, hookHarness, jsxRuntime, findNode, plain } from './helpers.mjs';

function fixture(currency, save = async () => {}) {
  const hooks = hookHarness(), drafts = [];
  const entry = { id: 'existing', date: '2026-10-09', amount: '12.34', type: '-', category: 'Food', currency, subcategory: '', comment: '' };
  const Editor = loadModule('app/(main)/account/finance/FinanceEditor.tsx', {
    react: hooks.react, 'react/jsx-runtime': jsxRuntime, '@radix-ui/react-dialog': {}, 'lucide-react': {},
    '@/app/components/ui/button': { Button: 'Button' }, '@/app/components/ui/input': { Input: 'Input' },
    '@/app/components/ui/label': { Label: 'Label' }, '@/app/components/ui/textarea': { Textarea: 'Textarea' },
    '@/types/validators': loadModule('types/validators.ts'), '@/lib/finance': loadModule('lib/finance.ts'),
    './AmountInput': 'Amount', './FinanceSelect': 'Select',
  }, { FormData: class { get(key) { return entry[key]; } } }).default;
  const render = () => hooks.render(() => Editor({ entry, initialType: '-', categories: [], defaultCurrency: 'USD', onSave: async (id, draft) => { await save(); drafts.push({ id, draft: plain(draft) }); }, onClose() {} }));
  const selector = () => findNode(render(), node => node.type === 'Select').props;
  const submit = () => findNode(render(), node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: {} });
  return { render, selector, submit, drafts };
}

test('edit form starts with saved currency and submits a selected currency without converting amount', async () => {
  const state = fixture('USD');
  assert.equal(state.selector().value, 'USD');
  state.selector().onValueChange('EUR');await state.submit();
  assert.deepEqual(state.drafts, [{ id: 'existing', draft: { type: '-', amount: '12.34', date: '2026-10-09', category: 'Food', subcategory: '', comment: '', currency: 'EUR' } }]);
});

test('untouched legacy currencies remain unchanged and can be explicitly assigned or restored in the draft', async () => {
  for (const legacy of [null, 'OLD']) {
    const state = fixture(legacy);
    assert.equal(state.selector().value, legacy ?? '');
    await state.submit();assert.equal(Object.hasOwn(state.drafts[0].draft, 'currency'), false);
    state.selector().onValueChange('NONE');await state.submit();assert.equal(state.drafts[1].draft.currency, 'NONE');
    assert.ok(state.selector().options.some(option => option.value === (legacy ?? '')));
    state.selector().onValueChange(legacy ?? '');await state.submit();assert.equal(Object.hasOwn(state.drafts[2].draft, 'currency'), false);
  }
});

test('currency selection is disabled while saving and its draft survives a failed save', async () => {
  let reject;
  const state = fixture('USD', () => new Promise((resolve, fail) => { reject = fail; }));
  state.selector().onValueChange('GBP');const pending = state.submit();
  assert.equal(state.selector().disabled, true);
  reject(Error('Could not save'));await pending;
  assert.equal(state.selector().value, 'GBP');assert.equal(state.selector().disabled, false);
  assert.equal(findNode(state.render(), node => node.props?.role === 'alert').props.children, 'Could not save');
});
