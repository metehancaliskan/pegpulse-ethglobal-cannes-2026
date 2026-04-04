import { NextResponse } from 'next/server'

const DEFILLAMA_IDS = { USDC: 2, EURC: 50 } as const

function formatTVL(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  return `$${value.toLocaleString()}`
}

export async function GET() {
  try {
    const [usdcRes, eurcRes] = await Promise.all([
      fetch(`https://stablecoins.llama.fi/stablecoin/${DEFILLAMA_IDS.USDC}`),
      fetch(`https://stablecoins.llama.fi/stablecoin/${DEFILLAMA_IDS.EURC}`),
    ])

    if (!usdcRes.ok || !eurcRes.ok) {
      return NextResponse.json({ error: 'DefiLlama request failed' }, { status: 502 })
    }

    const [usdcData, eurcData] = await Promise.all([usdcRes.json(), eurcRes.json()])

    const usdcTokens = usdcData.tokens as Array<{ circulating: { peggedUSD?: number } }>
    const eurcTokens = eurcData.tokens as Array<{ circulating: { peggedEUR?: number } }>

    const usdcTVL = usdcTokens[usdcTokens.length - 1]?.circulating?.peggedUSD ?? 0
    const eurcTVL = eurcTokens[eurcTokens.length - 1]?.circulating?.peggedEUR ?? 0

    return NextResponse.json({
      USDC: { symbol: 'USDC', tvl: usdcTVL, formattedTVL: formatTVL(usdcTVL) },
      EURC: { symbol: 'EURC', tvl: eurcTVL, formattedTVL: formatTVL(eurcTVL) },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch TVL data' }, { status: 500 })
  }
}
