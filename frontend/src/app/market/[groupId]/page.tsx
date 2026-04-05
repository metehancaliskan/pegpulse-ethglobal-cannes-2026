'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useApp } from '../../../App'
import { MarketDetail } from '../../../components/MarketDetail'
import { decodeGroupId, getMarketCategory, getMarketDescriptor } from '../../../lib/market-utils'
import { placeBet, settleMarket, withdrawWinnings, fetchSingleMarketDynamic, exitOpenStake } from '../../../lib/contracts'
import type { MarketView } from '../../../lib/contracts'
import type { MarketGroup } from '../../../lib/market-utils'

type PageProps = {
  params: Promise<{ groupId: string }>
}

export default function MarketDetailPage({ params }: PageProps) {
  const { groupId } = use(params)
  const router = useRouter()
  const {
    markets,
    isOwner,
    isLoading,
    actionLoading,
    address,
    isConnected,
    riskCards,
    priceCharts,
    chainlinkPrices,
    executeAction,
  } = useApp()

  const parsed = decodeGroupId(groupId)

  const staticGroup: MarketGroup | null = (() => {
    if (!parsed) return null
    const matching = markets.filter((m) => {
      if (m.isSettled) return false
      const desc = getMarketDescriptor(m.description, 0)
      const cat = getMarketCategory(m.description)
      return desc.symbol === parsed.symbol && desc.deadlineLabel === parsed.deadline && cat === parsed.category
    })
    if (matching.length === 0) return null
    const desc = getMarketDescriptor(matching[0].description, 0)
    const cat = getMarketCategory(matching[0].description)
    const descUpper = matching[0].description.toUpperCase()
    const questionType = descUpper.startsWith('[RWA:') ? 'yield' : descUpper.includes('TVL') ? 'tvl' : descUpper.includes('PEG') ? 'depeg' : 'other'
    return { symbol: desc.symbol, deadline: desc.deadlineLabel, questionType, category: cat, markets: matching }
  })()

  const [liveGroup, setLiveGroup] = useState<MarketGroup | null>(null)

  const refreshGroupDynamic = useCallback(async () => {
    if (!staticGroup) return
    const updated: MarketView[] = await Promise.all(
      staticGroup.markets.map(async (m) => {
        const dyn = await fetchSingleMarketDynamic(m.address, address)
        return { ...m, ...dyn }
      }),
    )
    setLiveGroup({ ...staticGroup, markets: updated })
  }, [staticGroup, address])

  useEffect(() => {
    void refreshGroupDynamic()
  }, [refreshGroupDynamic])

  const group = liveGroup ?? staticGroup

  if (isLoading) {
    return (
      <div className="glass-card rounded-[20px] px-5 py-16 text-center text-muted">
        Loading market...
      </div>
    )
  }

  if (!group) {
    return (
      <div className="grid gap-4">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Markets
        </button>
        <div className="glass-card rounded-[20px] px-5 py-16 text-center text-muted">
          Market not found or already settled.
        </div>
      </div>
    )
  }

  const currentPrice = riskCards.find((c) => c.symbol === group.symbol)?.pegValue ?? ''

  return (
    <div className="grid gap-4">
      <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Markets
        </button>
      </motion.div>

      <MarketDetail
        group={group}
        isOwner={isOwner}
        isBusy={actionLoading !== null}
        priceData={priceCharts[group.symbol] ?? []}
        chainlinkPrice={chainlinkPrices[group.symbol]}
        currentPrice={currentPrice}
        onBet={async (marketAddress, side, amount) => {
          await executeAction(
            side === 'win' ? 'Placing Yes bet' : 'Placing No bet',
            async (client) => {
              await placeBet(client, marketAddress, side, amount)
              void refreshGroupDynamic()
            },
          )
        }}
        onSettle={async (marketAddress, outcome) => {
          await executeAction('Settling market', async (client) => {
            await settleMarket(client, marketAddress, outcome)
            void refreshGroupDynamic()
          })
        }}
        onWithdraw={async (marketAddress) => {
          await executeAction('Withdrawing winnings', async (client) => {
            await withdrawWinnings(client, marketAddress)
            void refreshGroupDynamic()
          })
        }}
        isConnected={isConnected}
        onExitStake={
          isConnected
            ? async (marketAddress, onWinSide, amountEther) => {
                await executeAction('Exiting position', async (client) => {
                  await exitOpenStake(client, marketAddress, onWinSide, amountEther)
                  void refreshGroupDynamic()
                })
              }
            : undefined
        }
      />
    </div>
  )
}
