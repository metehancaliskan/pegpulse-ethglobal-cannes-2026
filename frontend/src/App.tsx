import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  CircleDollarSign,
  Clock3,
  LogOut,
  Plus,
  QrCode,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  X,
  Wallet2,
} from 'lucide-react'
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWalletClient } from 'wagmi'
import {
  ARC_NETWORK,
  FACTORY_ADDRESS,
  createMarket,
  fetchDashboardData,
  formatEth,
  outcomeLabel,
  placeBet,
  settleMarket,
  shortenAddress,
  withdrawWinnings,
} from './lib/contracts'
import { hasWalletConnectProjectId } from './lib/wallet'
import type { MarketView } from './lib/contracts'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import pegPulseLogo from './assets/pegpulse_logo.jpg'

type MarketDescriptor = {
  symbol: string
  thresholdLabel: string
  deadlineLabel: string
  deadline: Date | null
}

const HEALTH_SERIES = [
  { time: '00:00', peg: 1.002, liquidity: 92 },
  { time: '04:00', peg: 0.999, liquidity: 88 },
  { time: '08:00', peg: 1.001, liquidity: 94 },
  { time: '12:00', peg: 0.997, liquidity: 76 },
  { time: '16:00', peg: 1.0, liquidity: 82 },
  { time: '20:00', peg: 0.998, liquidity: 79 },
  { time: '24:00', peg: 1.001, liquidity: 91 },
] as const

function App() {
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
  const [createValue, setCreateValue] = useState(
    'Will USDC depeg below $0.99 before Apr 10 2026 18:00 UTC?',
  )
  const [statusMessage, setStatusMessage] = useState(
    'Dashboard is tracking the Arc Testnet deployment in real time.',
  )
  const [actionLoading, setActionLoading] = useState<string | null>(null)

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
    if (isConnected) {
      setIsConnectModalOpen(false)
    }
  }, [isConnected])

  const isOwner =
    address !== undefined && owner !== '' && address.toLowerCase() === owner.toLowerCase()

  const activeMarkets = markets.filter((market) => !market.isSettled)
  const totalStaked = useMemo(
    () => markets.reduce((sum, market) => sum + market.totalWinBets + market.totalLoseBets, 0n),
    [markets],
  )
  const totalYes = useMemo(
    () => markets.reduce((sum, market) => sum + market.totalWinBets, 0n),
    [markets],
  )
  const featuredDescriptor = getMarketDescriptor(markets[0]?.description ?? 'USDC monitor', 0)

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
        throw new Error('Set VITE_WALLETCONNECT_PROJECT_ID in frontend/.env to enable WalletConnect.')
      }

      await connectAsync({ connector })
      setStatusMessage(`Wallet connection started with ${connector.name}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet connection failed.'
      setStatusMessage(message)
    }
  }

  const handleCreateMarket = async () => {
    const description = createValue.trim()

    if (!description) {
      setStatusMessage('Market description cannot be empty.')
      return
    }

    await executeAction('Creating market', async (client) => {
      await createMarket(client, description)
      setCreateValue('')
    })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-text">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-7rem] h-72 w-72 rounded-full bg-cyan/10 blur-3xl" />
        <div className="absolute right-[-10rem] top-20 h-80 w-80 rounded-full bg-royal/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-cyan/5 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card flex flex-col gap-4 rounded-[28px] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-white/25 bg-white/95 shadow-[0_0_30px_rgba(0,245,255,0.12)]">
              <img
                src={pegPulseLogo}
                alt="PegPulse logo"
                className="h-full w-full scale-[1.16] object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl font-bold tracking-tight text-white">
                  PegPulse
                </h1>
                <span className="rounded-full border border-cyan/20 bg-cyan/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan">
                  Arc Network
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">
                Stablecoin de-peg monitoring and onchain hedge execution.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-success shadow-[0_0_15px_rgba(34,197,94,0.6)]" />
              Arc Testnet {ARC_NETWORK.chainId}
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:border-cyan/30 hover:text-cyan"
                >
                  <LogOut className="h-4 w-4" />
                  Disconnect
                </button>
              ) : null}
            </div>
          </div>
        </motion.header>

        {isConnectModalOpen ? (
          <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-950/55 px-4 pt-24 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card z-50 w-full max-w-md rounded-[28px] p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="panel-label">Wallet Connection</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                    Choose your wallet
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Injected wallets connect directly. WalletConnect opens a QR flow for mobile and desktop wallets.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="rounded-full border border-white/10 bg-white/5 p-2 text-muted transition hover:text-white"
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
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:border-cyan/30 hover:bg-cyan/10 disabled:cursor-not-allowed disabled:opacity-60"
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
                        <p className="text-sm font-semibold text-white">{connector.name}</p>
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
                    WalletConnect is wired, but you still need to set `VITE_WALLETCONNECT_PROJECT_ID` in `frontend/.env`.
                  </div>
                ) : null}
              </div>
            </motion.div>
          </div>
        ) : null}

        <main className="mt-6 grid gap-6">
          <section>
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass-card w-full overflow-hidden rounded-[32px] border-white/10 bg-hero-grid p-6 sm:p-8"
            >
              <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <p className="panel-label">Stablecoin Health Monitor</p>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan/20 bg-cyan/10 text-xl font-bold text-cyan">
                      {featuredDescriptor.symbol.slice(0, 1)}
                    </div>
                    <div>
                      <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
                        {featuredDescriptor.symbol} Liquidity Pulse
                      </h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-muted sm:text-base">
                        A premium hedge dashboard for monitoring stablecoin stress and taking
                        directional protection through PegPulse markets.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <MetricCard
                      label="Factory"
                      value={shortenAddress(FACTORY_ADDRESS)}
                      accent="cyan"
                      icon={<ShieldAlert className="h-4 w-4" />}
                    />
                    <MetricCard
                      label="Active Markets"
                      value={String(activeMarkets.length)}
                      accent="royal"
                      icon={<Activity className="h-4 w-4" />}
                    />
                    <MetricCard
                      label="Total Staked"
                      value={`${formatEth(totalStaked)} ETH`}
                      accent="cyan"
                      icon={<CircleDollarSign className="h-4 w-4" />}
                    />
                  </div>

                  <div className="mt-8 h-[280px] rounded-[28px] border border-white/10 bg-slate-950/35 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={HEALTH_SERIES}>
                        <defs>
                          <linearGradient id="pegFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#00F5FF" stopOpacity={0.55} />
                            <stop offset="100%" stopColor="#0033AD" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                        <XAxis dataKey="time" tick={{ fill: '#8FA8C7', fontSize: 12 }} />
                        <YAxis
                          yAxisId="left"
                          domain={[0.994, 1.004]}
                          tickFormatter={(value) => value.toFixed(3)}
                          tick={{ fill: '#8FA8C7', fontSize: 12 }}
                          width={56}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          domain={[60, 100]}
                          tick={{ fill: '#64748B', fontSize: 12 }}
                          width={42}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'rgba(6, 12, 24, 0.92)',
                            border: '1px solid rgba(0,245,255,0.18)',
                            borderRadius: '16px',
                            color: '#E6F3FF',
                          }}
                        />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="peg"
                          stroke="#00F5FF"
                          strokeWidth={3}
                          fill="url(#pegFill)"
                        />
                        <Area
                          yAxisId="right"
                          type="monotone"
                          dataKey="liquidity"
                          stroke="#60A5FA"
                          strokeWidth={2}
                          fillOpacity={0}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="glass-card rounded-[28px] p-5">
                    <div className="flex items-center justify-between">
                      <p className="panel-label">Alpha Agent</p>
                      <div className="flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-success">
                        <span className="inline-flex h-2.5 w-2.5 animate-pulse-soft rounded-full bg-success" />
                        Live
                      </div>
                    </div>
                    <p className="mt-4 font-display text-xl font-semibold text-white">
                      Monitoring Liquidity...
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      PegPulse continuously watches Arc markets, liquidity pressure, and settlement
                      readiness for de-peg hedges.
                    </p>
                    <div className="mt-6 grid gap-3">
                      <InfoRow label="Watched Asset" value={featuredDescriptor.symbol} />
                      <InfoRow label="Alert Threshold" value={featuredDescriptor.thresholdLabel} />
                      <InfoRow label="Net Yes Pool" value={`${formatEth(totalYes)} ETH`} />
                    </div>
                  </div>

                  <div className="glass-card rounded-[28px] p-5">
                    <div className="flex items-center justify-between">
                      <p className="panel-label">Operator Controls</p>
                      {isOwner ? (
                        <span className="rounded-full border border-cyan/20 bg-cyan/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan">
                          Owner
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                      <p className="text-sm text-muted">
                        {isOwner
                          ? 'Create new de-peg markets directly from this panel.'
                          : 'Connect the owner wallet to create and settle markets.'}
                      </p>
                      <textarea
                        value={createValue}
                        onChange={(event) => setCreateValue(event.target.value)}
                        rows={4}
                        placeholder="Will USDC depeg below $0.99 before Apr 10 2026 18:00 UTC?"
                        className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan/40"
                      />
                      <button
                        type="button"
                        onClick={() => void handleCreateMarket()}
                        disabled={!isOwner || actionLoading === 'Creating market'}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-royal px-4 py-3 text-sm font-semibold text-slate-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" />
                        {actionLoading === 'Creating market' ? 'Creating...' : 'Create Market'}
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
                      <p className="font-medium text-white">Operator address</p>
                      <p className="mt-2 break-all">{owner || 'Loading owner...'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.article>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.55fr_0.45fr]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-[30px] p-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="panel-label">Prediction Markets</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-white">
                    Active and settled hedge positions
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshDashboard(address, true)}
                  className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-cyan/30 hover:text-cyan"
                >
                  <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              <div className="mt-6 grid gap-5">
                {isLoading ? (
                  <div className="rounded-[26px] border border-white/10 bg-white/5 px-5 py-10 text-center text-muted">
                    Loading Arc markets...
                  </div>
                ) : markets.length === 0 ? (
                  <div className="rounded-[26px] border border-dashed border-white/10 bg-white/5 px-5 py-10 text-center text-muted">
                    No markets created yet. Connect the owner wallet to open the first hedge market.
                  </div>
                ) : (
                  markets.map((market, index) => (
                    <MarketCard
                      key={market.address}
                      market={market}
                      descriptor={getMarketDescriptor(market.description, index)}
                      isOwner={isOwner}
                      isBusy={actionLoading !== null}
                      onBet={(side, amount) =>
                        executeAction(side === 'win' ? 'Placing Yes bet' : 'Placing No bet', async (client) => {
                          await placeBet(client, market.address, side, amount)
                        })
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

            <motion.aside
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="grid gap-6"
            >
              <div className="glass-card rounded-[30px] p-6">
                <p className="panel-label">System Feed</p>
                <p className="mt-3 font-display text-xl font-semibold text-white">
                  Dark mode hedge cockpit
                </p>
                <p className="mt-3 text-sm leading-6 text-muted">{statusMessage}</p>
                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-cyan" />
                    <div>
                      <p className="text-sm font-medium text-white">Deployment target</p>
                      <p className="text-xs text-muted">{ARC_NETWORK.blockExplorerUrl}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-[30px] p-6">
                <p className="panel-label">How To Test</p>
                <div className="mt-4 space-y-4 text-sm leading-6 text-muted">
                  <StepRow text="Connect the owner wallet and create a market with a parseable date in the description." />
                  <StepRow text="Open a second wallet, place Yes or No bets, and compare user stake values on each card." />
                  <StepRow text="Settle from the owner wallet, then withdraw from the winning side." />
                </div>
              </div>
            </motion.aside>
          </section>
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
      className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 shadow-glow backdrop-blur-xl"
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-royal text-base font-bold text-slate-950">
              {descriptor.symbol.slice(0, 1)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-display text-xl font-semibold text-white">{descriptor.symbol}</h4>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
                  {market.isSettled ? outcomeLabel(market.outcome) : 'Open'}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{market.description}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatPill label="De-peg Threshold" value={descriptor.thresholdLabel} />
            <StatPill label="Time Remaining" value={timeRemaining} icon={<Clock3 className="h-4 w-4" />} />
            <StatPill label="Total Stake" value={`${formatEth(totalPool)} ETH`} />
            <StatPill
              label="Your Exposure"
              value={`${formatEth(market.userWinBet + market.userLoseBet)} ETH`}
            />
          </div>
        </div>

        <div className="w-full xl:max-w-sm">
          <div className="rounded-[24px] border border-white/10 bg-slate-950/40 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-cyan/20 bg-cyan/10 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-cyan/80">Yes Pool</p>
                <p className="mt-2 text-lg font-semibold text-white">{formatEth(market.totalWinBets)} ETH</p>
              </div>
              <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-blue-200">No Pool</p>
                <p className="mt-2 text-lg font-semibold text-white">{formatEth(market.totalLoseBets)} ETH</p>
              </div>
            </div>

            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="mt-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan/40"
              placeholder="Bet amount in ETH"
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
                className="rounded-2xl border border-blue-400/20 bg-blue-500/10 px-4 py-3 text-sm font-semibold text-blue-100 transition hover:border-blue-300/40 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                No
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
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
        <span className={accent === 'cyan' ? 'text-cyan' : 'text-blue-200'}>{icon}</span>
      </div>
      <p className="mt-3 text-xl font-semibold text-white">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
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
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-white sm:text-base">{value}</p>
    </div>
  )
}

function StepRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
      <p>{text}</p>
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
      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-cyan/30 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  )
}

function getMarketDescriptor(description: string, index: number): MarketDescriptor {
  const stablecoinMatch = description.match(/\b(USDC|USDT|DAI|FDUSD|USDE|FRAX|PYUSD)\b/i)
  const symbol = stablecoinMatch?.[1]?.toUpperCase() ?? `MKT-${index + 1}`

  const percentMatch = description.match(/(\d+(?:\.\d+)?)%/i)
  const dollarMatch = description.match(/\$(\d+(?:\.\d+)?)/i)

  let thresholdLabel = percentMatch ? `${percentMatch[1]}%` : '1%'

  if (!percentMatch && dollarMatch) {
    const price = Number(dollarMatch[1])
    const threshold = Math.abs((1 - price) * 100)
    thresholdLabel = `${threshold.toFixed(threshold % 1 === 0 ? 0 : 2)}%`
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

export default App
