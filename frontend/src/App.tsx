'use client'

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Image, { type StaticImageData } from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  LogOut,
  QrCode,
  RefreshCcw,
  ShieldAlert,
  Landmark,
  X,
  Plus,
  Settings,
  Wallet2,
} from 'lucide-react'
import { useAccount, useBalance, useConnect, useDisconnect, useSwitchChain, useWalletClient } from 'wagmi'
import {
  ARC_NETWORK,
  createMarket,
  fetchDashboardData,
  formatAmount,
  outcomeLabel,
  placeBet,
  settleMarket,
  shortenAddress,
  withdrawWinnings,
} from './lib/contracts'
import type { MarketView } from './lib/contracts'
import { getStableHealthScore, getStableQuotes, getStableRiskLabel } from './lib/cmc'
import { getStablecoinTVL } from './lib/defillama'
import { hasWalletConnectProjectId } from './lib/wallet'
import eurcLogo from './assets/EURC-logo.png'
import pegPulseLogo from './assets/pegpulse_logo.png'
import usdcLogo from './assets/USDC-logo.png'

type AppMode = 'landing' | 'markets' | 'admin'

type MarketDescriptor = {
  symbol: string
  thresholdLabel: string
  deadlineLabel: string
  deadline: Date | null
}

type RiskCard = {
  symbol: 'USDC' | 'EURC'
  riskLabel: string
  riskScore: number
  pegValue: string
  tvl: string
  note: string
}

const LANDING_RISK_CARDS: RiskCard[] = [
  {
    symbol: 'USDC',
    riskLabel: 'Low Risk',
    riskScore: 18,
    pegValue: '$1.0002',
    tvl: 'Loading...',
    note: 'Deep liquidity and broad market usage keep short-term de-peg pressure contained.',
  },
  {
    symbol: 'EURC',
    riskLabel: 'Moderate Watch',
    riskScore: 34,
    pegValue: '€0.9988',
    tvl: 'Loading...',
    note: 'Cross-currency liquidity remains thinner, so stress events deserve closer monitoring.',
  },
]

type PricePoint = { time: string; price: number }

type PegPulseAppProps = {
  mode: AppMode
}

export default function PegPulseApp({ mode }: PegPulseAppProps) {
  return (
    <Suspense>
      <PegPulseInner mode={mode} />
    </Suspense>
  )
}

function PegPulseInner({ mode }: PegPulseAppProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [isWalletDropdownOpen, setIsWalletDropdownOpen] = useState(false)
  const [marketTab, setMarketTab] = useState<'active' | 'past'>('active')
  const [riskCards, setRiskCards] = useState<RiskCard[]>(LANDING_RISK_CARDS)
  const [statusMessage, setStatusMessage] = useState(
    'PegPulse is actively monitoring Arc markets for stablecoin de-peg stress.',
  )
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [priceCharts, setPriceCharts] = useState<Record<string, PricePoint[]>>({})
  const [tvlCharts, setTvlCharts] = useState<Record<string, { time: string; tvl: number; tvlFormatted: string }[]>>({})
  const [symbolFilter, setSymbolFilter] = useState<string | null>(
    searchParams.get('symbol'),
  )

  const isMarketPage = mode === 'markets'
  const isAdminPage = mode === 'admin'

  const refreshDashboard = useCallback(
    async (connectedAddress?: string | null, showSpinner = false) => {
      if (showSpinner) {
        setIsRefreshing(true)
      }

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
    const refreshSilently = () => {
      void refreshDashboard(address)
    }

    const intervalId = window.setInterval(refreshSilently, 25000)
    return () => window.clearInterval(intervalId)
  }, [address, refreshDashboard])

  useEffect(() => {
    let cancelled = false

    const refreshRiskCards = async () => {
      let tvlData: Awaited<ReturnType<typeof getStablecoinTVL>> | null = null
      try {
        tvlData = await getStablecoinTVL()
      } catch (e) {
        console.warn('TVL fetch failed:', e)
      }

      try {
        const quotes = await getStableQuotes()

        if (cancelled) {
          return
        }

        setRiskCards((prev) => [
          {
            symbol: 'USDC',
            pegValue: `$${quotes.USDC.price.toFixed(4)}`,
            tvl: tvlData?.USDC?.formattedTVL ?? prev[0]?.tvl ?? 'N/A',
            riskScore: 100 - getStableHealthScore(quotes.USDC.price),
            riskLabel: getStableRiskLabel(quotes.USDC.price),
            note: `Live CMC price. 24h change ${quotes.USDC.percentChange24h.toFixed(2)}%.`,
          },
          {
            symbol: 'EURC',
            pegValue: `€${quotes.EURC.price.toFixed(4)}`,
            tvl: tvlData?.EURC?.formattedTVL ?? prev[1]?.tvl ?? 'N/A',
            riskScore: 100 - getStableHealthScore(quotes.EURC.price),
            riskLabel: getStableRiskLabel(quotes.EURC.price),
            note: `Live CMC price. 24h change ${quotes.EURC.percentChange24h.toFixed(2)}%.`,
          },
        ])
      } catch (error) {
        if (cancelled) {
          return
        }

        // Even if CMC fails, still update TVL if we got it
        if (tvlData) {
          setRiskCards((prev) =>
            prev.map((card) => ({
              ...card,
              tvl: tvlData![card.symbol]?.formattedTVL ?? card.tvl,
            })),
          )
        }

        const message =
          error instanceof Error ? error.message : 'Could not fetch CoinMarketCap prices.'
        setStatusMessage(message)
      }
    }

    void refreshRiskCards()
    const intervalId = window.setInterval(() => {
      void refreshRiskCards()
    }, 5 * 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function fetchCharts() {
      try {
        const [usdcPrice, eurcPrice, usdcTvl, eurcTvl] = await Promise.all([
          fetch('/api/price-chart?symbol=USDC'),
          fetch('/api/price-chart?symbol=EURC'),
          fetch('/api/tvl-chart?symbol=USDC'),
          fetch('/api/tvl-chart?symbol=EURC'),
        ])
        if (cancelled) return
        const [usdcP, eurcP, usdcT, eurcT] = await Promise.all([
          usdcPrice.json(), eurcPrice.json(), usdcTvl.json(), eurcTvl.json(),
        ])
        setPriceCharts({
          USDC: usdcP.points ?? [],
          EURC: eurcP.points ?? [],
        })
        setTvlCharts({
          USDC: usdcT.points ?? [],
          EURC: eurcT.points ?? [],
        })
      } catch (e) {
        console.warn('Chart fetch failed:', e)
      }
    }

    void fetchCharts()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (isConnected) {
      setIsConnectModalOpen(false)
    } else {
      setIsWalletDropdownOpen(false)
    }
  }, [isConnected])

  const isOwner =
    address !== undefined && owner !== '' && address.toLowerCase() === owner.toLowerCase()

  const activeMarkets = useMemo(() => {
    const open = markets.filter((market) => !market.isSettled)
    if (!symbolFilter) return open
    return open.filter((market) =>
      market.description.toUpperCase().includes(symbolFilter.toUpperCase()),
    )
  }, [markets, symbolFilter])

  // Group markets by symbol + deadline + question type for Polymarket-style UI
  const groupedMarkets = useMemo(() => {
    const groups: Record<string, { symbol: string; deadline: string; questionType: string; markets: MarketView[] }> = {}
    for (const market of activeMarkets) {
      const desc = getMarketDescriptor(market.description, 0)
      const descUpper = market.description.toUpperCase()
      const questionType = descUpper.includes('TVL') ? 'tvl' : descUpper.includes('DEPEG') || descUpper.includes('PEG') ? 'depeg' : 'other'
      const key = `${desc.symbol}::${desc.deadlineLabel}::${questionType}`
      if (!groups[key]) {
        groups[key] = { symbol: desc.symbol, deadline: desc.deadlineLabel, questionType, markets: [] }
      }
      groups[key].markets.push(market)
    }
    return Object.values(groups)
  }, [activeMarkets])
  const totalStaked = useMemo(
    () => markets.reduce((sum, market) => sum + market.totalWinBets + market.totalLoseBets, 0n),
    [markets],
  )

  const settledMarkets = useMemo(() => markets.filter((m) => m.isSettled), [markets])

  const claimableMarkets = useMemo(() => {
    if (!isConnected) return []
    return markets.filter((m) => {
      if (!m.isSettled) return false
      if (m.outcome === 1) return m.userWinBet > 0n        // Yes won, user bet Yes
      if (m.outcome === 2) return m.userLoseBet > 0n       // No won, user bet No
      if (m.outcome === 3) return m.userWinBet > 0n || m.userLoseBet > 0n  // Invalid → refund
      return false
    })
  }, [markets, isConnected])

  const executeAction = useCallback(
    async (label: string, action: (client: NonNullable<typeof walletClient>) => Promise<void>) => {
      setActionLoading(label)
      setStatusMessage(`${label} in progress...`)

      try {
        if (!isConnected || !address) {
          throw new Error('Connect a wallet before sending transactions.')
        }

        if (chainId !== ARC_NETWORK.chainId) {
          if (switchChainAsync) {
            await switchChainAsync({ chainId: ARC_NETWORK.chainId })
            throw new Error('Switched to Arc Testnet. Retry the action once the wallet reconnects.')
          }

          throw new Error('Switch your wallet to Arc Testnet to continue.')
        }

        if (!walletClient) {
          throw new Error('Wallet client is not ready yet. Please reconnect and try again.')
        }

        await action(walletClient)
        await refreshDashboard(address, true)
        setStatusMessage(`${label} completed successfully.`)
      } catch (error) {
        const message = error instanceof Error ? error.message : `${label} failed.`
        setStatusMessage(message)
      } finally {
        setActionLoading(null)
      }
    },
    [address, chainId, isConnected, refreshDashboard, switchChainAsync, walletClient],
  )

  const handleConnect = async (connectorId?: string) => {
    try {
      const connector = connectors.find((item) => item.id === connectorId) ?? connectors[0]

      if (!connector) {
        throw new Error('No wallet connectors are available.')
      }

      if (connector.id === 'walletConnect' && !hasWalletConnectProjectId) {
        throw new Error('Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in frontend/.env to enable WalletConnect.')
      }

      await connectAsync({ connector })
      setStatusMessage(`Wallet connection started with ${connector.name}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet connection failed.'
      setStatusMessage(message)
    }
  }

  const goToMarketPage = () => router.push('/markets')
  const goToLandingPage = () => router.push('/')
  const goToAdminPage = () => router.push('/admin')

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-text">
      {/* SVG background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg
          className="absolute inset-0 h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            {/* Dot grid pattern */}
            <pattern id="dot-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="currentColor" className="text-slate-300/40" />
            </pattern>
            {/* Radial fade mask so edges of the dot grid fade out */}
            <radialGradient id="dot-fade" cx="50%" cy="40%" r="55%">
              <stop offset="0%" stopColor="white" stopOpacity="1" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <mask id="dot-mask">
              <rect width="100%" height="100%" fill="url(#dot-fade)" />
            </mask>
            {/* Cyan glow gradient */}
            <radialGradient id="glow-cyan" cx="15%" cy="10%" r="40%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
            {/* Royal blue glow gradient */}
            <radialGradient id="glow-royal" cx="85%" cy="15%" r="40%">
              <stop offset="0%" stopColor="#3b4ff0" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#3b4ff0" stopOpacity="0" />
            </radialGradient>
            {/* Bottom accent */}
            <radialGradient id="glow-bottom" cx="55%" cy="100%" r="35%">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.07" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Dot grid layer */}
          <rect width="100%" height="100%" fill="url(#dot-grid)" mask="url(#dot-mask)" />

          {/* Glow orbs */}
          <rect width="100%" height="100%" fill="url(#glow-cyan)" />
          <rect width="100%" height="100%" fill="url(#glow-royal)" />
          <rect width="100%" height="100%" fill="url(#glow-bottom)" />

          {/* Decorative arc lines — top-left */}
          <g stroke="#06b6d4" strokeWidth="0.6" fill="none" opacity="0.18">
            <ellipse cx="-60" cy="-60" rx="260" ry="260" />
            <ellipse cx="-60" cy="-60" rx="340" ry="340" />
            <ellipse cx="-60" cy="-60" rx="420" ry="420" />
          </g>

          {/* Decorative arc lines — bottom-right */}
          <g stroke="#3b4ff0" strokeWidth="0.6" fill="none" opacity="0.12">
            <ellipse cx="110%" cy="110%" rx="280" ry="280" />
            <ellipse cx="110%" cy="110%" rx="380" ry="380" />
          </g>
        </svg>
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card sticky top-4 z-30 flex flex-col gap-4 rounded-[28px] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <button type="button" onClick={goToLandingPage} className="relative h-20 w-[200px] shrink-0 ml-1 cursor-pointer">
              <Image
                src={pegPulseLogo}
                alt="PegPulse logo"
                className="h-full w-full object-contain object-left"
                priority
                fill
                sizes="340px"
              />
            </button>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              {(isMarketPage || isAdminPage) && (
                <button
                  type="button"
                  onClick={goToLandingPage}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Overview
                </button>
              )}
              {!isMarketPage && !isAdminPage && (
                <button
                  type="button"
                  onClick={isOwner ? goToAdminPage : goToMarketPage}
                  className="inline-flex items-center gap-2 rounded-full bg-cyan-royal px-5 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
                >
                  Get Started
                </button>
              )}
              {(isMarketPage || isAdminPage) ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (isConnected) {
                        setIsWalletDropdownOpen((prev) => !prev)
                      } else {
                        setIsConnectModalOpen(true)
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-cyan-royal px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
                  >
                    <Wallet2 className="h-4 w-4 shrink-0" />
                    {address ? (
                      <span className="flex flex-col leading-tight">
                        <span>{shortenAddress(address)}</span>
                        {balanceData?.value !== undefined && (
                          <span className="text-[11px] font-normal opacity-80">
                            {formatAmount(balanceData.value)} USDC
                          </span>
                        )}
                      </span>
                    ) : 'Connect Wallet'}
                  </button>

                  {isWalletDropdownOpen && isConnected && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsWalletDropdownOpen(false)}
                      />
                      {/* Dropdown */}
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-[20px] border border-slate-200/80 bg-white/95 shadow-xl backdrop-blur-xl"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            disconnect()
                            setIsWalletDropdownOpen(false)
                          }}
                          className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4" />
                          Disconnect
                        </button>
                      </motion.div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </motion.header>

        {isConnectModalOpen ? (
          <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/20 px-4 pt-24 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card z-50 w-full max-w-md rounded-[28px] p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="panel-label">Wallet Connection</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-slate-900">
                    Choose your wallet
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Injected wallets connect directly. WalletConnect opens a QR flow for mobile and
                    desktop wallets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="rounded-full border border-slate-200/80 bg-white/80 p-2 text-muted transition hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 grid gap-3">
                {connectors.map((connector) => (
                  <button
                    key={connector.id}
                    type="button"
                    onClick={() => void handleConnect(connector.id)}
                    disabled={isConnecting}
                    className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 text-left transition hover:border-cyan/30 hover:bg-cyan/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-royal text-white">
                        {connector.id === 'walletConnect' ? (
                          <QrCode className="h-5 w-5" />
                        ) : (
                          <Wallet2 className="h-5 w-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{connector.name}</p>
                        <p className="text-xs text-muted">
                          {connector.id === 'walletConnect'
                            ? 'Open QR modal and connect any compatible wallet.'
                            : 'Use an injected browser wallet such as MetaMask.'}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-cyan" />
                  </button>
                ))}

                {!hasWalletConnectProjectId ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    WalletConnect is wired, but you still need to set
                    ` NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ` in `frontend/.env`.
                  </div>
                ) : null}
              </div>
            </motion.div>
          </div>
        ) : null}

        <main className="mt-6 grid gap-8">
          <p className="sr-only">{statusMessage}</p>
          {isAdminPage ? (
            <AdminPanel
              markets={markets}
              isOwner={isOwner}
              isConnected={isConnected}
              isBusy={actionLoading !== null}
              isRefreshing={isRefreshing}
              onRefresh={() => void refreshDashboard(address, true)}
              onCreateMarket={(description) =>
                executeAction('Creating market', async (client) => {
                  await createMarket(client, description)
                })
              }
              onSettle={(marketAddress, outcome) =>
                executeAction('Settling market', async (client) => {
                  await settleMarket(client, marketAddress, outcome)
                })
              }
              onConnect={() => setIsConnectModalOpen(true)}
            />
          ) : isMarketPage ? (
            <>
              <section className="grid gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="glass-card rounded-[30px] p-6"
                >
                  {/* Tab header */}
                  <div className="flex flex-wrap items-center justify-between gap-4">
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
                        {groupedMarkets.length > 0 && (
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                            marketTab === 'active' ? 'bg-cyan/15 text-cyan' : 'bg-slate-200 text-muted'
                          }`}>
                            {groupedMarkets.length}
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

                    {marketTab === 'active' && symbolFilter && (
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-cyan/20 bg-cyan/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan">
                          {symbolFilter}
                        </span>
                        <button
                          type="button"
                          onClick={() => { setSymbolFilter(null); router.replace('/markets') }}
                          className="rounded-full border border-slate-200/80 bg-white/80 p-1 text-muted transition hover:text-slate-900"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Active tab */}
                  {marketTab === 'active' && (
                    <div className="mt-6 grid gap-5">
                      {isLoading ? (
                        <div className="rounded-[26px] border border-slate-200/80 bg-white/80 px-5 py-10 text-center text-muted">
                          Loading Arc markets...
                        </div>
                      ) : groupedMarkets.length === 0 ? (
                        <div className="rounded-[26px] border border-dashed border-slate-200/80 bg-white/80 px-5 py-10 text-center text-muted">
                          There are no active markets right now. Check back later for the next live hedge window.
                        </div>
                      ) : (
                        groupedMarkets.map((group) => (
                          <MarketGroupCard
                            key={`${group.symbol}::${group.deadline}::${group.questionType}`}
                            group={group}
                            isOwner={isOwner}
                            isBusy={actionLoading !== null}
                            priceData={priceCharts[group.symbol] ?? []}
                            tvlData={tvlCharts[group.symbol] ?? []}
                            currentPrice={riskCards.find((c) => c.symbol === group.symbol)?.pegValue ?? ''}
                            onBet={(marketAddress, side, amount) =>
                              executeAction(
                                side === 'win' ? 'Placing Yes bet' : 'Placing No bet',
                                async (client) => { await placeBet(client, marketAddress, side, amount) },
                              )
                            }
                            onSettle={(marketAddress, outcome) =>
                              executeAction('Settling market', async (client) => {
                                await settleMarket(client, marketAddress, outcome)
                              })
                            }
                            onWithdraw={(marketAddress) =>
                              executeAction('Withdrawing winnings', async (client) => {
                                await withdrawWinnings(client, marketAddress)
                              })
                            }
                          />
                        ))
                      )}
                    </div>
                  )}

                  {/* Past tab */}
                  {marketTab === 'past' && (
                    <div className="mt-6 grid gap-4">
                      {/* Claimable banner */}
                      {claimableMarkets.length > 0 && (
                        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/80 px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">💰</span>
                            <p className="text-sm font-semibold text-emerald-800">
                              You have {claimableMarkets.length} unclaimed {claimableMarkets.length === 1 ? 'position' : 'positions'} — scroll down to claim
                            </p>
                          </div>
                        </div>
                      )}

                      {isLoading ? (
                        <div className="rounded-[26px] border border-slate-200/80 bg-white/80 px-5 py-10 text-center text-muted">
                          Loading past markets...
                        </div>
                      ) : settledMarkets.length === 0 ? (
                        <div className="rounded-[26px] border border-dashed border-slate-200/80 bg-white/80 px-5 py-10 text-center text-muted">
                          No past markets yet.
                        </div>
                      ) : (
                        settledMarkets.map((market) => {
                          const desc = getMarketDescriptor(market.description, 0)
                          const hasPosition = market.userWinBet > 0n || market.userLoseBet > 0n
                          const isClaimable = claimableMarkets.some((m) => m.address === market.address)

                          const outcomeConfig = {
                            1: { label: 'Yes won', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
                            2: { label: 'No won', bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200' },
                            3: { label: 'Invalid', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
                          }[market.outcome] ?? { label: 'Settled', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' }

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
                              className={`rounded-[22px] border bg-white/90 p-5 transition ${
                                isClaimable ? 'border-emerald-200 ring-1 ring-emerald-300/50' : 'border-slate-200/80'
                              }`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                {/* Left: info */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <TokenBadge symbol={desc.symbol} size="md" />
                                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${outcomeConfig.bg} ${outcomeConfig.text} ${outcomeConfig.border}`}>
                                      {outcomeConfig.label}
                                    </span>
                                    {hasPosition && (
                                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                        userWon ? 'bg-emerald-50 text-emerald-700'
                                        : userLost ? 'bg-rose-50 text-rose-600'
                                        : 'bg-amber-50 text-amber-700'
                                      }`}>
                                        {userWon ? '🎉 You won' : userLost ? '😔 You lost' : '↩ Refund'}
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

                                {/* Right: claim or result */}
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
                    </div>
                  )}
                </motion.div>
              </section>
            </>
          ) : (
            <>
              <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                <motion.article
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="glass-card rounded-[32px] bg-hero-grid p-8 sm:p-10"
                >
                  <div className="max-w-2xl">
                    <h2 className="mt-4 font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                      Hedge de-peg risk faster.
                    </h2>
                    <p className="mt-5 text-base leading-7 text-muted sm:text-lg">
                      Track stablecoin stress and move into hedge markets with a clean execution
                      flow.
                    </p>

                    <div className="mt-8 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={isOwner ? goToAdminPage : goToMarketPage}
                        className="inline-flex items-center gap-2 rounded-full bg-cyan-royal px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
                      >
                        Get Started
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.article>

                <motion.aside
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="grid gap-4"
                >
                  <QuickStatCard
                    label="Active Markets"
                    value={String(activeMarkets.length)}
                    icon={<Activity className="h-5 w-5" />}
                  />
                  <QuickStatCard
                    label="Total Staked"
                    value={`${formatAmount(totalStaked)} USDC`}
                    icon={<CircleDollarSign className="h-5 w-5" />}
                  />
                </motion.aside>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                {riskCards.map((asset, index) => (
                  <motion.article
                    key={asset.symbol}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + index * 0.05 }}
                    onClick={() => router.push(`/markets?symbol=${asset.symbol}`)}
                    className="glass-card cursor-pointer rounded-[30px] p-6 transition-all hover:scale-[1.02] hover:border-cyan/40 hover:shadow-lg"
                  >
                    <div className="flex items-center gap-4">
                      <TokenBadge symbol={asset.symbol} size="lg" />
                      <h3 className="font-display text-2xl font-semibold text-slate-900">
                        {asset.symbol}
                      </h3>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      <MetricCard
                        label="Current Peg"
                        value={asset.pegValue}
                        accent="cyan"
                        icon={<CircleDollarSign className="h-4 w-4" />}
                      />
                      <MetricCard
                        label="TVL"
                        value={asset.tvl}
                        accent="royal"
                        icon={<Landmark className="h-4 w-4" />}
                      />
                      <MetricCard
                        label="Risk Score"
                        value={`${asset.riskScore}/100`}
                        accent="cyan"
                        icon={<ShieldAlert className="h-4 w-4" />}
                      />
                    </div>

                    <div className="mt-6">
                      <p className="mb-2 text-xs uppercase tracking-[0.22em] text-muted">
                        Price (30d)
                      </p>
                      <div className="h-24">
                        {(priceCharts[asset.symbol]?.length ?? 0) > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={priceCharts[asset.symbol]}>
                              <defs>
                                <linearGradient id={`grad-${asset.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#00F5FF" stopOpacity={0.3} />
                                  <stop offset="100%" stopColor="#00F5FF" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <YAxis domain={['dataMin', 'dataMax']} hide />
                              <Tooltip
                                contentStyle={{
                                  background: 'white',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                }}
                                formatter={(value) => [`$${Number(value).toFixed(4)}`, 'Price']}
                              />
                              <Area
                                type="monotone"
                                dataKey="price"
                                stroke="#0033AD"
                                strokeWidth={2}
                                fill={`url(#grad-${asset.symbol})`}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted">
                            Loading chart...
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.article>
                ))}
              </section>

              {/* Powered by section */}
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex flex-col items-center gap-6 py-4"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted/60">
                  Built on trusted infrastructure
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {/* DefiLlama */}
                  <a
                    href="https://defillama.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:shadow-md"
                  >
                    <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                      <circle cx="16" cy="16" r="16" fill="#2172E5" />
                      <path d="M9 22V10l7 4 7-4v12l-7-4-7 4z" fill="white" opacity="0.9" />
                    </svg>
                    DefiLlama
                  </a>

                  {/* CoinMarketCap */}
                  <a
                    href="https://coinmarketcap.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:shadow-md"
                  >
                    <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                      <circle cx="16" cy="16" r="16" fill="#17C3B2" />
                      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">C</text>
                    </svg>
                    CoinMarketCap
                  </a>

                  {/* Arc Network */}
                  <a
                    href="https://arc.network"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:shadow-md"
                  >
                    <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                      <circle cx="16" cy="16" r="16" fill="#0033AD" />
                      <path d="M16 7 L25 23 H7 Z" fill="none" stroke="white" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                    Arc Network
                  </a>

                  {/* Circle (USDC / EURC) */}
                  <a
                    href="https://circle.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:border-slate-300 hover:shadow-md"
                  >
                    <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                      <circle cx="16" cy="16" r="16" fill="#2775CA" />
                      <circle cx="16" cy="16" r="7" fill="none" stroke="white" strokeWidth="2.5" />
                    </svg>
                    Circle
                  </a>

                </div>
              </motion.section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

type AdminPanelProps = {
  markets: MarketView[]
  isOwner: boolean
  isConnected: boolean
  isBusy: boolean
  isRefreshing: boolean
  onRefresh: () => void
  onCreateMarket: (description: string) => Promise<void>
  onSettle: (marketAddress: string, outcome: 1 | 2 | 3) => Promise<void>
  onConnect: () => void
}

function AdminPanel({
  markets,
  isOwner,
  isConnected,
  isBusy,
  isRefreshing,
  onRefresh,
  onCreateMarket,
  onSettle,
  onConnect,
}: AdminPanelProps) {
  const [description, setDescription] = useState('')

  if (!isConnected) {
    return (
      <section className="grid gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-[30px] p-6 text-center"
        >
          <Settings className="mx-auto h-12 w-12 text-muted/40" />
          <h3 className="mt-4 font-display text-2xl font-semibold text-slate-900">
            Admin Panel
          </h3>
          <p className="mt-2 text-sm text-muted">
            Connect the owner wallet to access admin controls.
          </p>
          <button
            type="button"
            onClick={onConnect}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-cyan-royal px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02]"
          >
            <Wallet2 className="h-4 w-4" />
            Connect Wallet
          </button>
        </motion.div>
      </section>
    )
  }

  if (!isOwner) {
    return (
      <section className="grid gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-[30px] p-6 text-center"
        >
          <ShieldAlert className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-4 font-display text-2xl font-semibold text-slate-900">
            Access Denied
          </h3>
          <p className="mt-2 text-sm text-muted">
            This wallet is not the contract owner. Only the owner can access admin controls.
          </p>
        </motion.div>
      </section>
    )
  }

  return (
    <section className="grid gap-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass-card rounded-[30px] p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="panel-label">Admin Controls</p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-slate-900">
              Create &amp; Settle Markets
            </h3>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm text-slate-900 transition hover:border-cyan/30 hover:text-cyan"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mt-6 rounded-[24px] border border-slate-200/80 bg-white/75 p-5">
          <h4 className="font-display text-lg font-semibold text-slate-900">Create New Market</h4>
          <p className="mt-1 text-sm text-muted">
            Enter a description like: &quot;USDC de-pegs below $0.99 by July 1 2026&quot;
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              type="text"
              className="flex-1 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan/40"
              placeholder="Market description..."
            />
            <button
              type="button"
              disabled={!description.trim() || isBusy}
              onClick={() => {
                void onCreateMarket(description.trim())
                setDescription('')
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-royal px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Create Market
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          <h4 className="font-display text-lg font-semibold text-slate-900">
            All Markets ({markets.length})
          </h4>
          {markets.length === 0 ? (
            <div className="rounded-[26px] border border-dashed border-slate-200/80 bg-white/80 px-5 py-10 text-center text-muted">
              No markets created yet.
            </div>
          ) : (
            markets.map((market, index) => (
              <div
                key={market.address}
                className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(238,244,255,0.95))] p-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-muted">
                        #{index + 1}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                          market.isSettled
                            ? 'border border-green-200 bg-green-50 text-green-700'
                            : 'border border-cyan/20 bg-cyan/10 text-cyan'
                        }`}
                      >
                        {market.isSettled ? outcomeLabel(market.outcome) : 'Open'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-900">{market.description}</p>
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
                      <span>Yes Pool: {formatAmount(market.totalWinBets)} USDC</span>
                      <span>No Pool: {formatAmount(market.totalLoseBets)} USDC</span>
                      <span className="font-mono text-xs">{market.address}</span>
                    </div>
                  </div>

                  {!market.isSettled && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => void onSettle(market.address, 1)}
                        disabled={isBusy}
                        className="rounded-xl bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Settle Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => void onSettle(market.address, 2)}
                        disabled={isBusy}
                        className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Settle No
                      </button>
                      <button
                        type="button"
                        onClick={() => void onSettle(market.address, 3)}
                        disabled={isBusy}
                        className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Invalid
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </section>
  )
}

type MarketGroup = {
  symbol: string
  deadline: string
  questionType: string
  markets: MarketView[]
}

type TvlPoint = { time: string; tvl: number; tvlFormatted: string }

type MarketGroupCardProps = {
  group: MarketGroup
  isOwner: boolean
  isBusy: boolean
  priceData: PricePoint[]
  tvlData: TvlPoint[]
  currentPrice: string
  onBet: (marketAddress: string, side: 'win' | 'lose', amount: string) => Promise<void>
  onSettle: (marketAddress: string, outcome: 1 | 2 | 3) => Promise<void>
  onWithdraw: (marketAddress: string) => Promise<void>
}

function MarketGroupCard({ group, isOwner, isBusy, priceData, tvlData, currentPrice, onBet, onSettle, onWithdraw }: MarketGroupCardProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [amount, setAmount] = useState('0.05')
  const [selectedSide, setSelectedSide] = useState<'win' | 'lose'>('win')

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

  return (
    <motion.article
      layout
      className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(238,244,255,0.95))] shadow-glow backdrop-blur-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <TokenBadge symbol={group.symbol} size="md" />
          <div>
            <h4 className="font-display text-xl font-semibold text-slate-900">
              {group.symbol} {group.questionType === 'tvl' ? 'TVL' : 'De-peg'} Markets
            </h4>
            <p className="text-sm text-muted">
              {group.questionType === 'tvl'
                ? `Will ${group.symbol} TVL drop before ${group.deadline}?`
                : `Will ${group.symbol} lose its peg before ${group.deadline}?`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Total Volume</p>
          <p className="text-lg font-semibold text-slate-900">{formatAmount(totalVolume)} USDC</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-px border-b border-slate-200/60 bg-slate-200/60">
        <div className="bg-white/95 px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Price (30d)</p>
          <div className="mt-1 h-20">
            {priceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={priceData}>
                  <defs>
                    <linearGradient id={`price-g-${group.symbol}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0033AD" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#0033AD" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={['dataMin', 'dataMax']} hide />
                  <Tooltip
                    contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px' }}
                    formatter={(value) => [`$${Number(value).toFixed(4)}`, 'Price']}
                  />
                  <Area type="monotone" dataKey="price" stroke="#0033AD" strokeWidth={1.5} fill={`url(#price-g-${group.symbol})`} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted">Loading...</div>
            )}
          </div>
        </div>
        <div className="bg-white/95 px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">TVL (30d)</p>
          <div className="mt-1 h-20">
            {tvlData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tvlData}>
                  <defs>
                    <linearGradient id={`tvl-g-${group.symbol}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00F5FF" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#00F5FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis domain={['dataMin', 'dataMax']} hide />
                  <Tooltip
                    contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px' }}
                    formatter={(value) => {
                      const v = Number(value)
                      if (v >= 1e9) return [`$${(v / 1e9).toFixed(2)}B`, 'TVL']
                      if (v >= 1e6) return [`$${(v / 1e6).toFixed(1)}M`, 'TVL']
                      return [`$${v.toLocaleString()}`, 'TVL']
                    }}
                  />
                  <Area type="monotone" dataKey="tvl" stroke="#0891B2" strokeWidth={1.5} fill={`url(#tvl-g-${group.symbol})`} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted">Loading...</div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row">
        {/* Left: Tier list */}
        <div className="flex-1 divide-y divide-slate-100">
          {tiers.map((tier, index) => {
            const isActive = index === selectedIndex
            const yesPercent = (tier.yesPrice * 100).toFixed(0)
            return (
              <button
                key={tier.market.address}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={`flex w-full items-center gap-4 px-6 py-4 text-left transition ${
                  isActive ? 'bg-cyan/5' : 'hover:bg-slate-50'
                }`}
              >
                {/* Threshold label */}
                <div className="w-28 shrink-0">
                  <p className="text-sm font-semibold text-slate-900">{tier.desc.thresholdLabel}</p>
                  <p className="text-xs text-muted">{currentPrice}</p>
                </div>

                {/* Probability bar */}
                <div className="flex flex-1 items-center gap-3">
                  <span className="w-10 text-right text-sm font-bold text-slate-900">{yesPercent}%</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${yesPercent}%` }}
                    />
                  </div>
                </div>

                {/* Buy buttons */}
                <div className="flex shrink-0 gap-2">
                  <span className="rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    Yes {yesPercent}¢
                  </span>
                  <span className="rounded-xl bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-700">
                    No {(tier.noPrice * 100).toFixed(0)}¢
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Right: Trade panel for selected tier */}
        <div className="w-full border-t border-slate-200/60 xl:w-80 xl:border-l xl:border-t-0">
          <div className="p-5">
            <p className="text-xs font-medium text-muted">
              {selected.desc.thresholdLabel} de-peg
            </p>

            {/* Yes / No selector */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedSide('win')}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  selectedSide === 'win'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'border border-slate-200/80 bg-white/80 text-slate-600 hover:border-emerald-300'
                }`}
              >
                Yes {(selected.yesPrice * 100).toFixed(0)}¢
              </button>
              <button
                type="button"
                onClick={() => setSelectedSide('lose')}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  selectedSide === 'lose'
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'border border-slate-200/80 bg-white/80 text-slate-600 hover:border-rose-300'
                }`}
              >
                No {(selected.noPrice * 100).toFixed(0)}¢
              </button>
            </div>

            {/* Amount */}
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

            {/* Quick amounts */}
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

            {/* Payout */}
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

            {/* Trade button */}
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

            {/* Withdraw */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {isOwner && !selected.market.isSettled && (
                <>
                  <MiniButton label="Settle Yes" onClick={() => void onSettle(selected.market.address, 1)} disabled={isBusy} />
                  <MiniButton label="Settle No" onClick={() => void onSettle(selected.market.address, 2)} disabled={isBusy} />
                  <MiniButton label="Invalid" onClick={() => void onSettle(selected.market.address, 3)} disabled={isBusy} />
                </>
              )}
              <MiniButton
                label="Withdraw"
                onClick={() => void onWithdraw(selected.market.address)}
                disabled={!selected.market.isSettled || isBusy}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

type MarketCardProps = {
  market: MarketView
  descriptor: MarketDescriptor
  isOwner: boolean
  isBusy: boolean
  onBet: (side: 'win' | 'lose', amount: string) => Promise<void>
  onSettle: (outcome: 1 | 2 | 3) => Promise<void>
  onWithdraw: () => Promise<void>
}

function MarketCard({
  market,
  descriptor,
  isOwner,
  isBusy,
  onBet,
  onSettle,
  onWithdraw,
}: MarketCardProps) {
  const [amount, setAmount] = useState('0.05')
  const [selectedSide, setSelectedSide] = useState<'win' | 'lose'>('win')
  const timeRemaining = getTimeRemaining(descriptor.deadline)
  const totalPool = market.totalWinBets + market.totalLoseBets

  const FEE_BPS = 1000n // 1/1000 = 0.1%
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

  // Implied prices (what 1 share costs)
  const yesPrice = totalPool > 0n ? Number(market.totalWinBets) / Number(totalPool) : 0.5
  const noPrice = totalPool > 0n ? Number(market.totalLoseBets) / Number(totalPool) : 0.5

  // Potential payout calculation
  const potentialPayout = (() => {
    if (afterFee <= 0n) return 0

    if (selectedSide === 'win') {
      const newYesPool = market.totalWinBets + afterFee
      const newTotal = totalPool + afterFee
      return Number(newTotal) * Number(afterFee) / Number(newYesPool) / 1e18
    } else {
      const newNoPool = market.totalLoseBets + afterFee
      const newTotal = totalPool + afterFee
      return Number(newTotal) * Number(afterFee) / Number(newNoPool) / 1e18
    }
  })()

  const betAmountNum = parseFloat(amount) || 0
  const profit = potentialPayout - betAmountNum

  const QUICK_AMOUNTS = ['0.01', '0.05', '0.1', '0.5', '1']

  return (
    <motion.article
      layout
      className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(238,244,255,0.95))] p-5 shadow-glow backdrop-blur-xl"
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <TokenBadge symbol={descriptor.symbol} size="md" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-display text-xl font-semibold text-slate-900">
                  {descriptor.symbol}
                </h4>
                <span className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
                  {market.isSettled ? outcomeLabel(market.outcome) : 'Open'}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{market.description}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatPill label="De-peg Threshold" value={descriptor.thresholdLabel} />
            <StatPill label="Deadline" value={descriptor.deadlineLabel} />
            <StatPill
              label="Time Remaining"
              value={timeRemaining}
              icon={<Clock3 className="h-4 w-4" />}
            />
            <StatPill label="Total Stake" value={`${formatAmount(totalPool)} USDC`} />
          </div>
        </div>

        <div className="w-full xl:max-w-sm">
          <div className="rounded-[24px] border border-slate-200/80 bg-white/75 p-4">
            {/* Yes / No side selector with implied prices */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedSide('win')}
                className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold transition ${
                  selectedSide === 'win'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : 'border border-slate-200/80 bg-white/80 text-slate-600 hover:border-emerald-300'
                }`}
              >
                Yes {(yesPrice * 100).toFixed(0)}¢
              </button>
              <button
                type="button"
                onClick={() => setSelectedSide('lose')}
                className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold transition ${
                  selectedSide === 'lose'
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'border border-slate-200/80 bg-white/80 text-slate-600 hover:border-rose-300'
                }`}
              >
                No {(noPrice * 100).toFixed(0)}¢
              </button>
            </div>

            {/* Amount input */}
            <div className="mt-4">
              <label className="text-xs font-medium text-muted">Amount</label>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-lg font-semibold text-slate-900 outline-none transition focus:border-cyan/40"
                placeholder="0.00"
              />
            </div>

            {/* Quick amount buttons */}
            <div className="mt-3 flex gap-2">
              {QUICK_AMOUNTS.map((qa) => (
                <button
                  key={qa}
                  type="button"
                  onClick={() => setAmount(qa)}
                  className="flex-1 rounded-xl border border-slate-200/80 bg-white/80 py-1.5 text-xs font-medium text-slate-600 transition hover:border-cyan/30 hover:text-cyan"
                >
                  +{qa}
                </button>
              ))}
            </div>

            {/* Payout preview */}
            {betAmountNum > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200/60 bg-slate-50/80 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">To win</span>
                  <span className="text-lg font-bold text-emerald-600">
                    {potentialPayout.toFixed(4)} USDC
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-muted">Profit</span>
                  <span className={`text-sm font-semibold ${profit > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                    +{profit.toFixed(4)} USDC ({betAmountNum > 0 ? ((profit / betAmountNum) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              </div>
            )}

            {/* Trade button */}
            <button
              type="button"
              onClick={() => void onBet(selectedSide, amount)}
              disabled={market.isSettled || isBusy || betAmountNum <= 0}
              className={`mt-4 w-full rounded-2xl px-4 py-3.5 text-sm font-semibold transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 ${
                selectedSide === 'win'
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                  : 'bg-rose-500 text-white hover:bg-rose-600'
              }`}
            >
              {selectedSide === 'win' ? 'Buy Yes' : 'Buy No'}
            </button>

            {/* Pool info */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 px-2 py-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Yes Pool</p>
                <p className="text-xs font-semibold text-slate-900">{formatAmount(market.totalWinBets)}</p>
              </div>
              <div className="rounded-xl bg-rose-50 px-2 py-1.5">
                <p className="text-xs font-medium uppercase tracking-wider text-rose-600">No Pool</p>
                <p className="text-xs font-semibold text-slate-900">{formatAmount(market.totalLoseBets)}</p>
              </div>
            </div>

            {/* Admin settle / Withdraw */}
            <div className="mt-3 flex flex-wrap gap-2">
              {isOwner && !market.isSettled ? (
                <>
                  <MiniButton label="Settle Yes" onClick={() => void onSettle(1)} disabled={isBusy} />
                  <MiniButton label="Settle No" onClick={() => void onSettle(2)} disabled={isBusy} />
                  <MiniButton label="Invalid" onClick={() => void onSettle(3)} disabled={isBusy} />
                </>
              ) : null}
              <MiniButton
                label="Withdraw"
                onClick={() => void onWithdraw()}
                disabled={!market.isSettled || isBusy}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

function TokenBadge({
  symbol,
  size,
}: {
  symbol: string
  size: 'md' | 'lg'
}) {
  const normalizedSymbol = symbol.toUpperCase()
  const logoBySymbol: Record<string, StaticImageData> = {
    USDC: usdcLogo,
    EURC: eurcLogo,
  }
  const logoScaleBySymbol: Record<string, string> = {
    USDC: 'scale-[1.0]',
    EURC: 'scale-[1.02]',
  }

  const logo = logoBySymbol[normalizedSymbol]
  const containerSize = size === 'lg' ? 'h-14 w-14 rounded-2xl' : 'h-12 w-12 rounded-2xl'
  const imageSize = size === 'lg' ? 40 : 34

  if (logo) {
    return (
      <div className={`flex items-center justify-center overflow-hidden bg-white ${containerSize}`}>
        <Image
          src={logo}
          alt={`${symbol} logo`}
          width={imageSize}
          height={imageSize}
          className={`h-full w-full object-contain ${logoScaleBySymbol[normalizedSymbol] ?? ''}`}
        />
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-center bg-cyan-royal font-bold text-slate-950 ${containerSize} ${
        size === 'lg' ? 'text-lg' : 'text-base'
      }`}
    >
      {symbol.slice(0, 1)}
    </div>
  )
}

function QuickStatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: ReactNode
}) {
  return (
    <div className="glass-card rounded-[28px] p-5">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-muted">
        <span>{label}</span>
        <span className="text-cyan">{icon}</span>
      </div>
      <p className="mt-3 font-display text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string
  value: string
  accent: 'cyan' | 'royal'
  icon: ReactNode
}) {
  return (
    <div
      className={`rounded-[24px] border p-4 ${
        accent === 'cyan'
          ? 'border-cyan/20 bg-cyan/10'
          : 'border-blue-400/20 bg-blue-500/10'
      }`}
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-muted">
        <span>{label}</span>
        <span className={accent === 'cyan' ? 'text-cyan' : 'text-blue-600'}>{icon}</span>
      </div>
      <p className="mt-3 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}

function StatPill({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900 sm:text-base">{value}</p>
    </div>
  )
}

function MiniButton({
  label,
  onClick,
  disabled,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 transition hover:border-cyan/30 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}

function getMarketDescriptor(description: string, index: number): MarketDescriptor {
  const stablecoinMatch = description.match(/\b(USDC|USDT|DAI|FDUSD|USDE|FRAX|PYUSD|EURC)\b/i)
  const symbol = stablecoinMatch?.[1]?.toUpperCase() ?? `MKT-${index + 1}`

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

function getTimeRemaining(deadline: Date | null) {
  if (!deadline) {
    return 'Manual'
  }

  const remainingMs = deadline.getTime() - Date.now()

  if (remainingMs <= 0) {
    return 'Ready to settle'
  }

  const totalMinutes = Math.floor(remainingMs / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return `${days}d ${hours}h`
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m`
}
