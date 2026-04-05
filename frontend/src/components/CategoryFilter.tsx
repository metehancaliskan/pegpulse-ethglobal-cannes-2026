'use client'

import { TrendingDown, Globe, Droplets, Landmark } from 'lucide-react'
import type { MarketCategory } from '../lib/market-utils'

const CATEGORIES: { id: MarketCategory | 'all'; label: string; icon?: typeof TrendingDown }[] = [
  { id: 'all', label: 'All Markets' },
  { id: 'peg_deviation', label: 'Peg Deviation', icon: TrendingDown },
  { id: 'geopolitics', label: 'Macro & Geopolitics', icon: Globe },
  { id: 'liquidity_stress', label: 'Liquidity Stress', icon: Droplets },
  { id: 'rwa_risk', label: 'RWA Yield', icon: Landmark },
]

type CategoryFilterProps = {
  value: MarketCategory | 'all'
  onChange: (cat: MarketCategory | 'all') => void
  symbolFilter: string | null
  onClearSymbol: () => void
}

export function CategoryFilter({ value, onChange, symbolFilter, onClearSymbol }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon
        const isActive = value === cat.id
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition ${
              isActive
                ? 'bg-slate-900 text-white shadow-sm'
                : 'border border-slate-200/80 bg-white/80 text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {cat.label}
          </button>
        )
      })}

      {symbolFilter && (
        <button
          type="button"
          onClick={onClearSymbol}
          className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-cyan/20 bg-cyan/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan transition hover:bg-cyan/20"
        >
          {symbolFilter}
          <span className="text-[10px]">&times;</span>
        </button>
      )}
    </div>
  )
}
