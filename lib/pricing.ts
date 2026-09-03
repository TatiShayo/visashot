/**
 * Pricing — SERVER-SIDE ONLY source of truth. The client sends intent
 * (base spec + which add-ons), NEVER amounts. This module computes the total
 * so add-on math can't be tampered with (PLAYBOOK 2.5 / 4.x).
 */

export const BASE_PRICE_CENTS = 499; // $4.99 core photo set
export const ADDON_SPEC_CENTS = 299; // +$2.99 multi-spec add-on
export const COMPLIANCE_PLUS_CENTS = 199; // +$1.99 order bump

export interface OrderIntent {
  /** How many additional spec formats the customer added. */
  addonSpecCount: number;
  /** The +$1.99 "Compliance+" order bump. */
  compliancePlus: boolean;
}

export interface PriceBreakdown {
  baseCents: number;
  addonSpecCents: number;
  compliancePlusCents: number;
  totalCents: number;
  lines: { label: string; cents: number }[];
}

export function computePrice(intent: OrderIntent): PriceBreakdown {
  const rawAddon = intent && typeof intent === "object" ? intent.addonSpecCount : 0;
  const addonCount = Number.isFinite(rawAddon) ? Math.max(0, Math.floor(rawAddon)) : 0;
  const compliancePlus = Boolean(intent && intent.compliancePlus);
  const addonSpecCents = addonCount * ADDON_SPEC_CENTS;
  const compliancePlusCents = compliancePlus ? COMPLIANCE_PLUS_CENTS : 0;
  const totalCents = BASE_PRICE_CENTS + addonSpecCents + compliancePlusCents;

  const lines = [{ label: "Photo set", cents: BASE_PRICE_CENTS }];
  if (addonCount > 0) {
    lines.push({
      label: `${addonCount} extra format${addonCount > 1 ? "s" : ""}`,
      cents: addonSpecCents,
    });
  }
  if (compliancePlus) {
    lines.push({ label: "Compliance+ (30-day reprocessing)", cents: compliancePlusCents });
  }

  return {
    baseCents: BASE_PRICE_CENTS,
    addonSpecCents,
    compliancePlusCents,
    totalCents,
    lines,
  };
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
