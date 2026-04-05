import { NextResponse } from 'next/server'

const DEFILLAMA_STABLES: { symbol: string; id: number; pegKey: string }[] = [
  { symbol: 'USDC', id: 2, pegKey: 'peggedUSD' },
  { symbol: 'EURC', id: 50, pegKey: 'peggedEUR' },
  { symbol: 'JPYC', id: 355, pegKey: 'peggedJPY' },
  { symbol: 'BRLA', id: 365, pegKey: 'peggedREAL' },
]

function formatTVL(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${value.toLocaleString()}`
}

export async function GET() {
  try {
    const responses = await Promise.all(
      DEFILLAMA_STABLES.map((s) => fetch(`https://stablecoins.llama.fi/stablecoin/${s.id}`)),
    )

    const result: Record<string, { symbol: string; tvl: number; formattedTVL: string }> = {}

    for (let i = 0; i < DEFILLAMA_STABLES.length; i++) {
      const { symbol, pegKey } = DEFILLAMA_STABLES[i]
      if (!responses[i].ok) continue
      const data = await responses[i].json()
      const tokens = data.tokens as Array<{ circulating: Record<string, number> }>
      const tvl = tokens[tokens.length - 1]?.circulating?.[pegKey] ?? 0
      result[symbol] = { symbol, tvl, formattedTVL: formatTVL(tvl) }
    }

    // DefiLlama stable list omits QCAD; demo TVL in line with small CAD stable scale
    if (!result.QCAD) {
      const tvl = 14_200_000
      result.QCAD = { symbol: 'QCAD', tvl, formattedTVL: formatTVL(tvl) }
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch TVL data' }, { status: 500 })
  }
}
