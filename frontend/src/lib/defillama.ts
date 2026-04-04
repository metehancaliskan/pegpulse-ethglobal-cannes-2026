import type { StableSymbol } from './cmc'

export type TVLData = {
  symbol: StableSymbol
  tvl: number
  formattedTVL: string
}

export async function getStablecoinTVL(): Promise<Record<StableSymbol, TVLData>> {
  const res = await fetch('/api/tvl')

  if (!res.ok) {
    throw new Error('TVL fetch failed.')
  }

  return res.json()
}
