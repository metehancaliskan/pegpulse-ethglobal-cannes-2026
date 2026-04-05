'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight, Briefcase, ChevronLeft, Clock, History, Trophy, X } from 'lucide-react'
import type { Address } from 'viem'
import { useApp } from '../../App'
import {
  exitOpenStake,
  formatAmount,
  outcomeLabel,
  publicClient,
  withdrawWinnings,
  type MarketOutcome,
  type MarketView,
} from '../../lib/contracts'
import { CATEGORY_LABELS, getMarketCategory, getMarketDescriptor, marketViewToGroupPath } from '../../lib/market-utils'
import { fetchUserSideStakeTotals, settledResultLabel } from '../../lib/portfolio-events'
import { PositionExitControls } from '../../components/PositionExitControls'
import { TokenBadge } from '../../components/TokenBadge'

const FETCH_CONCURRENCY = 6

async function loadAllSideStakeTotals(
  markets: MarketView[],
  wallet: Address,
): Promise<Map<string, { yesGross: bigint; noGross: bigint }>> {
  const map = new Map<string, { yesGross: bigint; noGross: bigint }>()
  for (let i = 0; i < markets.length; i += FETCH_CONCURRENCY) {
    const slice = markets.slice(i, i + FETCH_CONCURRENCY)
    const rows = await Promise.all(
      slice.map(async (m) => {
        const t = await fetchUserSideStakeTotals(publicClient, m.address as Address, wallet)
        return { address: m.address, ...t }
      }),
    )
    for (const r of rows) {
      map.set(r.address.toLowerCase(), { yesGross: r.yesGross, noGross: r.noGross })
    }
  }
  return map
}

export default function PortfolioPage() {
  const {
    markets,
    isLoading,
    isConnected,
    address,
    claimableMarkets,
    executeAction,
    actionLoading,
  } = useApp()

  const [chainStakeTotals, setChainStakeTotals] = useState<Map<string, { yesGross: bigint; noGross: bigint }> | null>(
    null,
  )
  const [historyLoading, setHistoryLoading] = useState(false)
  const [sellModalMarket, setSellModalMarket] = useState<MarketView | null>(null)

  const refreshTotals = useCallback(async () => {
    if (!address || !isConnected || markets.length === 0) {
      setChainStakeTotals(new Map())
      return
    }
    setHistoryLoading(true)
    try {
      const m = await loadAllSideStakeTotals(markets, address as Address)
      setChainStakeTotals(m)
    } finally {
      setHistoryLoading(false)
    }
  }, [address, isConnected, markets])

  useEffect(() => {
    void refreshTotals()
  }, [refreshTotals])

  useEffect(() => {
    if (!sellModalMarket) return
    const m = markets.find((x) => x.address.toLowerCase() === sellModalMarket.address.toLowerCase())
    if (m && (m.isSettled || (m.userWinBet === 0n && m.userLoseBet === 0n))) {
      setSellModalMarket(null)
    }
  }, [markets, sellModalMarket])

  const openPositions = useMemo(
    () =>
      markets.filter(
        (m) => !m.isSettled && (m.userWinBet > 0n || m.userLoseBet > 0n),
      ),
    [markets],
  )

  const historyRows = useMemo(() => {
    if (!chainStakeTotals) return []
    return markets.filter((m) => {
      if (!m.isSettled) return false
      const key = m.address.toLowerCase()
      const t = chainStakeTotals.get(key)
      if (!t) return false
      return t.yesGross > 0n || t.noGross > 0n
    })
  }, [markets, chainStakeTotals])

  const atStake = useMemo(
    () =>
      openPositions.reduce((s, m) => s + m.userWinBet + m.userLoseBet, 0n),
    [openPositions],
  )

  const unclaimedCount = claimableMarkets.length

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-[24px] px-8 py-16 text-center"
        >
          <Briefcase className="mx-auto h-12 w-12 text-slate-300" />
          <h1 className="mt-4 font-display text-xl font-bold text-slate-900">Portfolio</h1>
          <p className="mt-2 text-sm text-muted">
            Connect your wallet to see open positions, claims, and settlement history.
          </p>
          <p className="mt-6 text-xs text-muted">
            History is rebuilt from your on-chain funding logs on each market, so past rounds stay visible after you
            claim.
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Markets
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-slate-900">Portfolio</h1>
            <p className="mt-1 text-sm text-muted">
              Live positions and settled markets where you have stake.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refreshTotals()}
            disabled={historyLoading}
            className="rounded-xl border border-slate-200/80 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-600 transition hover:border-cyan/30 hover:text-cyan disabled:opacity-50"
          >
            {historyLoading ? 'Syncing…' : 'Refresh'}
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid gap-4 sm:grid-cols-3"
      >
        <div className="rounded-[20px] border border-slate-200/80 bg-white/90 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <Clock className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">In play</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{openPositions.length}</p>
          <p className="text-xs text-muted">Open markets with a position</p>
        </div>
        <div className="rounded-[20px] border border-slate-200/80 bg-white/90 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <Briefcase className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">At stake</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{formatAmount(atStake)} USDC</p>
          <p className="text-xs text-muted">Net stake in open pools</p>
        </div>
        <div className="rounded-[20px] border border-emerald-200/80 bg-emerald-50/50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-700">
            <Trophy className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">Unclaimed</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-800">{unclaimedCount}</p>
          <p className="text-xs text-emerald-700/90">Winning or refund positions</p>
        </div>
      </motion.div>

      {unclaimedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-[20px] border border-emerald-200 bg-emerald-50/90 p-5"
        >
          <h2 className="text-sm font-semibold text-emerald-900">Claim winnings</h2>
          <ul className="mt-3 space-y-2">
            {claimableMarkets.map((m) => {
              const side =
                m.outcome === 1 ? m.userWinBet : m.outcome === 2 ? m.userLoseBet : m.userWinBet + m.userLoseBet
              return (
                <li
                  key={m.address}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200/60 bg-white/80 px-4 py-3"
                >
                  <span className="min-w-0 text-sm text-slate-800">{m.description.slice(0, 90)}{m.description.length > 90 ? '…' : ''}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-800">{formatAmount(side)} USDC</span>
                    <button
                      type="button"
                      onClick={() =>
                        executeAction('Withdrawing winnings', async (client) => {
                          await withdrawWinnings(client, m.address)
                          void refreshTotals()
                        })
                      }
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Claim
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </motion.div>
      )}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-muted">
            <Clock className="h-4 w-4" />
            Open positions
          </h2>
          <p className="text-xs text-muted">
            <span className="font-semibold text-rose-700">Sell</span> exits or reduces stake; open{' '}
            <span className="font-semibold text-slate-700">Market</span> for the full view.
          </p>
        </div>
        {isLoading ? (
          <div className="glass-card rounded-[20px] px-5 py-12 text-center text-sm text-muted">Loading…</div>
        ) : openPositions.length === 0 ? (
          <div className="glass-card rounded-[20px] border border-dashed border-slate-200 px-5 py-12 text-center text-sm text-muted">
            No active positions. Open a market and buy Yes or No to show up here.
          </div>
        ) : (
          <div className="space-y-3">
            {openPositions.map((m) => (
              <PositionRow
                key={m.address}
                market={m}
                variant="open"
                chainStakeTotals={chainStakeTotals}
                onOpenSell={() => setSellModalMarket(m)}
              />
            ))}
          </div>
        )}
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="space-y-3"
      >
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-muted">
          <History className="h-4 w-4" />
          Settled history
        </h2>
        {!chainStakeTotals || historyLoading ? (
          <div className="glass-card rounded-[20px] px-5 py-12 text-center text-sm text-muted">
            Loading settlement history from chain…
          </div>
        ) : historyRows.length === 0 ? (
          <div className="glass-card rounded-[20px] border border-dashed border-slate-200 px-5 py-12 text-center text-sm text-muted">
            No settled markets with your wallet&apos;s stake history yet.
          </div>
        ) : (
          <div className="space-y-3">
            {historyRows.map((m) => (
              <PositionRow key={m.address} market={m} variant="settled" chainStakeTotals={chainStakeTotals} />
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted">
          Totals per side use gross amounts from on-chain funding (includes the 0.1% fee slice). Net stake in the
          contract can differ slightly.
        </p>
      </motion.section>

      {sellModalMarket && (() => {
        const live =
          markets.find((m) => m.address.toLowerCase() === sellModalMarket.address.toLowerCase()) ?? sellModalMarket
        return (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 backdrop-blur-[1px] sm:items-center"
          role="presentation"
          onClick={() => setSellModalMarket(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sell-stake-title"
            className="max-h-[min(90vh,520px)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="sell-stake-title" className="text-sm font-bold text-slate-900">
                Sell stake
              </h3>
              <button
                type="button"
                onClick={() => setSellModalMarket(null)}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 line-clamp-3 text-xs leading-snug text-muted">{live.description}</p>
            <div className="mt-4">
              <PositionExitControls
                key={`${live.address}-${live.userWinBet}-${live.userLoseBet}`}
                market={live}
                portfolioModal
                isBusy={actionLoading !== null}
                onExit={(onWinSide, amountEther) =>
                  void executeAction('Exiting position', async (client) => {
                    await exitOpenStake(client, live.address, onWinSide, amountEther)
                  }).then((ok) => {
                    if (ok) {
                      setSellModalMarket(null)
                      void refreshTotals()
                    }
                  })
                }
              />
            </div>
          </div>
        </div>
        )
      })()}
    </div>
  )
}

function PositionRow({
  market,
  variant,
  chainStakeTotals,
  onOpenSell,
}: {
  market: MarketView
  variant: 'open' | 'settled'
  chainStakeTotals: Map<string, { yesGross: bigint; noGross: bigint }> | null
  onOpenSell?: () => void
}) {
  const desc = getMarketDescriptor(market.description, 0)
  const category = getMarketCategory(market.description)
  const cat = CATEGORY_LABELS[category]
  const href = `/market/${marketViewToGroupPath(market)}`
  const key = market.address.toLowerCase()
  const totals = chainStakeTotals?.get(key) ?? { yesGross: 0n, noGross: 0n }

  const resultLabel =
    variant === 'settled'
      ? settledResultLabel(market.outcome, totals.yesGross, totals.noGross)
      : null

  const resultStyles =
    resultLabel?.startsWith('Won') ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : resultLabel === 'Lost' ? 'bg-rose-100 text-rose-800 border-rose-200'
      : resultLabel === 'Refunded' ? 'bg-amber-100 text-amber-900 border-amber-200'
      : resultLabel?.startsWith('Mixed') ? 'bg-slate-100 text-slate-800 border-slate-200'
      : 'bg-slate-50 text-slate-600 border-slate-200'

  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white/95 shadow-sm transition hover:border-cyan/25 hover:shadow-md">
      <div className="flex flex-wrap items-start gap-4 p-4 sm:p-5">
        <TokenBadge symbol={desc.symbol} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
              {cat?.title ?? 'Market'}
            </span>
            {variant === 'settled' && (
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                {outcomeLabel(market.outcome as MarketOutcome)}
              </span>
            )}
            {variant === 'settled' && resultLabel && resultLabel !== '—' && (
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${resultStyles}`}>
                {resultLabel}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm font-medium leading-snug text-slate-800">{market.description}</p>

          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
            {variant === 'open' && (
              <>
                <span>
                  Yes stake: <strong className="text-slate-800">{formatAmount(market.userWinBet)} USDC</strong>
                </span>
                <span>
                  No stake: <strong className="text-slate-800">{formatAmount(market.userLoseBet)} USDC</strong>
                </span>
              </>
            )}
            {variant === 'settled' && (totals.yesGross > 0n || totals.noGross > 0n) && (
              <>
                <span>
                  Yes (gross funded): <strong className="text-slate-800">{formatAmount(totals.yesGross)} USDC</strong>
                </span>
                <span>
                  No (gross funded): <strong className="text-slate-800">{formatAmount(totals.noGross)} USDC</strong>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {variant === 'open' && onOpenSell && (
            <button
              type="button"
              onClick={onOpenSell}
              className="inline-flex min-h-[40px] min-w-[5.5rem] items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-rose-700 hover:shadow active:scale-[0.98]"
            >
              Sell
            </button>
          )}
          <Link
            href={href}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-cyan/40 hover:bg-white hover:text-cyan"
          >
            Market
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
          </Link>
        </div>
      </div>
    </div>
  )
}
