import "server-only";
import { accountSql } from "../account/store";
import type { FinanceSnapshot, InvestmentSnapshot } from "./types";

function checkedRevision(value: unknown) {
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0) throw Error("Invalid money revision");
  return revision;
}

// Each view and its revision come from one MVCC snapshot. Reading them separately
// could attach a newer revision to stale values and defeat optimistic concurrency.
export async function readFinanceSnapshot(owner: string): Promise<FinanceSnapshot> {
  const [row] = await accountSql`SELECT
    COALESCE((SELECT revision FROM b1_mobile_finance_versions WHERE user_id=${owner}),0)::text AS revision,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',f.id,'date',to_char(f.date,'YYYY-MM-DD'),
      'amount',f.amount::text,'currency',f.currency,'category',f.category,'subcategory',f.subcategory,'comment',f.comment,'type',CASE WHEN f.type='+' THEN '+' ELSE '-' END)
      ORDER BY f.created_at DESC,f.id) FROM finance_table f WHERE f.user_id=${owner}),'[]'::jsonb) AS entries,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('name',c.name,'type',c.type,'hidden',c.hidden))
      FROM finance_categories c WHERE c.user_id=${owner}),'[]'::jsonb) AS categories`;
  return { revision: checkedRevision(row.revision), entries: row.entries, categories: row.categories };
}

export async function readInvestmentSnapshot(owner: string): Promise<InvestmentSnapshot> {
  const [row] = await accountSql`SELECT
    COALESCE((SELECT revision FROM b1_mobile_investment_versions WHERE user_id=${owner}),0)::text AS revision,
    COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'currency',COALESCE(p.currency,'USD'),'kind',CASE WHEN p.kind='crypto' THEN 'crypto' ELSE 'other' END,'assetId',p.asset_id,
      'symbol',p.symbol,'name',p.name,'buyPrice',p.buy_price::text,'quantity',p.quantity::text,'boughtOn',to_char(p.bought_on,'YYYY-MM-DD'),
      'manualPrice',p.manual_price::text,'manualPriceAt',to_char(p.manual_price_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'archived',p.archived)
      ORDER BY p.bought_on DESC,p.id) FROM investment_positions p WHERE p.user_id=${owner}),'[]'::jsonb) AS positions`;
  return { revision: checkedRevision(row.revision), positions: row.positions };
}
