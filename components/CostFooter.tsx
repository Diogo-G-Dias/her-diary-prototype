'use client';

import { useState } from 'react';
import { useDemo } from '@/lib/DemoContext';
import { ASSUMPTIONS, PRICE_PER_M_USD, fmtTokens, fmtUsd, monthlyPerPaidUser } from '@/lib/cost';
import styles from './CostFooter.module.css';

const LABEL: Record<string, string> = { consolidate: 'consolidate', opener: 'opener', reply: 'diary block' };

export default function CostFooter() {
  const { usageLog } = useDemo();
  const [open, setOpen] = useState(false);
  const m = monthlyPerPaidUser();
  const recent = usageLog.slice(-4).reverse();
  const sessionUsd = usageLog.reduce((s, u) => s + u.usd, 0);

  return (
    <footer className={styles.footer}>
      <div className={styles.row}>
        <span className={styles.head}>Cost</span>
        <div className={styles.calls} aria-live="polite">
          {recent.length === 0 && <span className={styles.muted}>No calls yet. Each fake call logs its tokens here.</span>}
          {recent.map((u) => (
            <span key={u.id} className={styles.call}>
              <b>{LABEL[u.kind]}</b> {fmtTokens(u.tokensIn)} in{u.tokensOut ? ` / ${u.tokensOut} out` : ''} · {fmtUsd(u.usd, 5)}
            </span>
          ))}
          {usageLog.length > 0 && <span className={styles.muted}>session {fmtUsd(sessionUsd, 4)}</span>}
        </div>
        <button type="button" className={styles.monthly} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span>
            ≈ <b>{fmtUsd(m.usd, 2)}</b> per paid user per month
          </span>
          <small>illustrative, from the assumptions in the doc {open ? '▴' : '▾'}</small>
        </button>
      </div>
      {open && (
        <div className={styles.detail}>
          <code>
            ({ASSUMPTIONS.boundariesPerMonth} consolidations × {fmtTokens(ASSUMPTIONS.consolidateIn + ASSUMPTIONS.consolidateOut)} +{' '}
            {ASSUMPTIONS.boundariesPerMonth} openers × {fmtTokens(ASSUMPTIONS.openerIn + ASSUMPTIONS.openerOut)} +{' '}
            {ASSUMPTIONS.exchangesPerMonth} turns × {ASSUMPTIONS.blockTokens}-token block) = {fmtTokens(m.tokens)} tokens ×{' '}
            {fmtUsd(PRICE_PER_M_USD, 2)}/M = {fmtUsd(m.usd, 3)}
          </code>
          <span className={styles.muted}>
            In-house inference at about a third: {fmtUsd(m.inHouseUsd, 3)}. One job per conversation boundary, one capped page, so the
            cost is flat with tenure.
          </span>
        </div>
      )}
    </footer>
  );
}
