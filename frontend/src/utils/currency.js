/**
 * Display currency for money amounts (single-tenant deployment, LKR).
 * One constant so a future per-client change touches exactly one line —
 * the backend equivalent lives on inv_locations.base_currency.
 */
export const CURRENCY = 'Rs'
