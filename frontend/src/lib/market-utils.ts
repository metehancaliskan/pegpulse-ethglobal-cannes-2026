import type { MarketView } from './contracts'

export type MarketCategory = 'peg_deviation' | 'geopolitics' | 'liquidity_stress' | 'rwa_risk' | 'other'

export type MarketGroup = {
  symbol: string
  deadline: string
  questionType: string
  category: MarketCategory
  markets: MarketView[]
}

export type MarketDescriptor = {
  symbol: string
  thresholdLabel: string
  deadlineLabel: string
  deadline: Date | null
}

export type PricePoint = { time: string; price: number }
export type TvlPoint = { time: string; tvl: number; tvlFormatted: string }

export const CATEGORY_LABELS: Record<string, { title: string; subtitle: (symbol: string, deadline: string) => string }> = {
  peg_deviation: {
    title: 'Peg Deviation',
    subtitle: (s, d) => `Will ${s} deviate from its peg before ${d}?`,
  },
  geopolitics: {
    title: 'Macro & Geopolitics',
    subtitle: (s, d) => `Will ${s} move >2% on upcoming macro event before ${d}?`,
  },
  liquidity_stress: {
    title: 'Liquidity Stress',
    subtitle: (s, d) => `Will ${s} sustain off-peg for a consecutive window before ${d}?`,
  },
  rwa_risk: {
    title: 'RWA Yield',
    subtitle: (s, d) => `Where will ${s} net yield land by ${d}?`,
  },
  other: {
    title: 'Peg Deviation',
    subtitle: (s, d) => `Will ${s} lose its peg before ${d}?`,
  },
}

function formatDepegDeviationPct(price: number): string {
  const pct = (1 - price) * 100
  const rounded = Math.round(pct * 100) / 100
  if (Number.isInteger(rounded)) return String(rounded)
  const s = pct.toFixed(2).replace(/\.?0+$/, '')
  return s
}

/** Card / detail page title with thresholds in the copy where useful. */
export function getGroupHeadline(group: MarketGroup): string {
  const { symbol, deadline, category, markets } = group
  const first = markets[0]?.description ?? ''

  if (category === 'geopolitics') {
    const geo = getGeoEventSummary(first)
    return geo ? `Will ${geo.replace(/\bdeviates\b/, 'deviate')}?` : CATEGORY_LABELS.geopolitics.subtitle(symbol, deadline)
  }

  if (category === 'rwa_risk') {
    return CATEGORY_LABELS.rwa_risk.subtitle(symbol, deadline)
  }

  if (category === 'liquidity_stress') {
    const band = first.match(/outside\s+([\d.]+)%/i)?.[1]
    const hourM = first.match(/for\s*>\s*([\d.]+)\s*(?:consecutive\s+)?hours?/i)
    const minM = first.match(/for\s*>\s*([\d.]+)\s*(?:consecutive\s+)?minutes?/i)
    const window = hourM
      ? `>${hourM[1]} hour${parseFloat(hourM[1]) > 1 ? 's' : ''}`
      : minM
        ? `>${minM[1]} minutes`
        : 'the required window'
    if (band && markets.length === 1) {
      return `Will ${symbol} trade outside the ${band}% peg band for ${window} before ${deadline}?`
    }
    return CATEGORY_LABELS.liquidity_stress.subtitle(symbol, deadline)
  }

  if (category === 'peg_deviation') {
    if (/\bdepegs?\s+below/i.test(first)) {
      return `Will ${symbol} depeg before ${deadline}?`
    }
    return CATEGORY_LABELS.peg_deviation.subtitle(symbol, deadline)
  }

  if (/\bdepegs?\s+below/i.test(first)) {
    return `Will ${symbol} depeg before ${deadline}?`
  }

  return CATEGORY_LABELS.other.subtitle(symbol, deadline)
}

export function getGeoEventSummary(description: string): string | null {
  if (!description.startsWith('[GEO:')) return null
  const afterBracket = description.replace(/^\[.*?\]\s*/, '')
  const beforeIdx = afterBracket.search(/\bbefore\b/i)
  if (beforeIdx === -1) return afterBracket
  return afterBracket.slice(0, beforeIdx).trim()
}

export function getMarketCategory(description: string): MarketCategory {
  if (description.startsWith('[PEG:')) return 'peg_deviation'
  if (description.startsWith('[GEO:')) return 'geopolitics'
  if (description.startsWith('[LIQ:')) return 'liquidity_stress'
  if (description.startsWith('[RWA:')) return 'rwa_risk'
  if (/\bdepegs?\s+below\s*(\$|€)/i.test(description)) return 'peg_deviation'
  return 'other'
}

export function getMarketDescriptor(description: string, index: number): MarketDescriptor {
  const bracketSymbol = description.match(/^\[(?:PEG|GEO|LIQ):([^:]+):/i)?.[1]?.toUpperCase()
  const stablecoinMatch = description.match(/\b(USDC|USDT|DAI|FDUSD|USDE|FRAX|PYUSD|EURC|BRLA|MXNB|JPYC|QCAD|AUDF|USYC)\b/i)
  const symbol = bracketSymbol ?? stablecoinMatch?.[1]?.toUpperCase() ?? `MKT-${index + 1}`

  const depegBelow = description.match(/\bdepegs?\s+below\s*(\$|€)\s*(\d+(?:\.\d+)?)/i)
  if (depegBelow) {
    const price = parseFloat(depegBelow[2])
    const thresholdLabel = `>${formatDepegDeviationPct(price)}%`
    const beforeMatch = description.match(/before\s+(.+?)(?:\?|$)/i)
    const deadlineCandidate = beforeMatch ? new Date(beforeMatch[1].trim()) : null
    const deadline =
      deadlineCandidate && !Number.isNaN(deadlineCandidate.getTime()) ? deadlineCandidate : null
    return {
      symbol,
      thresholdLabel,
      deadlineLabel: deadline
        ? deadline.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Manual resolution',
      deadline,
    }
  }

  const yieldMatch = description.match(/\[RWA:\w+:yield([<>])(\d+(?:\.\d+)?):/)
  if (yieldMatch) {
    const direction = yieldMatch[1]
    const value = yieldMatch[2]
    const thresholdLabel = `${direction}${value}%`

    const byMatch = description.match(/by\s+(.+?)(?:\?|$)/i)
    const deadlineCandidate = byMatch ? new Date(byMatch[1].trim()) : null
    const deadline =
      deadlineCandidate && !Number.isNaN(deadlineCandidate.getTime()) ? deadlineCandidate : null

    return {
      symbol,
      thresholdLabel,
      deadlineLabel: deadline
        ? deadline.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Manual resolution',
      deadline,
    }
  }

  const percentMatch = description.match(/(\d+(?:\.\d+)?)%/i)
  const currencySymbolMatch = description.match(/\$|EUR/i)
  const priceMatch = description.match(/(?:\$|EUR)(\d+(?:\.\d+)?)/i)

  let thresholdLabel = percentMatch ? `${percentMatch[1]}%` : '1%'

  if (!percentMatch && currencySymbolMatch && priceMatch) {
    const prefix = currencySymbolMatch[0] === '$' ? '$' : '€'
    thresholdLabel = `${prefix}${priceMatch[1]}`
  }

  const beforeMatch = description.match(/before\s+(.+?)(?:\?|$)/i)
  const deadlineCandidate = beforeMatch ? new Date(beforeMatch[1].trim()) : null
  const deadline =
    deadlineCandidate && !Number.isNaN(deadlineCandidate.getTime()) ? deadlineCandidate : null

  return {
    symbol,
    thresholdLabel,
    deadlineLabel: deadline
      ? deadline.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Manual resolution',
    deadline,
  }
}

/** Single-tier rows: hide left % when the headline already states the condition (e.g. liquidity, geo, $ depeg). */
export function shouldHideSingleTierThreshold(group: MarketGroup): boolean {
  if (group.markets.length !== 1) return false
  const d = group.markets[0]?.description ?? ''
  if (group.category === 'liquidity_stress' || group.category === 'geopolitics') return true
  if (/\bdepegs?\s+below\s*(\$|€)/i.test(d)) return true
  return false
}

export function getTimeRemaining(deadline: Date | null) {
  if (!deadline) return 'Manual'

  const remainingMs = deadline.getTime() - Date.now()
  if (remainingMs <= 0) return 'Ready to settle'

  const totalMinutes = Math.floor(remainingMs / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function encodeGroupId(group: MarketGroup): string {
  return encodeURIComponent(`${group.symbol}::${group.deadline}::${group.category}`)
}

/** Single-market deep link id (same key as `groupMarkets` uses). */
export function marketViewToGroupPath(market: MarketView): string {
  const desc = getMarketDescriptor(market.description, 0)
  const category = getMarketCategory(market.description)
  const descUpper = market.description.toUpperCase()
  const questionType =
    descUpper.startsWith('[RWA:') ? 'yield' : descUpper.includes('TVL') ? 'tvl' : descUpper.includes('DEPEG') || descUpper.includes('PEG') ? 'depeg' : 'other'
  return encodeGroupId({
    symbol: desc.symbol,
    deadline: desc.deadlineLabel,
    questionType,
    category,
    markets: [market],
  })
}

export function decodeGroupId(id: string): { symbol: string; deadline: string; category: string } | null {
  try {
    const decoded = decodeURIComponent(id)
    const [symbol, deadline, category] = decoded.split('::')
    if (!symbol || !deadline || !category) return null
    return { symbol, deadline, category }
  } catch {
    return null
  }
}

export function groupMarkets(markets: MarketView[], categoryFilter: MarketCategory | 'all' = 'all', symbolFilter: string | null = null): MarketGroup[] {
  const open = markets.filter((market) => !market.isSettled)
  const filtered = symbolFilter
    ? open.filter((market) => market.description.toUpperCase().includes(symbolFilter.toUpperCase()))
    : open

  const groups: Record<string, MarketGroup> = {}
  for (const market of filtered) {
    const desc = getMarketDescriptor(market.description, 0)
    const category = getMarketCategory(market.description)
    const descUpper = market.description.toUpperCase()
    const questionType = descUpper.startsWith('[RWA:') ? 'yield' : descUpper.includes('TVL') ? 'tvl' : descUpper.includes('DEPEG') || descUpper.includes('PEG') ? 'depeg' : 'other'
    const key = `${desc.symbol}::${desc.deadlineLabel}::${category}`
    if (!groups[key]) {
      groups[key] = { symbol: desc.symbol, deadline: desc.deadlineLabel, questionType, category, markets: [] }
    }
    groups[key].markets.push(market)
  }
  const all = Object.values(groups)
  if (categoryFilter === 'all') return all
  return all.filter((g) => g.category === categoryFilter)
}
