/** QCAD tracks 1 CAD; USD value ≈ Chainlink CAD/USD. Fallback if oracle fetch fails. */
export const QCAD_FALLBACK_CAD_USD = 0.714

export async function resolveQcadCadUsdAnchor(origin: string): Promise<number> {
  try {
    const res = await fetch(`${origin}/api/chainlink`, { next: { revalidate: 300 } })
    if (!res.ok) return QCAD_FALLBACK_CAD_USD
    const data = (await res.json()) as Record<string, { price?: number }>
    const p = data.QCAD?.price
    return typeof p === 'number' && p > 0.5 && p < 1.25 ? p : QCAD_FALLBACK_CAD_USD
  } catch {
    return QCAD_FALLBACK_CAD_USD
  }
}

/** Tiny synthetic premium/discount vs pure CAD/USD (demo liquidity). */
export function mockQcadQuote(anchorCadUsd: number) {
  const day = Math.floor(Date.now() / 86400000)
  const pegSlip = 0.00012 * Math.sin(day * 0.85)
  const price = anchorCadUsd * (1 + pegSlip)
  const prev = anchorCadUsd * (1 + 0.00012 * Math.sin((day - 1) * 0.85))
  const percentChange24h = prev !== 0 ? ((price - prev) / prev) * 100 : 0
  return {
    symbol: 'QCAD' as const,
    price,
    percentChange24h,
    lastUpdated: new Date().toISOString(),
    pegReferenceUsd: anchorCadUsd,
  }
}

export function mockQcadPriceChartPoints(anchorCadUsd: number): Array<{ time: string; price: number }> {
  const pts: Array<{ time: string; price: number }> = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    const drift = 0.00028 * Math.sin(i * 0.55 + 1.2)
    const pegNoise = 0.0001 * Math.sin(i * 0.88)
    pts.push({
      time: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: anchorCadUsd * (1 + drift + pegNoise),
    })
  }
  return pts
}
