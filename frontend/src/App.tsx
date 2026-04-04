'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Image, { type StaticImageData } from 'next/image'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
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
  TrendingDown,
  X,
  Wallet2,
} from 'lucide-react'
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWalletClient } from 'wagmi'
import {
  ARC_NETWORK,
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
import { hasWalletConnectProjectId } from './lib/wallet'
import eurcLogo from './assets/EURC-logo.png'
import pegPulseLogo from './assets/pegpulse_logo.png'
import usdcLogo from './assets/USDC-logo.png'

type AppMode = 'landing' | 'markets'

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
  threshold: string
  note: string
}

const LANDING_RISK_CARDS: RiskCard[] = [
  {
    symbol: 'USDC',
    riskLabel: 'Low Risk',
    riskScore: 18,
    pegValue: '$1.0002',
    threshold: '$0.99',
    note: 'Deep liquidity and broad market usage keep short-term de-peg pressure contained.',
  },
  {
    symbol: 'EURC',
    riskLabel: 'Moderate Watch',
    riskScore: 34,
    pegValue: 'EUR0.9988',
    threshold: 'EUR0.97',
    note: 'Cross-currency liquidity remains thinner, so stress events deserve closer monitoring.',
  },
]

type PegPulseAppProps = {
  mode: AppMode
}

export default function PegPulseApp({ mode }: PegPulseAppProps) {
  const router = useRouter()
  const { address, chainId, isConnected } = useAccount()
  const { connectors, connectAsync, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync } = useSwitchChain()
  const { data: walletClient } = useWalletClient()

  const [owner, setOwner] = useState<string>('')
  const [markets, setMarkets] = useState<MarketView[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
  const [riskCards, setRiskCards] = useState<RiskCard[]>(LANDING_RISK_CARDS)
  const [statusMessage, setStatusMessage] = useState(
    'PegPulse is actively monitoring Arc markets for stablecoin de-peg stress.',
  )
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const isMarketPage = mode === 'markets'

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
      try {
        const quotes = await getStableQuotes()

        if (cancelled) {
          return
        }

        setRiskCards([
          {
            symbol: 'USDC',
            pegValue: `$${quotes.USDC.price.toFixed(4)}`,
            threshold: '$0.99',
            riskScore: 100 - getStableHealthScore(quotes.USDC.price),
            riskLabel: getStableRiskLabel(quotes.USDC.price),
            note: `Live CMC price. 24h change ${quotes.USDC.percentChange24h.toFixed(2)}%.`,
          },
          {
            symbol: 'EURC',
            pegValue: `$${quotes.EURC.price.toFixed(4)}`,
            threshold: '$0.97',
            riskScore: 100 - getStableHealthScore(quotes.EURC.price),
            riskLabel: getStableRiskLabel(quotes.EURC.price),
            note: `Live CMC price. 24h change ${quotes.EURC.percentChange24h.toFixed(2)}%.`,
          },
        ])
      } catch (error) {
        if (cancelled) {
          return
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
    if (isConnected) {
      setIsConnectModalOpen(false)
    }
  }, [isConnected])

  const isOwner =
    address !== undefined && owner !== '' && address.toLowerCase() === owner.toLowerCase()

  const activeMarkets = useMemo(() => markets.filter((market) => !market.isSettled), [markets])
  const totalStaked = useMemo(
    () => markets.reduce((sum, market) => sum + market.totalWinBets + market.totalLoseBets, 0n),
    [markets],
  )

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-text">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-7rem] h-72 w-72 rounded-full bg-cyan/10 blur-3xl" />
        <div className="absolute right-[-10rem] top-10 h-80 w-80 rounded-full bg-royal/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-cyan/5 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card sticky top-4 z-30 flex flex-col gap-4 rounded-[28px] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="relative h-20 w-[200px] shrink-0 ml-1">
              <Image
                src={pegPulseLogo}
                alt="PegPulse logo"
                className="h-full w-full object-contain object-left"
                priority
                fill
                sizes="340px"
              />
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={isMarketPage ? goToLandingPage : goToMarketPage}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-3 text-sm font-medium text-slate-900 transition hover:border-cyan/30 hover:text-cyan"
              >
                {isMarketPage && <ChevronLeft className="h-4 w-4" />}
                {isMarketPage ? 'Overview' : 'Get Started'}
              </button>
              {isMarketPage ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (isConnected) return
                      setIsConnectModalOpen((current) => !current)
                    }}
                    className="inline-flex items-center gap-2 rounded-full bg-cyan-royal px-5 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.02]"
                  >
                    <Wallet2 className="h-4 w-4" />
                    {address ? shortenAddress(address) : 'Connect Wallet'}
                  </button>
                  {isConnected ? (
                    <button
                      type="button"
                      onClick={() => disconnect()}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-3 text-sm font-medium text-slate-900 transition hover:border-cyan/30 hover:text-cyan"
                    >
                      <LogOut className="h-4 w-4" />
                      Disconnect
                    </button>
                  ) : null}
                </>
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
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-royal text-slate-950">
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
          {isMarketPage ? (
            <>
              <section className="grid gap-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="glass-card rounded-[30px] p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="panel-label">Market Board</p>
                      <h3 className="mt-2 font-display text-2xl font-semibold text-slate-900">
                        Active hedge markets
                      </h3>
                      <p className="mt-2 text-sm text-muted">
                        Connect your wallet and enter only the markets that are currently live.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void refreshDashboard(address, true)}
                      className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm text-slate-900 transition hover:border-cyan/30 hover:text-cyan"
                    >
                      <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  <div className="mt-6 grid gap-5">
                    {isLoading ? (
                      <div className="rounded-[26px] border border-slate-200/80 bg-white/80 px-5 py-10 text-center text-muted">
                        Loading Arc markets...
                      </div>
                    ) : activeMarkets.length === 0 ? (
                      <div className="rounded-[26px] border border-dashed border-slate-200/80 bg-white/80 px-5 py-10 text-center text-muted">
                        There are no active markets right now. Check back later for the next live
                        hedge window.
                      </div>
                    ) : (
                      activeMarkets.map((market, index) => (
                        <MarketCard
                          key={market.address}
                          market={market}
                          descriptor={getMarketDescriptor(market.description, index)}
                          isOwner={isOwner}
                          isBusy={actionLoading !== null}
                          onBet={(side, amount) =>
                            executeAction(
                              side === 'win' ? 'Placing Yes bet' : 'Placing No bet',
                              async (client) => {
                                await placeBet(client, market.address, side, amount)
                              },
                            )
                          }
                          onSettle={(outcome) =>
                            executeAction('Settling market', async (client) => {
                              await settleMarket(client, market.address, outcome)
                            })
                          }
                          onWithdraw={() =>
                            executeAction('Withdrawing winnings', async (client) => {
                              await withdrawWinnings(client, market.address)
                            })
                          }
                        />
                      ))
                    )}
                  </div>
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
                        onClick={goToMarketPage}
                        className="inline-flex items-center gap-2 rounded-full bg-cyan-royal px-6 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.02]"
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
                    className="glass-card rounded-[30px] p-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <TokenBadge symbol={asset.symbol} size="lg" />
                        <div>
                          <h3 className="font-display text-2xl font-semibold text-slate-900">
                            {asset.symbol}
                          </h3>
                          <p className="text-sm text-muted">{asset.note}</p>
                        </div>
                      </div>
                      <div className="rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan">
                        {asset.riskLabel}
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      <MetricCard
                        label="Current Peg (24H)"
                        value={asset.pegValue}
                        accent="cyan"
                        icon={<CircleDollarSign className="h-4 w-4" />}
                      />
                      <MetricCard
                        label="Threshold"
                        value={asset.threshold}
                        accent="royal"
                        icon={<TrendingDown className="h-4 w-4" />}
                      />
                      <MetricCard
                        label="Risk Score"
                        value={`${asset.riskScore}/100`}
                        accent="cyan"
                        icon={<ShieldAlert className="h-4 w-4" />}
                      />
                    </div>

                    <div className="mt-6">
                      <div className="flex items-center justify-between text-sm text-muted">
                        <span>De-peg probability monitor</span>
                        <span>{asset.riskScore}%</span>
                      </div>
                      <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-cyan-royal transition-all"
                          style={{ width: `${asset.riskScore}%` }}
                        />
                      </div>
                    </div>
                  </motion.article>
                ))}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
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
  const timeRemaining = getTimeRemaining(descriptor.deadline)
  const totalPool = market.totalWinBets + market.totalLoseBets

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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-cyan/20 bg-cyan/10 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-cyan/80">Yes Pool</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {formatAmount(market.totalWinBets)} USDC
                </p>
              </div>
              <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-blue-600">No Pool</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {formatAmount(market.totalLoseBets)} USDC
                </p>
              </div>
            </div>

            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="mt-4 w-full rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan/40"
              placeholder="Bet amount in USDC"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void onBet('win', amount)}
                disabled={market.isSettled || isBusy}
                className="rounded-2xl bg-cyan-royal px-4 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => void onBet('lose', amount)}
                disabled={market.isSettled || isBusy}
                className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-700 transition hover:border-blue-300/40 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                No
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {isOwner && !market.isSettled ? (
                <>
                  <MiniButton
                    label="Settle Yes"
                    onClick={() => void onSettle(1)}
                    disabled={isBusy}
                  />
                  <MiniButton
                    label="Settle No"
                    onClick={() => void onSettle(2)}
                    disabled={isBusy}
                  />
                  <MiniButton
                    label="Invalid"
                    onClick={() => void onSettle(3)}
                    disabled={isBusy}
                  />
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
    const prefix = currencySymbolMatch[0] === '$' ? '$' : 'EUR'
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
