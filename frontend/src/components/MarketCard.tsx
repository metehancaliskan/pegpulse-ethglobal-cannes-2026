'use client'

import Link from 'next/link'
import { TokenBadge } from './TokenBadge'
import { CATEGORY_LABELS, encodeGroupId, getGroupHeadline, getMarketDescriptor, shouldHideSingleTierThreshold } from '../lib/market-utils'
import { formatAmount } from '../lib/contracts'
import type { MarketGroup } from '../lib/market-utils'

type MarketCardProps = {
  group: MarketGroup
}

export function MarketCard({ group }: MarketCardProps) {
  const tiers = group.markets.map((market, i) => {
    const desc = getMarketDescriptor(market.description, i)
    const pool = market.totalWinBets + market.totalLoseBets
    const yesPrice = pool > 0n ? Number(market.totalWinBets) / Number(pool) : 0.5
    return { market, desc, pool, yesPrice }
  })

  const totalVolume = tiers.reduce((sum, t) => sum + t.pool, 0n)
  const categoryLabel = CATEGORY_LABELS[group.category]
  const groupId = encodeGroupId(group)
  const hideTierCol = shouldHideSingleTierThreshold(group)
  const multiTier = tiers.length > 1

  return (
    <Link
      href={`/market/${groupId}`}
      className="group block rounded-[20px] border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm transition hover:border-cyan/30 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <TokenBadge symbol={group.symbol} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
              {categoryLabel?.title ?? 'Market'}
            </span>
          </div>
          <h3 className="mt-1.5 text-sm font-semibold leading-snug text-slate-900 group-hover:text-royal">
            {getGroupHeadline(group)}
          </h3>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {tiers.slice(0, 3).map((tier) => {
          const yesPct = tier.yesPrice * 100
          const noPct = (1 - tier.yesPrice) * 100
          const yesLabel = yesPct.toFixed(0)
          const noLabel = noPct.toFixed(0)
          const yesW = Math.min(100, Math.max(0, yesPct))
          const noW = Math.min(100, Math.max(0, noPct))
          const showYesInBar = yesW >= 14
          const showNoInBar = noW >= 14

          if (multiTier) {
            return (
              <div key={tier.market.address} className="flex items-center gap-2.5 sm:gap-3">
                {!hideTierCol && (
                  <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-slate-800 sm:w-14">
                    {tier.desc.thresholdLabel}
                  </span>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <div
                    className="flex h-7 w-full overflow-hidden rounded-lg bg-slate-100 shadow-inner ring-1 ring-slate-200/80"
                    aria-hidden
                  >
                    <div
                      className="flex min-w-0 items-center justify-center bg-gradient-to-b from-emerald-400 to-emerald-600 transition-[width]"
                      style={{ width: `${yesW}%` }}
                    >
                      {showYesInBar && (
                        <span className="truncate px-1 text-[10px] font-bold tabular-nums text-white drop-shadow-sm">
                          {yesLabel}¢
                        </span>
                      )}
                    </div>
                    <div
                      className="flex min-w-0 items-center justify-center bg-gradient-to-b from-rose-400 to-rose-600 transition-[width]"
                      style={{ width: `${noW}%` }}
                    >
                      {showNoInBar && (
                        <span className="truncate px-1 text-[10px] font-bold tabular-nums text-white drop-shadow-sm">
                          {noLabel}¢
                        </span>
                      )}
                    </div>
                  </div>
                  {(!showYesInBar || !showNoInBar) && (
                    <div className="flex justify-between gap-2 text-[10px] font-semibold tabular-nums">
                      {!showYesInBar && (
                        <span className="text-emerald-700">
                          Yes {yesLabel}¢
                        </span>
                      )}
                      {!showNoInBar && (
                        <span className="ml-auto text-rose-700">
                          No {noLabel}¢
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {!hideTierCol && (
                  <span className="w-11 shrink-0 text-right text-[10px] tabular-nums text-muted sm:w-14">
                    {formatAmount(tier.pool)}
                  </span>
                )}
              </div>
            )
          }

          return (
            <div
              key={tier.market.address}
              className={`flex items-center gap-3 ${hideTierCol ? 'justify-end' : ''}`}
            >
              {!hideTierCol && (
                <span className="w-14 shrink-0 text-xs font-semibold text-slate-800">
                  {tier.desc.thresholdLabel}
                </span>
              )}
              <div className={`flex shrink-0 gap-2 ${hideTierCol ? 'flex-1 justify-end' : 'ml-auto'}`}>
                <div className="flex min-w-[4.25rem] flex-col items-center rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-2.5 py-1.5">
                  <span className="text-[11px] font-bold text-emerald-700">{yesLabel}¢</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Yes</span>
                </div>
                <div className="flex min-w-[4.25rem] flex-col items-center rounded-xl border border-rose-200/90 bg-rose-50/80 px-2.5 py-1.5">
                  <span className="text-[11px] font-bold text-rose-700">{noLabel}¢</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-800">No</span>
                </div>
              </div>
              {!hideTierCol && (
                <span className="w-14 shrink-0 text-right text-[10px] text-muted">
                  {formatAmount(tier.pool)}
                </span>
              )}
            </div>
          )
        })}
        {tiers.length > 3 && (
          <p className="text-[11px] text-muted">+{tiers.length - 3} more tiers</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-xs text-muted">
          {formatAmount(totalVolume)} USDC vol.
        </span>
        <span className="text-xs text-muted">
          {tiers.length} {tiers.length === 1 ? 'market' : 'markets'}
        </span>
      </div>
    </Link>
  )
}
