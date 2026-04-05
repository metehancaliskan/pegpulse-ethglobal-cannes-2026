import { NextResponse, type NextRequest } from 'next/server'
import { createPublicClient, http, parseAbi, formatUnits } from 'viem'
import { mainnet, optimism, polygon } from 'viem/chains'

const FEED_ABI = parseAbi([
  'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
  'function getRoundData(uint80) view returns (uint80, int256, uint256, uint256, uint80)',
  'function decimals() view returns (uint8)',
])

type FeedConfig = {
  address: `0x${string}`
  pair: string
  chain: 'ethereum' | 'optimism' | 'polygon'
}

const FEEDS: Record<string, FeedConfig> = {
  EURC: { address: '0xb49f677943BC038e9857d61E7d053CaA2C1734C1', pair: 'EUR/USD', chain: 'ethereum' },
  JPYC: { address: '0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3', pair: 'JPY/USD', chain: 'ethereum' },
  AUDF: { address: '0x77F9710E7d0A19669A13c055F62cd80d313dF022', pair: 'AUD/USD', chain: 'ethereum' },
  QCAD: { address: '0xa34317DB73e77d453b1B8d04550c44D10e981C8e', pair: 'CAD/USD', chain: 'ethereum' },
  BRLA: { address: '0xB22900D4D0CEa5DB0B3bb08565a9f0f4a831D32C', pair: 'BRL/USD', chain: 'optimism' },
  MXNB: { address: '0x171b16562EA3476F5C61d1b8dad031DbA0768545', pair: 'MXN/USD', chain: 'polygon' },
}

const clients = {
  ethereum: createPublicClient({
    chain: mainnet,
    transport: http(process.env.ETH_RPC_URL || 'https://ethereum-rpc.publicnode.com'),
  }),
  optimism: createPublicClient({
    chain: optimism,
    transport: http('https://optimism-rpc.publicnode.com'),
  }),
  polygon: createPublicClient({
    chain: polygon,
    transport: http('https://polygon-bor-rpc.publicnode.com'),
  }),
}

const THIRTY_DAYS_SEC = 30 * 24 * 60 * 60
const historyCache = new Map<string, { ts: number; data: unknown }>()
const CACHE_TTL = 10 * 60 * 1000

async function fetchHistory(sym: string, feed: FeedConfig) {
  const cacheKey = `history:${sym}`
  const cached = historyCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const client = clients[feed.chain]
  const decimals = Number(await client.readContract({
    address: feed.address, abi: FEED_ABI, functionName: 'decimals',
  }))
  const latestRound = await client.readContract({
    address: feed.address, abi: FEED_ABI, functionName: 'latestRoundData',
  })
  const latestRoundId = latestRound[0]
  const cutoff = Math.floor(Date.now() / 1000) - THIRTY_DAYS_SEC

  const points: Array<{ time: string; price: number; ts: number }> = []
  const latestPrice = Number(formatUnits(latestRound[1], decimals))
  const latestTs = Number(latestRound[3])
  points.push({
    time: new Date(latestTs * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: latestPrice,
    ts: latestTs,
  })

  // Chainlink round IDs encode phaseId in upper bits.
  // Within a phase, rounds are sequential. We walk back one at a time
  // (with batching) to collect unique daily data points.
  const seenDays = new Set<string>()
  seenDays.add(points[0].time)

  // Batch-fetch rounds going backwards, 10 at a time
  let currentId = latestRoundId
  let consecutiveFailures = 0
  const MAX_ROUNDS = 600

  for (let fetched = 0; fetched < MAX_ROUNDS && consecutiveFailures < 10; ) {
    const batchSize = Math.min(10, MAX_ROUNDS - fetched)
    const roundIds: bigint[] = []
    for (let i = 1; i <= batchSize; i++) {
      const rid = currentId - BigInt(i)
      if (rid > 0n) roundIds.push(rid)
    }
    if (roundIds.length === 0) break

    const results = await Promise.allSettled(
      roundIds.map((rid) =>
        client.readContract({
          address: feed.address, abi: FEED_ABI, functionName: 'getRoundData',
          args: [rid],
        })
      ),
    )

    let anySuccess = false
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status !== 'fulfilled') continue
      const roundData = r.value
      const ts = Number(roundData[3])
      if (ts === 0) continue
      if (ts < cutoff) { consecutiveFailures = 999; break }

      anySuccess = true
      const price = Number(formatUnits(roundData[1], decimals))
      const day = new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

      if (!seenDays.has(day)) {
        seenDays.add(day)
        points.push({ time: day, price, ts })
      }
    }

    if (!anySuccess) consecutiveFailures++
    else consecutiveFailures = 0

    currentId = roundIds[roundIds.length - 1]
    fetched += roundIds.length

    if (points.length >= 30) break
  }

  points.sort((a, b) => a.ts - b.ts)
  const finalPoints = points.map(({ time, price }) => ({ time, price }))

  const result = {
    symbol: sym,
    pair: feed.pair,
    chain: feed.chain,
    latestPrice,
    updatedAt: new Date(latestTs * 1000).toISOString(),
    points: finalPoints,
  }
  historyCache.set(cacheKey, { ts: Date.now(), data: result })
  return result
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.toUpperCase()
  const wantHistory = request.nextUrl.searchParams.get('history') === 'true'

  if (symbol && !FEEDS[symbol]) {
    return NextResponse.json({ error: 'No Chainlink feed for this symbol' }, { status: 400 })
  }

  try {
    if (wantHistory && symbol) {
      const data = await fetchHistory(symbol, FEEDS[symbol])
      return NextResponse.json(data)
    }

    // Default: return latest prices for all feeds
    const entries = symbol ? [[symbol, FEEDS[symbol]]] : Object.entries(FEEDS)

    const results: Record<string, {
      symbol: string
      pair: string
      price: number
      chain: string
      updatedAt: string
    }> = {}

    await Promise.all(
      entries.map(async ([sym, feed]) => {
        const f = feed as FeedConfig
        const client = clients[f.chain]
        try {
          const [roundData, decimals] = await Promise.all([
            client.readContract({ address: f.address, abi: FEED_ABI, functionName: 'latestRoundData' }),
            client.readContract({ address: f.address, abi: FEED_ABI, functionName: 'decimals' }),
          ])
          const price = Number(formatUnits(roundData[1], Number(decimals)))
          results[sym as string] = {
            symbol: sym as string,
            pair: f.pair,
            price,
            chain: f.chain,
            updatedAt: new Date(Number(roundData[3]) * 1000).toISOString(),
          }
        } catch {
          // individual feed failure shouldn't break the whole request
        }
      }),
    )

    return NextResponse.json(results)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch Chainlink data' }, { status: 500 })
  }
}
