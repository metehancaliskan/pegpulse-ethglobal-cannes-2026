'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Briefcase, CircleHelp, LogOut, Wallet2 } from 'lucide-react'
import { HowItWorksModal } from './HowItWorksModal'
import pegPulseLogo from '../assets/pegpulse_logo.png'
import { formatAmount, shortenAddress } from '../lib/contracts'

type HeaderProps = {
  address?: string
  isConnected: boolean
  isOwner: boolean
  balance?: bigint
  onConnectClick: () => void
  onDisconnect: () => void
}

export function Header({ address, isConnected, isOwner, balance, onConnectClick, onDisconnect }: HeaderProps) {
  const pathname = usePathname()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const navLinks = [
    { href: '/', label: 'Markets' },
    { href: '/portfolio', label: 'Portfolio' },
    ...(mounted && isOwner ? [{ href: '/admin', label: 'Admin' }] : []),
  ]

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card sticky top-4 z-30 flex items-center justify-between rounded-[20px] px-4 py-3"
    >
      <div className="flex items-center gap-6">
        <Link href="/" className="relative h-12 w-[140px] shrink-0 cursor-pointer">
          <Image
            src={pegPulseLogo}
            alt="PegPulse logo"
            className="h-full w-full object-contain object-left"
            priority
            fill
            sizes="200px"
          />
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {navLinks.map((link) => {
            const isActive =
              link.href === '/'
                ? pathname === '/'
                : link.href === '/portfolio'
                  ? pathname === '/portfolio'
                  : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-slate-900/5 text-slate-900'
                    : 'text-muted hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {link.label}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setHowItWorksOpen(true)}
            className="ml-1 inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan/35 hover:bg-cyan/5 hover:text-slate-900"
          >
            <CircleHelp className="h-4 w-4 text-royal" />
            How it works
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setHowItWorksOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan/35 sm:hidden"
          aria-label="How it works"
        >
          <CircleHelp className="h-4 w-4 shrink-0 text-royal" />
        </button>
        <Link
          href="/portfolio"
          className={`group inline-flex items-center gap-2.5 rounded-2xl border px-3 py-2 shadow-sm transition sm:gap-3 sm:px-4 sm:py-2.5 ${
            pathname === '/portfolio'
              ? 'border-cyan/35 bg-cyan/[0.06] ring-1 ring-cyan/20'
              : 'border-slate-200/90 bg-white/90 hover:border-cyan/30 hover:bg-white'
          }`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900/[0.04] text-slate-700 transition group-hover:bg-cyan/10 group-hover:text-cyan-royal">
            <Briefcase className="h-4 w-4" />
          </span>
          <span className="min-w-0 text-left leading-tight">
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Portfolio</span>
            {mounted && isConnected && balance !== undefined ? (
              <span className="mt-0.5 block text-sm font-bold tabular-nums tracking-tight text-slate-900">
                {formatAmount(balance)}{' '}
                <span className="text-xs font-semibold text-slate-500">USDC</span>
              </span>
            ) : (
              <span className="mt-0.5 block text-xs font-medium text-slate-500">Positions & claims</span>
            )}
          </span>
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (isConnected) {
                setIsDropdownOpen((prev) => !prev)
              } else {
                onConnectClick()
              }
            }}
            className="inline-flex items-center gap-2 rounded-full bg-cyan-royal px-4 py-2.5 text-sm font-semibold text-white transition hover:scale-[1.02] sm:px-5"
          >
            <Wallet2 className="h-4 w-4 shrink-0 opacity-95" />
            {!mounted || !isConnected || !address ? (
              <span>Connect Wallet</span>
            ) : (
              <span className="max-w-[7.5rem] truncate font-mono text-[13px] font-semibold tracking-tight sm:max-w-none">
                {shortenAddress(address)}
              </span>
            )}
          </button>

          {isDropdownOpen && isConnected && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-[20px] border border-slate-200/80 bg-white/95 shadow-xl backdrop-blur-xl"
              >
                <button
                  type="button"
                  onClick={() => {
                    onDisconnect()
                    setIsDropdownOpen(false)
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
      </div>

      <HowItWorksModal open={howItWorksOpen} onClose={() => setHowItWorksOpen(false)} />
    </motion.header>
  )
}
