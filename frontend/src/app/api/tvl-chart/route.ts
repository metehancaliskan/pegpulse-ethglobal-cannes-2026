import { NextResponse, type NextRequest } from 'next/server'

const DEFILLAMA_IDS: Record<string, number> = { USDC: 2, EURC: 50 }
const PEGGED_KEYS: Record<string, string> = { USDC: 'peggedUSD', EURC: 'peggedEUR' }

function formatTVL(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return `$${value.toLocaleString()}`
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.toUpperCase()

  if (!symbol || !DEFILLAMA_IDS[symbol]) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://stablecoins.llama.fi/stablecoin/${DEFILLAMA_IDS[symbol]}`)
    if (!res.ok) {
      return NextResponse.json({ error: 'DefiLlama request failed' }, { status: 502 })
    }

    const data = await res.json()
    const tokens: Array<{ date: number; circulating: Record<string, number> }> = data.tokens ?? []
    const peggedKey = PEGGED_KEYS[symbol] ?? 'peggedUSD'

    // Last 30 data points
    const recent = tokens.slice(-30)
    const points = recent.map((t) => ({
      time: new Date(t.date * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      tvl: t.circulating?.[peggedKey] ?? 0,
      tvlFormatted: formatTVL(t.circulating?.[peggedKey] ?? 0),
    }))

    return NextResponse.json({ symbol, points })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch TVL chart data' }, { status: 500 })
  }
}
