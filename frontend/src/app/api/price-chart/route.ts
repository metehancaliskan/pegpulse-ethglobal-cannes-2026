import { NextResponse, type NextRequest } from 'next/server'

const COIN_IDS: Record<string, string> = {
  USDC: 'coingecko:usd-coin',
  EURC: 'coingecko:euro-coin',
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.toUpperCase()

  if (!symbol || !COIN_IDS[symbol]) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `https://coins.llama.fi/chart/${COIN_IDS[symbol]}?span=30&period=4h`,
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'DefiLlama request failed' }, { status: 502 })
    }

    const data = await res.json()
    const coins = data.coins ?? {}
    const coinData = coins[COIN_IDS[symbol]]
    const prices: Array<{ timestamp: number; price: number }> = coinData?.prices ?? []

    const points = prices.map((p) => ({
      time: new Date(p.timestamp * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      price: p.price,
    }))

    return NextResponse.json({ symbol, points })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch price data' }, { status: 500 })
  }
}
