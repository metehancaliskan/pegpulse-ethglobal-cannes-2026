'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Area, CartesianGrid, ComposedChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ExternalLink } from 'lucide-react'
import { TokenBadge } from './TokenBadge'
import { CATEGORY_LABELS, getGroupHeadline, getMarketDescriptor, shouldHideSingleTierThreshold } from '../lib/market-utils'
import { USYC_DASHBOARD, getUsycStaticChartPoints, sliceUsycChartByRange, type UsycChartRange } from '../lib/usyc-dashboard'
import { formatAmount } from '../lib/contracts'
import { PositionExitControls } from './PositionExitControls'
import type { ChainlinkPrice } from '../App'
import type { MarketGroup, PricePoint } from '../lib/market-utils'

type MarketDetailProps = {
  group: MarketGroup
  isOwner: boolean
  isBusy: boolean
  priceData: PricePoint[]
  chainlinkPrice?: ChainlinkPrice
  currentPrice: string
  onBet: (marketAddress: string, side: 'win' | 'lose', amount: string) => Promise<void>
  onSettle: (marketAddress: string, outcome: 1 | 2 | 3) => Promise<void>
  onWithdraw: (marketAddress: string) => Promise<void>
  isConnected?: boolean
  onExitStake?: (marketAddress: string, onWinSide: boolean, amountEther: string) => void | Promise<void>
}

export function MarketDetail({
  group,
  isOwner,
  isBusy,
  priceData,
  chainlinkPrice,
  currentPrice,
  onBet,
  onSettle,
  onWithdraw,
  isConnected,
  onExitStake,
}: MarketDetailProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [amount, setAmount] = useState('0.05')
  const [selectedSide, setSelectedSide] = useState<'win' | 'lose'>('win')
  const [usycRange, setUsycRange] = useState<UsycChartRange>('all')

  const isUsycRwa = group.category === 'rwa_risk' && group.symbol === 'USYC'
  const hideTierCol = shouldHideSingleTierThreshold(group)

  const tiers = group.markets.map((market, i) => {
    const desc = getMarketDescriptor(market.description, i)
    const pool = market.totalWinBets + market.totalLoseBets
    const yesPrice = pool > 0n ? Number(market.totalWinBets) / Number(pool) : 0.5
    const noPrice = pool > 0n ? Number(market.totalLoseBets) / Number(pool) : 0.5
    return { market, desc, pool, yesPrice, noPrice }
  })

  const selected = tiers[selectedIndex]
  if (!selected) return null

  const totalVolume = tiers.reduce((sum, t) => sum + t.pool, 0n)
  const categoryLabel = CATEGORY_LABELS[group.category]

  const FEE_BPS = 1000n
  const amountWei = (() => {
    try {
      const parsed = parseFloat(amount)
      if (isNaN(parsed) || parsed <= 0) return 0n
      return BigInt(Math.floor(parsed * 1e18))
    } catch {
      return 0n
    }
  })()
  const afterFee = amountWei - amountWei / FEE_BPS

  const potentialPayout = (() => {
    if (afterFee <= 0n) return 0
    if (selectedSide === 'win') {
      const newPool = selected.market.totalWinBets + afterFee
      const newTotal = selected.pool + afterFee
      return Number(newTotal) * Number(afterFee) / Number(newPool) / 1e18
    } else {
      const newPool = selected.market.totalLoseBets + afterFee
      const newTotal = selected.pool + afterFee
      return Number(newTotal) * Number(afterFee) / Number(newPool) / 1e18
    }
  })()

  const betAmountNum = parseFloat(amount) || 0
  const profit = potentialPayout - betAmountNum
  const QUICK_AMOUNTS = ['0.01', '0.05', '0.1', '0.5', '1']

  const chartData = useMemo(() => {
    if (isUsycRwa) return null
    if (priceData.length === 0) return null
    const clPoints = chainlinkPrice?.points ?? []
    const clMap = new Map(clPoints.map((p) => [p.time, p.price]))
    const merged = priceData.map((p) => ({
      time: p.time,
      dexPrice: p.price,
      oraclePrice: clMap.get(p.time) as number | undefined,
    }))
    if (clPoints.length > 0 && merged.every((d) => d.oraclePrice === undefined)) {
      const clFirst = clPoints[0]
      const clLast = clPoints[clPoints.length - 1]
      if (merged.length > 0) {
        merged[0].oraclePrice = clFirst?.price
        merged[merged.length - 1].oraclePrice = clLast?.price
      }
    }
    const allPrices = merged.flatMap((d) => [d.dexPrice, d.oraclePrice].filter((v): v is number => v !== undefined))
    const yMin = Math.min(...allPrices) * 0.998
    const yMax = Math.max(...allPrices) * 1.002
    return { merged, yMin, yMax }
  }, [priceData, chainlinkPrice, isUsycRwa])

  const usycSeries = useMemo(() => {
    if (!isUsycRwa) return []
    return priceData.length > 0 ? priceData : getUsycStaticChartPoints()
  }, [isUsycRwa, priceData])

  const usycDisplayed = useMemo(
    () => (isUsycRwa ? sliceUsycChartByRange(usycSeries, usycRange) : []),
    [isUsycRwa, usycSeries, usycRange],
  )

  const usycYDomain = useMemo(() => {
    if (usycDisplayed.length === 0) return { yMin: 1.07, yMax: 1.13 }
    const vals = usycDisplayed.map((p) => p.price)
    const lo = Math.min(...vals)
    const hi = Math.max(...vals)
    const pad = (hi - lo) * 0.08 || 0.002
    return { yMin: lo - pad, yMax: hi + pad }
  }, [usycDisplayed])

  return (
    <div className="grid gap-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-[24px] p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <TokenBadge symbol={group.symbol} size="lg" />
            <div>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {categoryLabel?.title ?? 'Market'}
              </span>
              <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">
                {getGroupHeadline(group)}
              </h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">Total Volume</p>
            <p className="text-xl font-bold text-slate-900">{formatAmount(totalVolume)} USDC</p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        {/* Left column: charts + tiers */}
        <div className="grid gap-6">
          {/* Price chart with Chainlink overlay */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-card overflow-hidden rounded-[20px]"
          >
            {isUsycRwa ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/60 px-5 py-4">
                  <div>
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-muted">USYC price</p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-3">
                      <span className="text-2xl font-bold tracking-tight text-[#002855]">
                        ${USYC_DASHBOARD.headlinePrice.toFixed(6)}
                      </span>
                      <span className="text-sm font-semibold text-emerald-600">
                        ↑ {USYC_DASHBOARD.changePct}%
                      </span>
                    </div>
                  </div>
                  <div className="flex rounded-xl border border-slate-200/80 bg-slate-100/70 p-1">
                    {(
                      [
                        { id: '1w' as const, label: '1W' },
                        { id: '1m' as const, label: '1M' },
                        { id: 'all' as const, label: 'ALL' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setUsycRange(tab.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          usycRange === tab.id
                            ? 'bg-[#002855] text-white shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="px-5 py-4">
                  <div className="h-52 min-h-[208px] w-full min-w-0">
                    {usycDisplayed.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
                        <LineChart data={usycDisplayed} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis
                            dataKey="time"
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            interval="preserveStartEnd"
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            domain={[usycYDomain.yMin, usycYDomain.yMax]}
                            tickFormatter={(v) => `$${Number(v).toFixed(4)}`}
                            width={58}
                            tick={{ fontSize: 10, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null
                              const v = payload[0]?.value
                              const n = typeof v === 'number' ? v : Number(v)
                              return (
                                <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-sm">
                                  <p className="mb-1 text-[10px] font-medium text-muted">{String(label)}</p>
                                  <p className="font-semibold text-slate-900">${Number.isFinite(n) ? n.toFixed(6) : '—'}</p>
                                </div>
                              )
                            }}
                          />
                          <Line type="monotone" dataKey="price" stroke="#9b87f0" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#9b87f0' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted">Loading...</div>
                    )}
                  </div>
                </div>
                <p className="px-5 pb-1 text-center text-[10px] text-muted">
                  Illustrative snapshot for demo — not a live market-data feed.
                </p>
                <div className="grid gap-3 border-t border-slate-200/60 px-5 py-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200/70 bg-white/90 px-4 py-3 shadow-sm">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted">Estimated gross yield</p>
                    <p className="mt-1 text-xl font-bold text-[#002855]">{USYC_DASHBOARD.grossYieldPct}%</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-white/90 px-4 py-3 shadow-sm">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted">Estimated net yield</p>
                    <p className="mt-1 text-xl font-bold text-[#002855]">{USYC_DASHBOARD.netYieldPct}%</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-white/90 px-4 py-3 shadow-sm sm:col-span-1">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-muted">Assets under management</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-[#002855] sm:text-xl">
                      ${USYC_DASHBOARD.aumUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 px-5 py-3">
                  <div className="flex items-center gap-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
                      {group.category === 'rwa_risk'
                        ? `${group.symbol} Yield & Price`
                        : `${group.symbol} Price (30d)`}
                    </p>
                    {chainlinkPrice && (
                      <div className="flex items-center gap-2">
                        <span className="h-px w-4 bg-amber-500" />
                        <span className="text-[10px] font-medium text-amber-600">
                          Chainlink {chainlinkPrice.pair} Oracle
                        </span>
                      </div>
                    )}
                  </div>
                  {chainlinkPrice && (() => {
                    const lastDex = priceData.length > 0 ? priceData[priceData.length - 1].price : null
                    if (lastDex === null) return null
                    const deviation = ((lastDex - chainlinkPrice.price) / chainlinkPrice.price) * 100
                    const absDeviation = Math.abs(deviation)
                    const deviationColor = absDeviation > 2 ? 'bg-rose-100 text-rose-700 border-rose-200'
                      : absDeviation > 0.5 ? 'bg-amber-100 text-amber-700 border-amber-200'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    return (
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${deviationColor}`}>
                        {deviation >= 0 ? '+' : ''}{deviation.toFixed(2)}% deviation
                      </span>
                    )
                  })()}
                </div>
                <div className="px-5 py-4">
                  <div className="h-48 min-h-[192px]">
                    {chartData ? (
                      <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={180}>
                        <ComposedChart data={chartData.merged}>
                          <defs>
                            <linearGradient id={`det-price-g-${group.symbol}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0033AD" stopOpacity={0.12} />
                              <stop offset="100%" stopColor="#0033AD" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <YAxis domain={[chartData.yMin, chartData.yMax]} hide />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null
                              const dex = payload.find((p) => p.dataKey === 'dexPrice')
                              const oracle = payload.find((p) => p.dataKey === 'oraclePrice')
                              return (
                                <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
                                  <p className="mb-1.5 text-[10px] font-medium text-muted">{label}</p>
                                  {dex?.value != null && (
                                    <p className="flex items-center gap-1.5 text-xs">
                                      <span className="inline-block h-2 w-2 rounded-full bg-[#0033AD]" />
                                      <span className="text-muted">DEX:</span>
                                      <span className="font-semibold text-slate-900">${Number(dex.value).toFixed(6)}</span>
                                    </p>
                                  )}
                                  {oracle?.value != null && (
                                    <p className="flex items-center gap-1.5 text-xs">
                                      <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                                      <span className="text-muted">Oracle:</span>
                                      <span className="font-semibold text-amber-700">${Number(oracle.value).toFixed(6)}</span>
                                    </p>
                                  )}
                                  {dex?.value != null && oracle?.value != null && (() => {
                                    const dev = ((Number(dex.value) - Number(oracle.value)) / Number(oracle.value)) * 100
                                    const color = Math.abs(dev) > 2 ? 'text-rose-600' : Math.abs(dev) > 0.5 ? 'text-amber-600' : 'text-emerald-600'
                                    return <p className={`mt-1 text-[10px] font-semibold ${color}`}>{dev >= 0 ? '+' : ''}{dev.toFixed(3)}% deviation</p>
                                  })()}
                                </div>
                              )
                            }}
                          />
                          <Area type="monotone" dataKey="dexPrice" stroke="#0033AD" strokeWidth={2} fill={`url(#det-price-g-${group.symbol})`} dot={false} connectNulls />
                          <Line type="monotone" dataKey="oraclePrice" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted">Loading...</div>
                    )}
                  </div>
                </div>
                {chainlinkPrice && (
                  <div className="flex flex-wrap items-center gap-4 border-t border-slate-200/60 px-5 py-2.5 text-[10px] text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-[#0033AD]" />
                      {group.symbol === 'QCAD' ? 'Simulated spot (vs CAD/USD)' : 'DEX spot price (CoinGecko)'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-4 border-t-2 border-dashed border-amber-500" />
                      Chainlink {chainlinkPrice.pair} Oracle — {chainlinkPrice.chain === 'optimism' ? 'Optimism' : chainlinkPrice.chain === 'polygon' ? 'Polygon' : 'Ethereum'}
                    </span>
                    <a
                      href={`https://data.chain.link/feeds/${chainlinkPrice.chain === 'optimism' ? 'optimism' : chainlinkPrice.chain === 'polygon' ? 'polygon' : 'ethereum'}/mainnet/${chainlinkPrice.pair.toLowerCase().replace('/', '-')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group ml-auto inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold leading-none text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:ring-2 focus-visible:ring-cyan/35 focus-visible:ring-offset-2"
                    >
                      <span className="whitespace-nowrap">View feed on Chainlink</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-hover:text-slate-700" aria-hidden />
                    </a>
                  </div>
                )}
              </>
            )}
          </motion.div>

          {/* Tier list */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card overflow-hidden rounded-[20px]"
          >
            <div className="border-b border-slate-200/60 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Outcomes</p>
            </div>
            <div className="divide-y divide-slate-100">
              {tiers.map((tier, index) => {
                const isActive = index === selectedIndex
                const yesPercent = (tier.yesPrice * 100).toFixed(0)
                const noPercent = (tier.noPrice * 100).toFixed(0)
                return (
                  <div
                    key={tier.market.address}
                    className={`flex w-full items-center gap-4 px-5 py-4 text-left transition ${
                      isActive ? 'bg-cyan/5' : 'hover:bg-slate-50'
                    } ${hideTierCol ? 'justify-between' : ''}`}
                  >
                    {!hideTierCol ? (
                      <button
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                        className="w-24 shrink-0 rounded-lg py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan/40 focus-visible:ring-offset-2 -ml-1 pl-1 pr-1"
                      >
                        <p className="text-sm font-semibold text-slate-900">{tier.desc.thresholdLabel}</p>
                        <p className="text-xs text-muted">
                          {isUsycRwa
                            ? `$${USYC_DASHBOARD.headlinePrice.toFixed(6)} · Net ${USYC_DASHBOARD.netYieldPct}%`
                            : currentPrice}
                        </p>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                        className="min-w-0 flex-1 rounded-lg py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan/40 focus-visible:ring-offset-2 -ml-1 pl-1 pr-2"
                      >
                        <p className="text-sm font-semibold text-slate-900">{tier.desc.thresholdLabel}</p>
                      </button>
                    )}

                    <div className={`flex shrink-0 gap-2 ${hideTierCol ? '' : 'ml-auto'}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIndex(index)
                          setSelectedSide('win')
                        }}
                        className={`flex min-w-[5rem] flex-col items-center rounded-xl border px-3 py-2 transition ${
                          isActive && selectedSide === 'win'
                            ? 'border-emerald-500 bg-emerald-100/90 shadow-sm ring-2 ring-emerald-400/40'
                            : 'border-emerald-200/90 bg-emerald-50/80 hover:border-emerald-400'
                        }`}
                      >
                        <span className="text-xs font-bold text-emerald-700">{yesPercent}¢</span>
                        <span className="text-[11px] font-semibold text-emerald-900">Yes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIndex(index)
                          setSelectedSide('lose')
                        }}
                        className={`flex min-w-[5rem] flex-col items-center rounded-xl border px-3 py-2 transition ${
                          isActive && selectedSide === 'lose'
                            ? 'border-rose-500 bg-rose-100/90 shadow-sm ring-2 ring-rose-400/40'
                            : 'border-rose-200/90 bg-rose-50/80 hover:border-rose-400'
                        }`}
                      >
                        <span className="text-xs font-bold text-rose-700">{noPercent}¢</span>
                        <span className="text-[11px] font-semibold text-rose-900">No</span>
                      </button>
                    </div>

                    <span className="shrink-0 text-xs text-muted">{formatAmount(tier.pool)} vol.</span>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>

        {/* Right column: Trade panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card self-start rounded-[20px] p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
            {isUsycRwa
              ? `Yield ${selected.desc.thresholdLabel}`
              : group.category === 'liquidity_stress'
                ? 'Liquidity stress'
                : hideTierCol
                  ? 'Outcomes'
                  : `${selected.desc.thresholdLabel} threshold`}
          </p>

          {isConnected && onExitStake && (
            <PositionExitControls
              market={selected.market}
              isBusy={isBusy}
              onExit={(onWinSide, amountEther) => void onExitStake(selected.market.address, onWinSide, amountEther)}
            />
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedSide('win')}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                selectedSide === 'win'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'border border-slate-200/80 bg-white/80 text-slate-600 hover:border-emerald-300'
              }`}
            >
              <span className={`text-xs font-bold ${selectedSide === 'win' ? 'text-white/90' : 'text-emerald-700'}`}>
                {(selected.yesPrice * 100).toFixed(0)}¢
              </span>
              <span>Yes</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedSide('lose')}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                selectedSide === 'lose'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'border border-slate-200/80 bg-white/80 text-slate-600 hover:border-rose-300'
              }`}
            >
              <span className={`text-xs font-bold ${selectedSide === 'lose' ? 'text-white/90' : 'text-rose-700'}`}>
                {(selected.noPrice * 100).toFixed(0)}¢
              </span>
              <span>No</span>
            </button>
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-muted">Amount</label>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-lg font-semibold text-slate-900 outline-none transition focus:border-cyan/40"
              placeholder="0.00"
            />
          </div>

          <div className="mt-2 flex gap-1.5">
            {QUICK_AMOUNTS.map((qa) => (
              <button
                key={qa}
                type="button"
                onClick={() => setAmount(qa)}
                className="flex-1 rounded-lg border border-slate-200/80 bg-white/80 py-1 text-[11px] font-medium text-slate-600 transition hover:border-cyan/30 hover:text-cyan"
              >
                +{qa}
              </button>
            ))}
          </div>

          {betAmountNum > 0 && (
            <div className="mt-3 rounded-xl border border-slate-200/60 bg-slate-50/80 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">To win</span>
                <span className="text-base font-bold text-emerald-600">
                  {potentialPayout.toFixed(4)} USDC
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-muted">Profit</span>
                <span className={`text-xs font-semibold ${profit > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                  +{profit.toFixed(4)} ({betAmountNum > 0 ? ((profit / betAmountNum) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => void onBet(selected.market.address, selectedSide, amount)}
            disabled={selected.market.isSettled || isBusy || betAmountNum <= 0}
            className={`mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 ${
              selectedSide === 'win'
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'bg-rose-500 text-white hover:bg-rose-600'
            }`}
          >
            {selectedSide === 'win' ? 'Buy Yes' : 'Buy No'}
          </button>

          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-emerald-50 px-2 py-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">Yes Pool</p>
              <p className="text-xs font-semibold text-slate-900">{formatAmount(selected.market.totalWinBets)}</p>
            </div>
            <div className="rounded-xl bg-rose-50 px-2 py-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-rose-600">No Pool</p>
              <p className="text-xs font-semibold text-slate-900">{formatAmount(selected.market.totalLoseBets)}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {isOwner && !selected.market.isSettled && (
              <>
                <MiniButton label="Settle Yes" onClick={() => void onSettle(selected.market.address, 1)} disabled={isBusy} />
                <MiniButton label="Settle No" onClick={() => void onSettle(selected.market.address, 2)} disabled={isBusy} />
                <MiniButton label="Invalid" onClick={() => void onSettle(selected.market.address, 3)} disabled={isBusy} />
              </>
            )}
            <MiniButton
              label="Claim payout"
              onClick={() => void onWithdraw(selected.market.address)}
              disabled={!selected.market.isSettled || isBusy}
            />
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function MiniButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-900 transition hover:border-cyan/30 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}
