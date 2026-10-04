import { resolve } from 'node:path';
export function qaFixturePath(root, fallback, args = process.argv) {
  const choices = args.filter(value => value.startsWith('--fixture-set='));
  if (choices.length > 1) throw Error('Use one QA fixture set.');
  const set = choices[0]?.slice('--fixture-set='.length);
  if (set !== undefined && !/^[a-z][a-z0-9-]{0,47}$/.test(set)) throw Error('Invalid QA fixture-set name.');
  return resolve(root,'.mobile-dev',set ? `fixture-accounts-${set}.json` : fallback);
}
