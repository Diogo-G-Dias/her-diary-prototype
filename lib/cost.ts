import type { UsageKind } from './types';

// Assumptions from the case doc. Illustrative, not measured.
export const PRICE_PER_M_USD = 0.3; // blended API-equivalent
export const IN_HOUSE_RATIO = 1 / 3;
export const ASSUMPTIONS = {
  exchangesPerMonth: 450,
  boundariesPerMonth: 23,
  blockTokens: 300, // diary block riding every turn
  consolidateIn: 5200,
  consolidateOut: 200,
  openerIn: 2300,
  openerOut: 80,
};

export function callUsage(kind: UsageKind): { tokensIn: number; tokensOut: number; usd: number } {
  const a = ASSUMPTIONS;
  const pick =
    kind === 'consolidate'
      ? { tokensIn: a.consolidateIn, tokensOut: a.consolidateOut }
      : kind === 'opener'
        ? { tokensIn: a.openerIn, tokensOut: a.openerOut }
        : { tokensIn: a.blockTokens, tokensOut: 0 };
  const usd = ((pick.tokensIn + pick.tokensOut) / 1_000_000) * PRICE_PER_M_USD;
  return { ...pick, usd };
}

export function monthlyPerPaidUser() {
  const a = ASSUMPTIONS;
  const consolidations = a.boundariesPerMonth * (a.consolidateIn + a.consolidateOut);
  const openers = a.boundariesPerMonth * (a.openerIn + a.openerOut);
  const blocks = a.exchangesPerMonth * a.blockTokens;
  const tokens = consolidations + openers + blocks;
  const usd = (tokens / 1_000_000) * PRICE_PER_M_USD;
  return { tokens, usd, inHouseUsd: usd * IN_HOUSE_RATIO, consolidations, openers, blocks };
}

export function fmtUsd(n: number, digits = 4): string {
  return `$${n.toFixed(digits)}`;
}

export function fmtTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
