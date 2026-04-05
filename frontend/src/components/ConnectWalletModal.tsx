'use client'

import { motion } from 'framer-motion'
import { ArrowRight, QrCode, Wallet2, X } from 'lucide-react'
import { hasWalletConnectProjectId } from '../lib/wallet'
import type { Connector } from 'wagmi'

type ConnectWalletModalProps = {
  connectors: readonly Connector[]
  isConnecting: boolean
  onConnect: (connectorId: string) => void
  onClose: () => void
}

export function ConnectWalletModal({ connectors, isConnecting, onConnect, onClose }: ConnectWalletModalProps) {
  return (
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
            onClick={onClose}
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
              onClick={() => onConnect(connector.id)}
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
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
              WalletConnect is wired, but you still need to set
              {' '}<code className="text-xs">NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID</code>{' '}
              in <code className="text-xs">frontend/.env</code>.
            </div>
          ) : null}
        </div>
      </motion.div>
    </div>
  )
}
