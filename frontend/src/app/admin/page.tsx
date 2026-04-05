'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, RefreshCcw, Settings, ShieldAlert, Wallet2 } from 'lucide-react'
import { useApp } from '../../App'
import { createMarket, formatAmount, outcomeLabel, settleMarket } from '../../lib/contracts'

export default function AdminPage() {
  const {
    markets,
    isOwner,
    isConnected,
    isRefreshing,
    actionLoading,
    address,
    refreshDashboard,
    executeAction,
    openConnectModal,
  } = useApp()

  const [description, setDescription] = useState('')
  const isBusy = actionLoading !== null

  if (!isConnected) {
    return (
      <section className="grid gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-[24px] p-6 text-center"
        >
          <Settings className="mx-auto h-12 w-12 text-muted/40" />
          <h3 className="mt-4 font-display text-2xl font-semibold text-slate-900">Admin Panel</h3>
          <p className="mt-2 text-sm text-muted">Connect the owner wallet to access admin controls.</p>
          <button
            type="button"
            onClick={openConnectModal}
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
          className="glass-card rounded-[24px] p-6 text-center"
        >
          <ShieldAlert className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-4 font-display text-2xl font-semibold text-slate-900">Access Denied</h3>
          <p className="mt-2 text-sm text-muted">This wallet is not the contract owner.</p>
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
        className="glass-card rounded-[24px] p-6"
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
            onClick={() => void refreshDashboard(address, true)}
            className="inline-flex items-center gap-2 self-start rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm text-slate-900 transition hover:border-cyan/30 hover:text-cyan"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mt-6 rounded-[20px] border border-slate-200/80 bg-white/75 p-5">
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
                void executeAction('Creating market', async (client) => {
                  await createMarket(client, description.trim())
                })
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
            <div className="rounded-[20px] border border-dashed border-slate-200/80 bg-white/80 px-5 py-10 text-center text-muted">
              No markets created yet.
            </div>
          ) : (
            markets.map((market, index) => (
              <div
                key={market.address}
                className="rounded-[20px] border border-slate-200/80 bg-white/95 p-5"
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
                        onClick={() => void executeAction('Settling market', async (client) => { await settleMarket(client, market.address, 1) })}
                        disabled={isBusy}
                        className="rounded-xl bg-green-500/10 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Settle Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => void executeAction('Settling market', async (client) => { await settleMarket(client, market.address, 2) })}
                        disabled={isBusy}
                        className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Settle No
                      </button>
                      <button
                        type="button"
                        onClick={() => void executeAction('Settling market', async (client) => { await settleMarket(client, market.address, 3) })}
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
