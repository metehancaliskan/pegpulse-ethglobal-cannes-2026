export type StableSymbol = 'USDC' | 'EURC'

type CoinMarketCapQuoteResponse = {
  data: Record<
    StableSymbol,
    {
      quote: {
        USD: {
          price: number
          percent_change_24h: number
          last_updated: string
        }
      }
    }
  >
}

export type StableQuote = {
  symbol: StableSymbol
  price: number
  percentChange24h: number
  lastUpdated: string
}

export async function getStableQuotes(): Promise<Record<StableSymbol, StableQuote>> {
  const apiKey = process.env.NEXT_PUBLIC_X_CMC_PRO_API_KEY?.trim()

  if (!apiKey) {
    throw new Error('Set NEXT_PUBLIC_X_CMC_PRO_API_KEY in frontend/.env to load live stablecoin prices.')
  }

  const url = new URL('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest')
  url.searchParams.set('symbol', 'USDC,EURC')
  url.searchParams.set('convert', 'USD')

  const response = await fetch(url.toString(), {
    headers: {
      'X-CMC_PRO_API_KEY': apiKey,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`CMC request failed with status ${response.status}.`)
  }

  const payload = (await response.json()) as CoinMarketCapQuoteResponse

  return {
    USDC: {
      symbol: 'USDC',
      price: payload.data.USDC.quote.USD.price,
      percentChange24h: payload.data.USDC.quote.USD.percent_change_24h,
      lastUpdated: payload.data.USDC.quote.USD.last_updated,
    },
    EURC: {
      symbol: 'EURC',
      price: payload.data.EURC.quote.USD.price,
      percentChange24h: payload.data.EURC.quote.USD.percent_change_24h,
      lastUpdated: payload.data.EURC.quote.USD.last_updated,
    },
  }
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
