import type { PricePoint } from './market-utils'

/** Illustrative snapshot aligned with Hashnote / USYC marketing materials (not a live feed). */
export const USYC_DASHBOARD = {
  headlinePrice: 1.121086,
  changePct: 4.49,
  grossYieldPct: 3.53,
  netYieldPct: 3.18,
  aumUsd: 2_702_562_174.28,
} as const

export type UsycChartRange = '1w' | '1m' | 'all'

export function getUsycStaticChartPoints(): PricePoint[] {
  const startMs = Date.UTC(2025, 0, 3, 12, 0, 0)
  const endMs = Date.UTC(2026, 3, 5, 12, 0, 0)
  const segments = 55
  const p0 = 1.0729
  const p1 = USYC_DASHBOARD.headlinePrice
  const out: PricePoint[] = []
  for (let i = 0; i <= segments; i++) {
    const t = startMs + ((endMs - startMs) * i) / segments
    const price = p0 + ((p1 - p0) * i) / segments
    out.push({
      time: new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price,
    })
  }
  return out
}

export function sliceUsycChartByRange(points: PricePoint[], range: UsycChartRange): PricePoint[] {
  if (range === 'all' || points.length === 0) return points
  const take = range === '1w' ? 8 : 30
  return points.slice(-Math.min(take, points.length))
}
