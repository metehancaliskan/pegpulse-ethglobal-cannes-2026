import { NextResponse, type NextRequest } from 'next/server'
import { getUsycStaticChartPoints } from '../../../lib/usyc-dashboard'
import { mockQcadPriceChartPoints, resolveQcadCadUsdAnchor } from '../../../lib/qcad-mock'

const COIN_IDS: Record<string, string> = {
  USDC: 'coingecko:usd-coin',
  EURC: 'coingecko:euro-coin',
  BRLA: 'coingecko:brla-digital-brla',
  JPYC: 'coingecko:jpy-coin',
  MXNB: 'coingecko:mxnb',
  AUDF: 'coingecko:forte-aud',
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.toUpperCase()

  if (!symbol) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }

  if (symbol === 'USYC') {
    return NextResponse.json({ symbol, points: getUsycStaticChartPoints() })
  }

  if (!COIN_IDS[symbol]) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }

  try {
    if (symbol === 'QCAD') {
      const anchor = await resolveQcadCadUsdAnchor(request.nextUrl.origin)
      const points = mockQcadPriceChartPoints(anchor)
      return NextResponse.json({ symbol, points })
    }

    const res = await fetch(
      `https://coins.llama.fi/chart/${COIN_IDS[symbol]}?span=30&period=1d`,
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
