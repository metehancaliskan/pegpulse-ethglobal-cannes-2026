import { NextResponse, type NextRequest } from 'next/server'
import { USYC_DASHBOARD } from '../../../lib/usyc-dashboard'
import { mockQcadQuote, resolveQcadCadUsdAnchor } from '../../../lib/qcad-mock'

const COINGECKO_IDS: Record<string, string> = {
  USDC: 'usd-coin',
  EURC: 'euro-coin',
  BRLA: 'brla-digital-brla',
  JPYC: 'jpy-coin',
  MXNB: 'mxnb',
  AUDF: 'forte-aud',
}

type CoinGeckoEntry = {
  usd?: number
  usd_24h_change?: number
  last_updated_at?: number
}

type CoinGeckoResponse = Record<string, CoinGeckoEntry>

export async function GET(request: NextRequest) {
  const ids = Object.values(COINGECKO_IDS).join(',')
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `CoinGecko request failed: ${res.status}` }, { status: 502 })
    }

    const data = (await res.json()) as CoinGeckoResponse
    const toIso = (unix: number) => new Date(unix * 1000).toISOString()

    const result: Record<string, { symbol: string; price: number; percentChange24h: number; lastUpdated: string }> = {}

    for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
      const entry = data[geckoId]
      if (entry?.usd !== undefined) {
        result[symbol] = {
          symbol,
          price: entry.usd,
          percentChange24h: entry.usd_24h_change ?? 0,
          lastUpdated: toIso(entry.last_updated_at ?? 0),
        }
      }
    }

    const anchor = await resolveQcadCadUsdAnchor(request.nextUrl.origin)
    result.QCAD = { ...mockQcadQuote(anchor) }

    if (!result.USYC) {
      result.USYC = {
        symbol: 'USYC',
        price: USYC_DASHBOARD.headlinePrice,
        percentChange24h: USYC_DASHBOARD.changePct,
        lastUpdated: new Date().toISOString(),
      }
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch price data' }, { status: 500 })
  }
}
