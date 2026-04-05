'use client'

import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain, useWalletClient } from 'wagmi'
import type { WalletClient } from 'viem'
import {
  ARC_NETWORK,
  fetchDashboardData,
} from './lib/contracts'
import type { MarketView } from './lib/contracts'
import { getStableHealthScore, getStableQuotes, getStableRiskLabel } from './lib/cmc'
import { USYC_DASHBOARD } from './lib/usyc-dashboard'
import { getStablecoinTVL } from './lib/defillama'
import { hasWalletConnectProjectId } from './lib/wallet'
import { groupMarkets } from './lib/market-utils'
import type { MarketCategory, MarketGroup, PricePoint } from './lib/market-utils'

export type ChainlinkPrice = {
  symbol: string
  pair: string
  price: number
  chain?: string
  updatedAt: string
  points?: Array<{ time: string; price: number }>
}
import { Header } from './components/Header'
import { ConnectWalletModal } from './components/ConnectWalletModal'
import { SvgBackground } from './components/SvgBackground'

export type RiskCard = {
  symbol: string
  riskLabel: string
  riskScore: number
  pegValue: string
  tvl: string
  note: string
}

const ALL_SYMBOLS = ['USDC', 'EURC', 'BRLA', 'JPYC', 'MXNB', 'AUDF', 'QCAD', 'USYC'] as const
const PRICE_CHART_SYMBOLS = ALL_SYMBOLS

const LANDING_RISK_CARDS: RiskCard[] = ALL_SYMBOLS.map((s) => ({
  symbol: s,
  riskLabel: '',
  riskScore: 0,
  pegValue: '',
  tvl: '',
  note: '',
}))

type AppContextValue = {
  markets: MarketView[]
  owner: string
  isOwner: boolean
  isLoading: boolean
  isRefreshing: boolean
  isConnected: boolean
  address?: string
  actionLoading: string | null
  riskCards: RiskCard[]
  priceCharts: Record<string, PricePoint[]>
  chainlinkPrices: Record<string, ChainlinkPrice>
  groupedMarkets: (categoryFilter: MarketCategory | 'all', symbolFilter: string | null) => MarketGroup[]
  settledMarkets: MarketView[]
  claimableMarkets: MarketView[]
  totalStaked: bigint
  activeMarketsCount: number
  refreshDashboard: (connectedAddress?: string | null, showSpinner?: boolean) => Promise<void>
  executeAction: (label: string, action: (client: WalletClient) => Promise<void>) => Promise<boolean>
  handleConnect: (connectorId?: string) => Promise<void>
  openConnectModal: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within PegPulseShell')
  return ctx
}

export default function PegPulseShell({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <PegPulseShellInner>{children}</PegPulseShellInner>
    </Suspense>
  )
}

function PegPulseShellInner({ children }: { children: ReactNode }) {
  const { address, chainId, isConnected } = useAccount()
  const { connectors, connectAsync, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { data: balanceData } = useBalance({ address, chainId: ARC_NETWORK.chainId })
  const { switchChainAsync } = useSwitchChain()
  const { data: walletClient } = useWalletClient()

  const [owner, setOwner] = useState<string>('')
  const [markets, setMarkets] = useState<MarketView[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
  const [riskCards, setRiskCards] = useState<RiskCard[]>(LANDING_RISK_CARDS)
  const [statusMessage, setStatusMessage] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [priceCharts, setPriceCharts] = useState<Record<string, PricePoint[]>>({})
  const [chainlinkPrices, setChainlinkPrices] = useState<Record<string, ChainlinkPrice>>({})

  const refreshDashboard = useCallback(
    async (connectedAddress?: string | null, showSpinner = false) => {
      if (showSpinner) setIsRefreshing(true)
      try {
        const data = await fetchDashboardData(connectedAddress ?? undefined)
        setOwner(data.owner)
        setMarkets(data.markets)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not fetch onchain data.'
        setStatusMessage(message)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [],
  )

  useEffect(() => {
    void refreshDashboard(address)
  }, [address, refreshDashboard])

  useEffect(() => {
    const id = window.setInterval(() => void refreshDashboard(address), 60000)
    return () => window.clearInterval(id)
  }, [address, refreshDashboard])

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      let tvlData: Awaited<ReturnType<typeof getStablecoinTVL>> | null = null
      try { tvlData = await getStablecoinTVL() } catch {}

      try {
        const quotes = await getStableQuotes()
        if (cancelled) return
        setRiskCards(
          ALL_SYMBOLS.map((symbol) => {
            const q = quotes[symbol]
            if (!q) return { symbol, riskLabel: '', riskScore: 0, pegValue: '', tvl: tvlData?.[symbol]?.formattedTVL ?? '', note: '' }
            if (symbol === 'USYC') {
              return {
                symbol,
                pegValue: `$${USYC_DASHBOARD.headlinePrice.toFixed(6)}`,
                tvl: tvlData?.[symbol]?.formattedTVL ?? '',
                riskScore: 12,
                riskLabel: 'T-bill yield',
                note: `Net yield ~${USYC_DASHBOARD.netYieldPct}% (demo snapshot)`,
              }
            }
            const pegRatio =
              symbol === 'QCAD' && q.pegReferenceUsd && q.pegReferenceUsd > 0
                ? q.price / q.pegReferenceUsd
                : q.price
            return {
              symbol,
              pegValue: `$${q.price.toFixed(4)}`,
              tvl: tvlData?.[symbol]?.formattedTVL ?? '',
              riskScore: 100 - getStableHealthScore(pegRatio),
              riskLabel: getStableRiskLabel(pegRatio),
              note: `24h ${q.percentChange24h >= 0 ? '+' : ''}${q.percentChange24h.toFixed(2)}%`,
            }
          }),
        )
      } catch {
        if (cancelled) return
        if (tvlData) {
          setRiskCards((prev) => prev.map((card) => ({
            ...card,
            tvl: tvlData![card.symbol]?.formattedTVL ?? card.tvl,
          })))
        }
      }
    }
    void refresh()
    const id = window.setInterval(() => void refresh(), 5 * 60 * 1000)
    return () => { cancelled = true; window.clearInterval(id) }
  }, [])

  useEffect(() => {
    let cancelled = false
    const CL_SYMBOLS = ['EURC', 'JPYC', 'AUDF', 'QCAD', 'BRLA', 'MXNB']
    async function fetchCharts() {
      try {
        const [priceResponses, clRes, ...clHistResponses] = await Promise.all([
          Promise.all(PRICE_CHART_SYMBOLS.map((s) => fetch(`/api/price-chart?symbol=${s}`))),
          fetch('/api/chainlink'),
          ...CL_SYMBOLS.map((s) => fetch(`/api/chainlink?symbol=${s}&history=true`)),
        ])
        if (cancelled) return
        const priceData = await Promise.all(priceResponses.map((r) => r.json()))

        const pc: Record<string, PricePoint[]> = {}
        PRICE_CHART_SYMBOLS.forEach((s, i) => { pc[s] = priceData[i].points ?? [] })
        setPriceCharts(pc)

        if (clRes.ok) {
          const clData = await clRes.json() as Record<string, ChainlinkPrice>
          const clHistData = await Promise.all(clHistResponses.map((r) => r.ok ? r.json() : null))
          for (let i = 0; i < CL_SYMBOLS.length; i++) {
            const sym = CL_SYMBOLS[i]
            if (clData[sym] && clHistData[i]?.points) {
              clData[sym].points = clHistData[i].points
            }
          }
          setChainlinkPrices(clData)
        }
      } catch {}
    }
    void fetchCharts()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (isConnected) setIsConnectModalOpen(false)
  }, [isConnected])

  const isOwner = address !== undefined && owner !== '' && address.toLowerCase() === owner.toLowerCase()

  const activeMarkets = useMemo(() => markets.filter((m) => !m.isSettled), [markets])
  const settledMarkets = useMemo(() => markets.filter((m) => m.isSettled), [markets])
  const totalStaked = useMemo(() => markets.reduce((sum, m) => sum + m.totalWinBets + m.totalLoseBets, 0n), [markets])

  const claimableMarkets = useMemo(() => {
    if (!isConnected) return []
    return markets.filter((m) => {
      if (!m.isSettled) return false
      if (m.outcome === 1) return m.userWinBet > 0n
      if (m.outcome === 2) return m.userLoseBet > 0n
      if (m.outcome === 3) return m.userWinBet > 0n || m.userLoseBet > 0n
      return false
    })
  }, [markets, isConnected])

  const groupedMarketsFn = useCallback(
    (categoryFilter: MarketCategory | 'all', symbolFilter: string | null) =>
      groupMarkets(markets, categoryFilter, symbolFilter),
    [markets],
  )

  const executeAction = useCallback(
    async (label: string, action: (client: WalletClient) => Promise<void>) => {
      setActionLoading(label)
      setStatusMessage(`${label} in progress...`)
      try {
        if (!isConnected || !address) throw new Error('Connect a wallet before sending transactions.')
        if (chainId !== ARC_NETWORK.chainId) {
          if (switchChainAsync) {
            await switchChainAsync({ chainId: ARC_NETWORK.chainId })
            throw new Error('Switched to Arc Testnet. Retry the action once the wallet reconnects.')
          }
          throw new Error('Switch your wallet to Arc Testnet to continue.')
        }
        if (!walletClient) throw new Error('Wallet client is not ready yet. Please reconnect and try again.')
        await action(walletClient)
        await refreshDashboard(address, true)
        setStatusMessage(`${label} completed successfully.`)
        return true
      } catch (error) {
        const message = error instanceof Error ? error.message : `${label} failed.`
        setStatusMessage(message)
        return false
      } finally {
        setActionLoading(null)
      }
    },
    [address, chainId, isConnected, refreshDashboard, switchChainAsync, walletClient],
  )

  const handleConnect = useCallback(async (connectorId?: string) => {
    try {
      const connector = connectors.find((item) => item.id === connectorId) ?? connectors[0]
      if (!connector) throw new Error('No wallet connectors are available.')
      if (connector.id === 'walletConnect' && !hasWalletConnectProjectId) {
        throw new Error('Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in frontend/.env to enable WalletConnect.')
      }
      await connectAsync({ connector })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet connection failed.'
      setStatusMessage(message)
    }
  }, [connectors, connectAsync])

  const contextValue: AppContextValue = useMemo(() => ({
    markets,
    owner,
    isOwner,
    isLoading,
    isRefreshing,
    isConnected,
    address,
    actionLoading,
    riskCards,
    priceCharts,
    chainlinkPrices,
    groupedMarkets: groupedMarketsFn,
    settledMarkets,
    claimableMarkets,
    totalStaked,
    activeMarketsCount: activeMarkets.length,
    refreshDashboard,
    executeAction,
    handleConnect,
    openConnectModal: () => setIsConnectModalOpen(true),
  }), [markets, owner, isOwner, isLoading, isRefreshing, isConnected, address, actionLoading, riskCards, priceCharts, chainlinkPrices, groupedMarketsFn, settledMarkets, claimableMarkets, totalStaked, activeMarkets.length, refreshDashboard, executeAction, handleConnect])

  return (
    <AppContext.Provider value={contextValue}>
      <div className="relative min-h-screen overflow-hidden bg-background text-text">
        <SvgBackground />

        <div className="relative mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col px-4 pb-12 pt-4 sm:px-6 lg:px-8">
          <Header
            address={address}
            isConnected={isConnected}
            isOwner={isOwner}
            balance={balanceData?.value}
            onConnectClick={() => setIsConnectModalOpen(true)}
            onDisconnect={disconnect}
          />

          {isConnectModalOpen && (
            <ConnectWalletModal
              connectors={connectors}
              isConnecting={isConnecting}
              onConnect={(id) => void handleConnect(id)}
              onClose={() => setIsConnectModalOpen(false)}
            />
          )}

          <main className="mt-6 flex-1">
            <p className="sr-only">{statusMessage}</p>
            {children}
          </main>
        </div>
      </div>
    </AppContext.Provider>
  )
}
