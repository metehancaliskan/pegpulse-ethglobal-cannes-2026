'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useApp } from '../App'
import { CategoryFilter } from '../components/CategoryFilter'
import { MarketCard } from '../components/MarketCard'
import { TokenBadge } from '../components/TokenBadge'
import { formatAmount, withdrawWinnings } from '../lib/contracts'
import type { MarketCategory } from '../lib/market-utils'
import { getMarketDescriptor } from '../lib/market-utils'

export default function MarketsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const {
    isLoading,
    groupedMarkets,
    settledMarkets,
    claimableMarkets,
    actionLoading,
    executeAction,
  } = useApp()

  const [categoryFilter, setCategoryFilter] = useState<MarketCategory | 'all'>('all')
  const [symbolFilter, setSymbolFilter] = useState<string | null>(searchParams.get('symbol'))
  const [marketTab, setMarketTab] = useState<'active' | 'past'>('active')

  const groups = groupedMarkets(categoryFilter, symbolFilter)

  return (
    <div className="grid gap-5">
      {/* Tabs + Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/60 p-1">
          <button
            type="button"
            onClick={() => setMarketTab('active')}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
              marketTab === 'active'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-muted hover:text-slate-700'
            }`}
          >
            Active
            {groups.length > 0 && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                marketTab === 'active' ? 'bg-cyan/15 text-cyan' : 'bg-slate-200 text-muted'
              }`}>
                {groups.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMarketTab('past')}
            className={`relative rounded-xl px-5 py-2 text-sm font-semibold transition ${
              marketTab === 'past'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-muted hover:text-slate-700'
            }`}
          >
            Past
            {settledMarkets.length > 0 && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                marketTab === 'past' ? 'bg-slate-100 text-muted' : 'bg-slate-200 text-muted'
              }`}>
                {settledMarkets.length}
              </span>
            )}
            {claimableMarkets.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                {claimableMarkets.length}
              </span>
            )}
          </button>
        </div>

        {marketTab === 'active' && (
          <CategoryFilter
            value={categoryFilter}
            onChange={setCategoryFilter}
            symbolFilter={symbolFilter}
            onClearSymbol={() => { setSymbolFilter(null); router.replace('/') }}
          />
        )}
      </motion.div>

      {/* Active tab: market grid */}
      {marketTab === 'active' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          {isLoading ? (
            <div className="glass-card rounded-[20px] px-5 py-16 text-center text-muted">
              Loading markets...
            </div>
          ) : groups.length === 0 ? (
            <div className="glass-card rounded-[20px] border-dashed px-5 py-16 text-center text-muted">
              No active markets right now. Check back later.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map((group) => (
                <MarketCard
                  key={`${group.symbol}::${group.deadline}::${group.category}`}
                  group={group}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Past tab */}
      {marketTab === 'past' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="grid gap-4"
        >
          {claimableMarkets.length > 0 && (
            <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/80 px-5 py-4">
              <p className="text-sm font-semibold text-emerald-800">
                You have {claimableMarkets.length} unclaimed {claimableMarkets.length === 1 ? 'position' : 'positions'}
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="glass-card rounded-[20px] px-5 py-16 text-center text-muted">
              Loading past markets...
            </div>
          ) : settledMarkets.length === 0 ? (
            <div className="glass-card rounded-[20px] border-dashed px-5 py-16 text-center text-muted">
              No past markets yet.
            </div>
          ) : (
            settledMarkets.map((market) => {
              const desc = getMarketDescriptor(market.description, 0)
              const hasPosition = market.userWinBet > 0n || market.userLoseBet > 0n
              const isClaimable = claimableMarkets.some((m) => m.address === market.address)

              const outcomeMap: Record<number, { label: string; bg: string; text: string; border: string }> = {
                1: { label: 'Yes won', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
                2: { label: 'No won', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
                3: { label: 'Invalid', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
              }
              const outcomeConfig = outcomeMap[market.outcome] ?? { label: 'Settled', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' }

              const userSideBet = market.outcome === 1
                ? market.userWinBet
                : market.outcome === 2
                  ? market.userLoseBet
                  : (market.userWinBet + market.userLoseBet)

              const userWon = isClaimable
              const userLost = hasPosition && !isClaimable && market.outcome !== 3

              return (
                <div
                  key={market.address}
                  className={`rounded-[20px] border bg-white/90 p-5 transition ${
                    isClaimable ? 'border-emerald-200 ring-1 ring-emerald-300/50' : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <TokenBadge symbol={desc.symbol} size="sm" />
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${outcomeConfig.bg} ${outcomeConfig.text} ${outcomeConfig.border}`}>
                          {outcomeConfig.label}
                        </span>
                        {hasPosition && (
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            userWon ? 'bg-emerald-50 text-emerald-700'
                            : userLost ? 'bg-rose-50 text-rose-600'
                            : 'bg-amber-50 text-amber-700'
                          }`}>
                            {userWon ? 'You won' : userLost ? 'You lost' : 'Refund'}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-700">{market.description}</p>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
                        {hasPosition ? (
                          <>
                            {market.userWinBet > 0n && (
                              <span>Yes bet: <span className="font-semibold text-slate-700">{formatAmount(market.userWinBet)} USDC</span></span>
                            )}
                            {market.userLoseBet > 0n && (
                              <span>No bet: <span className="font-semibold text-slate-700">{formatAmount(market.userLoseBet)} USDC</span></span>
                            )}
                          </>
                        ) : (
                          <span>Total staked: <span className="font-semibold text-slate-700">{formatAmount(market.totalWinBets + market.totalLoseBets)} USDC</span></span>
                        )}
                      </div>
                    </div>

                    {isClaimable ? (
                      <button
                        type="button"
                        disabled={actionLoading !== null}
                        onClick={() =>
                          executeAction('Withdrawing winnings', async (client) => {
                            await withdrawWinnings(client, market.address)
                          })
                        }
                        className="shrink-0 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Claim {formatAmount(userSideBet)} USDC
                      </button>
                    ) : hasPosition && userLost ? (
                      <span className="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-500">
                        Lost
                      </span>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </motion.div>
      )}
    </div>
  )
}
