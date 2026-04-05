'use client'

import Image, { type StaticImageData } from 'next/image'
import eurcLogo from '../assets/EURC-logo.png'
import usdcLogo from '../assets/USDC-logo.png'

const localLogos: Record<string, StaticImageData> = {
  USDC: usdcLogo,
  EURC: eurcLogo,
}

const remoteLogos: Record<string, string> = {
  AUDF: 'https://cdn.prod.website-files.com/67116d0daddc92483c812e88/690e326269c046ed0c3b2b5b_forte.svg',
  BRLA: 'https://cdn.prod.website-files.com/67116d0daddc92483c812e88/690e32632cbeda9382cfc725_avenia-brla.png',
  JPYC: 'https://cdn.prod.website-files.com/67116d0daddc92483c812e88/691541f9b2bdc4a89c944fe0_jpyc-token.png',
  QCAD: 'https://cdn.prod.website-files.com/67116d0daddc92483c812e88/690e326349711a9e87ccd1d2_qcad.png',
  MXNB: 'https://cdn.prod.website-files.com/67116d0daddc92483c812e88/690e32628ebd65f5cd314829_mxnb.svg',
  USYC: '/Hashnote_SDYC_200x200.svg',
}

export function TokenBadge({ symbol, size }: { symbol: string; size: 'sm' | 'md' | 'lg' }) {
  const key = symbol.toUpperCase()

  const sizeClasses = {
    sm: 'h-8 w-8 rounded-xl',
    md: 'h-10 w-10 rounded-xl',
    lg: 'h-14 w-14 rounded-2xl',
  }
  const imageSizes = { sm: 24, md: 30, lg: 40 }
  const textSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-lg' }

  const local = localLogos[key]
  if (local) {
    return (
      <div className={`flex items-center justify-center overflow-hidden bg-white ${sizeClasses[size]}`}>
        <Image
          src={local}
          alt={`${key} logo`}
          width={imageSizes[size]}
          height={imageSizes[size]}
          className="h-full w-full object-contain"
        />
      </div>
    )
  }

  const remote = remoteLogos[key]
  if (remote) {
    return (
      <div className={`flex items-center justify-center overflow-hidden bg-white ${sizeClasses[size]}`}>
        <img
          src={remote}
          alt={`${key} logo`}
          width={imageSizes[size]}
          height={imageSizes[size]}
          className="h-full w-full object-contain"
        />
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-center bg-cyan-royal font-bold text-white ${sizeClasses[size]} ${textSizes[size]}`}>
      {symbol.slice(0, 2)}
    </div>
  )
}
