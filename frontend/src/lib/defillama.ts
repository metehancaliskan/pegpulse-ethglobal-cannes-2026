export type TVLData = {
  symbol: string
  tvl: number
  formattedTVL: string
}

export async function getStablecoinTVL(): Promise<Record<string, TVLData>> {
  const res = await fetch('/api/tvl')

  if (!res.ok) {
    throw new Error('TVL fetch failed.')
  }

  return res.json()
}
