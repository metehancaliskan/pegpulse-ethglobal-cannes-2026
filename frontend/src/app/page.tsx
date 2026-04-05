'use client'

import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useApp } from '../App'
import { CategoryFilter } from '../components/CategoryFilter'
import { MarketCard } from '../components/MarketCard'
import { TokenBadge } from '../components/TokenBadge'
import { formatAmount } from '../lib/contracts'
import type { MarketCategory } from '../lib/market-utils'
import { getMarketDescriptor } from '../lib/market-utils'

export default function MarketsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const {
    isLoading,
    groupedMarkets,
    settledMarkets,
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
              const outcomeMap: Record<number, { label: string; bg: string; text: string; border: string }> = {
                1: { label: 'Yes won', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
                2: { label: 'No won', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
                3: { label: 'Invalid', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
              }
              const outcomeConfig = outcomeMap[market.outcome] ?? { label: 'Settled', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' }

              return (
                <div
                  key={market.address}
                  className="rounded-[20px] border border-slate-200/80 bg-white/90 p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <TokenBadge symbol={desc.symbol} size="sm" />
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${outcomeConfig.bg} ${outcomeConfig.text} ${outcomeConfig.border}`}>
                      {outcomeConfig.label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-700">{market.description}</p>
                  <p className="mt-2 text-xs text-muted">
                    Total staked: <span className="font-semibold text-slate-700">{formatAmount(market.totalWinBets + market.totalLoseBets)} USDC</span>
                  </p>
                </div>
              )
            })
          )}
        </motion.div>
      )}
    </div>
  )
}
