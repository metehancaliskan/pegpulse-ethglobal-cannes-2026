'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BookOpen, Layers, LineChart, Shield, X, Zap } from 'lucide-react'
import { ArchitectureDiagram } from './ArchitectureDiagram'

type HowItWorksModalProps = {
  open: boolean
  onClose: () => void
}

const steps = [
  {
    icon: Layers,
    title: 'Markets on Arc',
    body:
      'Each market is an on-chain contract: you stake USDC on YES/NO outcomes for peg deviation, liquidity stress, or macro-style events. Native USDC on Arc keeps deposits and payouts simple.',
  },
  {
    icon: LineChart,
    title: 'Two price rails',
    body:
      'Charts blend DEX-style spot (DefiLlama / CoinGecko / GeckoTerminal where needed) with Chainlink FX reference feeds. The gap between them is the “signal” users see—not a single vendor quote.',
  },
  {
    icon: Shield,
    title: 'Resolution',
    body:
      'Rules are encoded in market descriptions. An owner (or an optional resolver backend using the same feeds) settles outcomes on-chain once conditions are met.',
  },
  {
    icon: Zap,
    title: 'Fast UX',
    body:
      'Static market metadata avoids hammering the RPC on load; dynamic pool data loads when you open a market. That keeps the list snappy on testnet rate limits.',
  },
]

export function HowItWorksModal({ open, onClose }: HowItWorksModalProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] overflow-y-auto overflow-x-hidden">
          <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
            <motion.button
              type="button"
              aria-label="Close"
              className="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="how-it-works-title"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 8 }}
              transition={{ type: 'spring', damping: 32, stiffness: 380 }}
              className="glass-card relative z-[101] my-4 flex max-h-[min(88vh,860px)] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] shadow-2xl sm:rounded-[28px]"
            >
              <div className="sticky top-0 z-[1] flex items-start justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-md sm:px-8 sm:py-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-royal text-white shadow-md">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="panel-label">PegPulse</p>
                    <h2 id="how-it-works-title" className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                      How it works
                    </h2>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                      Prediction markets for stablecoin risk: on-chain stakes, off-chain price truth from DEX + oracle layers.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-full border border-slate-200/80 bg-white p-2.5 text-muted transition hover:border-slate-300 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {steps.map(({ icon: Icon, title, body }, i) => (
                    <motion.div
                      key={title}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i }}
                      className="rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eef4ff] text-royal">
                          <Icon className="h-4 w-4" strokeWidth={2.25} />
                        </span>
                        <h3 className="font-display text-sm font-semibold text-slate-900">{title}</h3>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8">
                  <ArchitectureDiagram />
                </div>

                <p className="mt-6 text-center text-xs leading-relaxed text-muted">
                  Built for Arc testnet demos. Feed availability and pool liquidity vary by asset; the UI surfaces what we can fetch reliably.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
