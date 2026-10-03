import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, plain, jsxRuntime, findNode } from './helpers.mjs';

const config = loadModule('lib/account/config.ts');
const offer = loadModule('lib/landing/offer.ts', { '../account/config': config });
const help = loadModule('lib/help/content.ts', { '../landing/offer': offer });

test('landing shows three questions from the complete public answer library and links to Help', () => {
  const FAQ = loadModule('app/components/landing/LandingFAQ.tsx', {
    'react/jsx-runtime': jsxRuntime, 'next/link': 'Link', 'lucide-react': { ArrowUpRight: 'ArrowUpRight' },
    '@/app/components/ui/button': { Button: 'Button' }, '@/lib/help/content': help,
    '../help/QuestionAnswer': 'QuestionAnswer', './LandingProvider': { useLanding: () => ({ trialDays: 7, currency: 'USD' }) },
  }).default;
  const tree = FAQ();
  const questions = tree.props.children[0];
  assert.equal(questions.length, 3);
  assert.deepEqual(plain(questions.map(node => node.props.article.id)), ['about-manforth', 'no-card-trial', 'annual-membership']);
  assert.equal(findNode(tree, node => node.type === 'Link').props.href, '/help');
  assert.match(questions[1].props.article.answer, /7-day/);
  assert.match(questions[2].props.article.answer, /\$10 USD/);
  const articles = help.helpArticles(14);
  assert.equal(articles.length, 12);
  assert.equal(new Set(articles.map(article => article.id)).size, 12);
  for (const article of articles) {
    assert.equal(article.publication, 'published');
    assert.ok(help.helpCategories.some(category => category.id === article.category));
    assert.ok(article.relatedIds.every(id => articles.some(related => related.id === id)));
  }
});

test('answers follow shared trial, regional annual prices and support branding', () => {
  for (const currency of config.billingCurrencies) {
    const articles = help.helpArticles(14, currency);
    assert.ok(articles.find(article => article.id === 'annual-membership').answer.includes(`${offer.annualAmount(currency)} ${currency}`));
    assert.match(articles.find(article => article.id === 'no-card-trial').answer, /14-day.*does not automatically charge/);
    assert.match(articles.find(article => article.id === 'support-and-data').answer, /support-mf@b1-way\.pl/);
  }
});

test('search matches aliases, ignores case and accents, combines words and respects topics', () => {
  const articles = help.helpArticles(14);
  const ids = (query, category) => plain(help.searchHelp(articles, query, category).map(article => article.id));
  assert.deepEqual(ids('  CrÉdIt CARD  '), ['no-card-trial']);
  assert.deepEqual(ids('WEIGHT', 'money'), ['currencies-and-units']);
  assert.deepEqual(ids('WEIGHT', 'privacy'), []);
  assert.deepEqual(ids('credit card nonexistent'), []);
  assert.deepEqual(ids('', 'gym'), ['training-adviser']);
  assert.equal(ids('   ').length, 12);
  assert.deepEqual(ids('unmatchedword'), []);
  const unpublished = { ...articles[0], id: 'private-draft', publication: 'draft' };
  assert.equal(help.searchHelp([...articles, unpublished], '').length, 12);
});
