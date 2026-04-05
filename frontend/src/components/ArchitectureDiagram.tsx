'use client'

import { useLayoutEffect, useRef } from 'react'
import rough from 'roughjs'

/** Hand-drawn flow diagram (Excalidraw-ish): rough.js + Kalam. */
const hand = "'Kalam', 'Comic Sans MS', cursive"

const R = { roughness: 1.35, bowing: 0.12 }

const VB = { w: 880, h: 448 }

/** Node rectangles (x, y, w, h) */
const N = {
  client: { x: 326, y: 24, w: 228, h: 54 },
  app: { x: 286, y: 96, w: 308, h: 80 },
  arc: { x: 32, y: 218, w: 252, h: 92 },
  snap: { x: 314, y: 218, w: 252, h: 92 },
  feeds: { x: 596, y: 218, w: 252, h: 92 },
  resolver: { x: 314, y: 352, w: 252, h: 58 },
}

function cx(r: { x: number; w: number }) {
  return r.x + r.w / 2
}

function bottomY(r: { y: number; h: number }) {
  return r.y + r.h
}

export function ArchitectureDiagram() {
  const svgRef = useRef<SVGSVGElement>(null)
  const sketchRef = useRef<SVGGElement>(null)

  useLayoutEffect(() => {
    const svg = svgRef.current
    const layer = sketchRef.current
    if (!svg || !layer) return

    layer.replaceChildren()
    const rc = rough.svg(svg)
    const add = (node: SVGElement) => layer.appendChild(node)

    const stroke = { strokeWidth: 1.7, ...R }

    // --- Nodes ---
    add(
      rc.rectangle(N.client.x, N.client.y, N.client.w, N.client.h, {
        ...R,
        fill: '#fff',
        fillStyle: 'hachure',
        fillWeight: 0.2,
        hachureGap: 6,
        stroke: '#78716c',
        strokeWidth: 1.5,
      }),
    )

    add(
      rc.rectangle(N.app.x, N.app.y, N.app.w, N.app.h, {
        ...R,
        fill: '#f0f7ff',
        fillStyle: 'hachure',
        fillWeight: 0.18,
        hachureGap: 7,
        stroke: '#0033AD',
        strokeWidth: 2.2,
      }),
    )

    // Solid fill: zigzag/hachure on dark bg reads as a black scribble and hides labels
    add(
      rc.rectangle(N.arc.x, N.arc.y, N.arc.w, N.arc.h, {
        ...R,
        fill: '#334155',
        fillStyle: 'solid',
        stroke: '#0f172a',
        strokeWidth: 2,
      }),
    )

    add(
      rc.rectangle(N.snap.x, N.snap.y, N.snap.w, N.snap.h, {
        ...R,
        fill: '#fff',
        fillStyle: 'hachure',
        fillWeight: 0.18,
        hachureGap: 6,
        stroke: '#78716c',
        strokeWidth: 1.5,
      }),
    )

    add(
      rc.rectangle(N.feeds.x, N.feeds.y, N.feeds.w, N.feeds.h, {
        ...R,
        fill: '#e2e8f0',
        fillStyle: 'cross-hatch',
        fillWeight: 0.12,
        hachureGap: 10,
        stroke: '#64748b',
        strokeWidth: 1.5,
      }),
    )

    add(
      rc.rectangle(N.resolver.x, N.resolver.y, N.resolver.w, N.resolver.h, {
        ...R,
        fill: '#f0fdf4',
        fillStyle: 'dots',
        fillWeight: 0.3,
        hachureGap: 5,
        stroke: '#16a34a',
        strokeWidth: 1.8,
        strokeLineDash: [6, 5],
      }),
    )

    const c = cx(N.client)
    const cApp = cx(N.app)
    const cArc = cx(N.arc)
    const cFeeds = cx(N.feeds)
    const cRes = cx(N.resolver)

    const yClientB = bottomY(N.client)
    const yAppB = bottomY(N.app)
    const yArcT = N.arc.y
    const yArcB = bottomY(N.arc)
    const yResT = N.resolver.y

    const hubY = yAppB + 22

    // Client → App
    add(rc.linearPath([[c, yClientB], [cApp, N.app.y]], { ...stroke, stroke: '#44403c' }))

    // App → hub → three targets
    add(rc.linearPath([[cApp, yAppB], [cApp, hubY], [cArc, hubY], [cArc, yArcT]], { ...stroke, stroke: '#0033AD' }))
    add(rc.linearPath([[cApp, yAppB], [cApp, yArcT]], { ...stroke, stroke: '#0033AD' }))
    add(rc.linearPath([[cApp, yAppB], [cApp, hubY], [cFeeds, hubY], [cFeeds, yArcT]], { ...stroke, stroke: '#0e7490' }))

    // Resolver → Arc (settlement), dashed sketch line
    add(
      rc.linearPath([[cRes, yResT], [cRes, yArcB + 8], [cArc, yArcB + 8], [cArc, yArcB]], {
        ...stroke,
        stroke: '#15803d',
        strokeLineDash: [5, 5],
      }),
    )

    // Tiny arrow heads (rough polygons) — down into App, into Arc from client chain already implied
    const tri = (x: number, y: number, dir: 'down' | 'up') => {
      const s = 7
      if (dir === 'down') {
        return rc.polygon(
          [
            [x, y + s],
            [x - s * 0.65, y - s * 0.35],
            [x + s * 0.65, y - s * 0.35],
          ],
          { ...R, fill: '#44403c', fillStyle: 'solid', stroke: '#44403c', strokeWidth: 1 },
        )
      }
      return rc.polygon(
        [
          [x, y - s],
          [x - s * 0.65, y + s * 0.35],
          [x + s * 0.65, y + s * 0.35],
        ],
        { ...R, fill: '#15803d', fillStyle: 'solid', stroke: '#15803d', strokeWidth: 1 },
      )
    }

    add(tri(cApp, N.app.y - 2, 'down'))
    add(tri(cArc, yArcT - 2, 'down'))
    add(tri(cApp, yArcT - 2, 'down'))
    add(tri(cFeeds, yArcT - 2, 'down'))
    add(tri(cArc, yArcB + 2, 'up'))
  }, [])

  const t = (props: {
    x: number
    y: number
    fill: string
    size: number
    weight?: number
    children: string
    anchor?: 'middle'
  }) => (
    <text
      x={props.x}
      y={props.y}
      fill={props.fill}
      fontSize={props.size}
      fontWeight={props.weight ?? 400}
      textAnchor={props.anchor ?? 'start'}
      style={{ fontFamily: hand }}
    >
      {props.children}
    </text>
  )

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-2 border-dashed border-slate-300/90 bg-[#fffef9] p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-col gap-2 border-b-2 border-dashed border-amber-200/80 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600" style={{ fontFamily: hand }}>
            pegpulse · diagram
          </p>
          <p className="mt-1 text-base font-bold text-slate-900 sm:text-lg" style={{ fontFamily: hand }}>
            Data flow (testnet)
          </p>
        </div>
        <p className="max-w-sm text-[11px] leading-snug text-slate-600 sm:text-xs" style={{ fontFamily: hand }}>
          Arrows: direction of calls/data. Dashed green: optional resolver → same Arc contracts (settle).
        </p>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB.w} ${VB.h}`}
        className="mx-auto h-auto w-full max-w-[880px]"
        role="img"
        aria-label="PegPulse architecture diagram: client, Next app, Arc, snapshot JSON, external price APIs, optional resolver."
      >
        <g ref={sketchRef} />

        <g pointerEvents="none" style={{ fontFamily: hand }}>
          {/* Client */}
          {t({ x: cx(N.client), y: N.client.y + 26, fill: '#0c0a09', size: 15, weight: 700, anchor: 'middle', children: 'Client' })}
          {t({
            x: cx(N.client),
            y: N.client.y + 44,
            fill: '#57534e',
            size: 11,
            anchor: 'middle',
            children: 'browser · wallet · wagmi / viem',
          })}

          {/* App */}
          {t({ x: cx(N.app), y: N.app.y + 28, fill: '#0c0a09', size: 15, weight: 700, anchor: 'middle', children: 'PegPulse (Next.js)' })}
          {t({
            x: cx(N.app),
            y: N.app.y + 48,
            fill: '#1e3a5f',
            size: 11,
            anchor: 'middle',
            children: 'UI + Route Handlers · lazy readContract',
          })}
          {t({
            x: cx(N.app),
            y: N.app.y + 66,
            fill: '#1e3a5f',
            size: 10,
            anchor: 'middle',
            children: '/api/quotes · /api/price-chart · /api/chainlink',
          })}

          {/* Edge captions */}
          {t({ x: cx(N.app) + 8, y: bottomY(N.client) + 14, fill: '#78716c', size: 10, children: 'UI + signed tx' })}
          {t({ x: cx(N.arc) - 52, y: bottomY(N.app) + 14, fill: '#0033AD', size: 10, weight: 700, children: 'RPC' })}
          {t({ x: cx(N.snap) - 18, y: bottomY(N.app) + 14, fill: '#0033AD', size: 10, weight: 700, children: 'read' })}
          {t({ x: cx(N.feeds) - 28, y: bottomY(N.app) + 14, fill: '#0e7490', size: 10, weight: 700, children: 'HTTPS' })}

          {/* Arc */}
          {t({ x: cx(N.arc), y: N.arc.y + 28, fill: '#ffffff', size: 14, weight: 700, anchor: 'middle', children: 'Arc Testnet' })}
          {t({
            x: cx(N.arc),
            y: N.arc.y + 48,
            fill: '#e2e8f0',
            size: 10,
            anchor: 'middle',
            children: 'Factory → Market · USDC',
          })}
          {t({
            x: cx(N.arc),
            y: N.arc.y + 64,
            fill: '#cbd5e1',
            size: 9,
            anchor: 'middle',
            children: 'betWin / betLose · settle · withdraw',
          })}

          {/* Snapshot */}
          {t({
            x: cx(N.snap),
            y: N.snap.y + 30,
            fill: '#0c0a09',
            size: 14,
            weight: 700,
            anchor: 'middle',
            children: 'Snapshot',
          })}
          {t({
            x: cx(N.snap),
            y: N.snap.y + 52,
            fill: '#57534e',
            size: 10,
            anchor: 'middle',
            children: 'market-snapshot.json',
          })}
          {t({
            x: cx(N.snap),
            y: N.snap.y + 68,
            fill: '#78716c',
            size: 9,
            anchor: 'middle',
            children: 'static list · RPC on detail',
          })}

          {/* Feeds */}
          {t({
            x: cx(N.feeds),
            y: N.feeds.y + 28,
            fill: '#0f172a',
            size: 14,
            weight: 700,
            anchor: 'middle',
            children: 'Price feeds',
          })}
          {t({
            x: cx(N.feeds),
            y: N.feeds.y + 48,
            fill: '#334155',
            size: 10,
            anchor: 'middle',
            children: 'Llama · CoinGecko · GeckoTerminal',
          })}
          {t({
            x: cx(N.feeds),
            y: N.feeds.y + 64,
            fill: '#334155',
            size: 9,
            anchor: 'middle',
            children: 'Chainlink FX (Eth / OP / Poly)',
          })}

          {/* Resolver */}
          {t({
            x: cx(N.resolver),
            y: N.resolver.y + 26,
            fill: '#14532d',
            size: 13,
            weight: 700,
            anchor: 'middle',
            children: 'Resolver (optional)',
          })}
          {t({
            x: cx(N.resolver),
            y: N.resolver.y + 44,
            fill: '#166534',
            size: 10,
            anchor: 'middle',
            children: 'same feeds · rules → settleMarket()',
          })}

          {t({
            x: cx(N.arc) + 78,
            y: (N.resolver.y + bottomY(N.arc)) / 2 + 6,
            fill: '#15803d',
            size: 9,
            weight: 700,
            children: 'settle',
          })}
        </g>
      </svg>

      <p className="mt-3 border-t-2 border-dashed border-amber-200/70 pt-3 text-[10px] leading-relaxed text-stone-500" style={{ fontFamily: hand }}>
        chainId 5042002 · Feed coverage and pool depth vary by asset; charts show only series we successfully fetch.
      </p>
    </div>
    )
}
