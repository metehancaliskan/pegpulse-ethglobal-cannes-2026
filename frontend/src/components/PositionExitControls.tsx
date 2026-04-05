'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatEther, parseEther } from 'viem'
import { formatAmount } from '../lib/contracts'
import type { MarketView } from '../lib/contracts'

type Props = {
  market: MarketView
  isBusy?: boolean
  disabled?: boolean
  /** Tighter layout for portfolio rows */
  compact?: boolean
  /** Minimal chrome for dialog / overlay (no big “Your position” panel) */
  portfolioModal?: boolean
  onExit: (onWinSide: boolean, amountEther: string) => void | Promise<void>
}

export function PositionExitControls({ market, isBusy, disabled, compact, portfolioModal, onExit }: Props) {
  const settled = market.isSettled
  const yes = market.userWinBet
  const no = market.userLoseBet
  const hasAny = !settled && (yes > 0n || no > 0n)

  const [side, setSide] = useState<'win' | 'lose'>('win')

  useEffect(() => {
    if (yes > 0n && no === 0n) setSide('win')
    else if (no > 0n && yes === 0n) setSide('lose')
  }, [yes, no, market.address])

  const stake = side === 'win' ? yes : no
  const [amountStr, setAmountStr] = useState('')

  useEffect(() => {
    setAmountStr('')
  }, [market.address, side])

  const parsedWei = useMemo(() => {
    try {
      const t = amountStr.trim()
      if (!t) return null
      const w = parseEther(t as `${string}`)
      if (w <= 0n || w > stake) return null
      return w
    } catch {
      return null
    }
  }, [amountStr, stake])

  const setPct = (pct: number) => {
    if (stake <= 0n) return
    if (pct === 100) {
      setAmountStr(formatEther(stake))
      return
    }
    const w = (stake * BigInt(pct)) / 100n
    const useW = w > 0n ? w : stake
    setAmountStr(formatEther(useW))
  }

  if (!hasAny) return null

  const bothSides = yes > 0n && no > 0n
  const canSubmit = parsedWei !== null && !disabled && !isBusy
  const isFullExit = parsedWei !== null && parsedWei === stake

  const shell = portfolioModal
    ? 'space-y-3'
    : compact
      ? 'rounded-xl border border-amber-200/80 bg-amber-50/40 p-3'
      : 'mt-4 rounded-[20px] border border-amber-200/90 bg-gradient-to-b from-amber-50/95 to-white p-4 shadow-sm ring-1 ring-amber-100/60'

  return (
    <div className={shell}>
      {!portfolioModal && (
        <>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-900/85">Your position</p>
          <p className="mt-1 text-xs leading-snug text-amber-950/75">
            Sell back your stake before settlement—partial or full. Returned balance matches your pool share (no extra exit
            fee).
          </p>
        </>
      )}

      <div className={`flex flex-wrap gap-2 text-xs ${portfolioModal ? '' : 'mt-3'}`}>
        {yes > 0n && (
          <span className="rounded-lg bg-emerald-100/90 px-2.5 py-1 font-semibold text-emerald-900">
            Yes · {formatAmount(yes)} USDC
          </span>
        )}
        {no > 0n && (
          <span className="rounded-lg bg-rose-100/90 px-2.5 py-1 font-semibold text-rose-900">
            No · {formatAmount(no)} USDC
          </span>
        )}
      </div>

      {bothSides && (
        <div className="mt-3 flex rounded-xl border border-slate-200/80 bg-white p-1">
          <button
            type="button"
            disabled={yes === 0n || !!isBusy}
            onClick={() => {
              setSide('win')
              setAmountStr('')
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              side === 'win' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Yes side
          </button>
          <button
            type="button"
            disabled={no === 0n || !!isBusy}
            onClick={() => {
              setSide('lose')
              setAmountStr('')
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              side === 'lose' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            No side
          </button>
        </div>
      )}

      <div className="mt-3">
        <label className="text-xs font-medium text-amber-950/75">Amount to sell (max {formatAmount(stake)} on this side)</label>
        <input
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          disabled={!!isBusy}
          className="mt-1 w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400/70 disabled:opacity-50"
        />
      </div>

      <div className="mt-2 flex gap-1.5">
        {[25, 50, 100].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPct(p)}
            disabled={stake <= 0n || !!isBusy}
            className="flex-1 rounded-lg border border-slate-200/80 bg-white py-2 text-[11px] font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50/50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {p === 100 ? 'Max' : `${p}%`}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => {
          if (!parsedWei) return
          void onExit(side === 'win', formatEther(parsedWei))
        }}
        className="mt-3 w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {isFullExit ? 'Sell full position' : 'Sell partial'}
      </button>

      {portfolioModal ? (
        <p className="text-[10px] leading-relaxed text-slate-500">
          After settlement, claim from the portfolio. Older market contracts may not support sell-back.
        </p>
      ) : (
        <p className="mt-2 text-[10px] leading-relaxed text-amber-950/55">
          Once the market settles, use <span className="font-semibold">Claim payout</span> for winnings or refunds. If the
          transaction fails, this market may predate on-chain exit—redeployed markets include sell-back.
        </p>
      )}
    </div>
  )
}
