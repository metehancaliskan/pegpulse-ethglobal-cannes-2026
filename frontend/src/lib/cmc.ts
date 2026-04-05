export type StableSymbol = 'USDC' | 'EURC' | 'BRLA' | 'JPYC' | 'MXNB' | 'AUDF' | 'QCAD'

export type StableQuote = {
  symbol: string
  price: number
  percentChange24h: number
  lastUpdated: string
  /** CAD/USD oracle; QCAD peg health = price / pegReferenceUsd vs 1 */
  pegReferenceUsd?: number
}

export async function getStableQuotes(): Promise<Record<string, StableQuote>> {
  const res = await fetch('/api/quotes')

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `CoinGecko quotes request failed: ${res.status}`)
  }

  return res.json()
}

export function getStableHealthScore(price: number) {
  const deviation = Math.abs(1 - price)

  if (deviation <= 0.001) return 100
  if (deviation <= 0.01) return 80
  return 20
}

export function getStableRiskLabel(price: number) {
  const deviation = Math.abs(1 - price)

  if (deviation > 0.01) return 'DE-PEG ALERT'
  if (deviation > 0.001) return 'Moderate Watch'
  return 'Healthy'
}
