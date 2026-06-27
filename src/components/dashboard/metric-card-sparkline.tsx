"use client"

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ComponentType } from 'react'
import type { SparklinePoint } from '@/lib/dashboard/types'
import { cn } from '@/lib/utils'

interface MetricCardSparklineProps {
  title: string
  value: string
  icon: ComponentType<{ className?: string }>
  deltaPercent?: number
  todayChange?: number
  sparkline?: SparklinePoint[]
  status?: 'positive' | 'warning' | 'critical'
}

export function MetricCardSparkline({
  title,
  value,
  icon: Icon,
  deltaPercent = 0,
  todayChange = 0,
  sparkline = [],
  status = 'positive'
}: MetricCardSparklineProps) {
  // Determine color theme based on status
  const colorMap = {
    positive: {
      text: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
      border: 'border-emerald-500/20 dark:border-emerald-400/20',
      stroke: 'stroke-emerald-500 dark:stroke-emerald-400',
      fill: 'fill-emerald-500/10 dark:fill-emerald-400/5',
      accent: '#10b981'
    },
    warning: {
      text: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-500/10 dark:bg-amber-400/10',
      border: 'border-amber-500/20 dark:border-amber-400/20',
      stroke: 'stroke-amber-500 dark:stroke-amber-400',
      fill: 'fill-amber-500/10 dark:fill-amber-400/5',
      accent: '#f59e0b'
    },
    critical: {
      text: 'text-rose-500 dark:text-rose-400',
      bg: 'bg-rose-500/10 dark:bg-rose-400/10',
      border: 'border-rose-500/20 dark:border-rose-400/20',
      stroke: 'stroke-rose-500 dark:stroke-rose-400',
      fill: 'fill-rose-500/10 dark:fill-rose-400/5',
      accent: '#f43f5e'
    }
  }

  const activeColors = colorMap[status] || colorMap.positive

  // Generate SVG Sparkline coordinates
  const width = 120
  const height = 32
  let sparklinePoints = ''
  let fillPath = ''
  
  if (sparkline && sparkline.length > 1) {
    const vals = sparkline.map((s) => s.value)
    const maxVal = Math.max(...vals, 1)
    const minVal = Math.min(...vals, 0)
    const valRange = maxVal - minVal || 1

    const pts = sparkline.map((s, idx) => {
      const x = (idx / (sparkline.length - 1)) * width
      const y = height - ((s.value - minVal) / valRange) * (height - 4) - 2
      return { x, y }
    })

    sparklinePoints = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
    fillPath = `M 0,${height} L ${sparklinePoints} L ${width},${height} Z`
  }

  const isGrowth = deltaPercent > 0
  const isLoss = deltaPercent < 0

  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-all hover:shadow-md hover:border-muted-foreground/30">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground", activeColors.text)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <div>
          <span className="text-2xl font-bold tracking-tight text-foreground">{value}</span>
          
          <div className="mt-1.5 flex items-center gap-1.5">
            {deltaPercent !== 0 ? (
              <span className={cn(
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold border",
                activeColors.text,
                activeColors.bg,
                activeColors.border
              )}>
                {isGrowth ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : isLoss ? (
                  <ArrowDownRight className="h-3 w-3" />
                ) : (
                  <Minus className="h-3 w-3" />
                )}
                {Math.abs(deltaPercent).toFixed(1)}%
              </span>
            ) : null}

            {todayChange !== 0 ? (
              <span className="text-[11px] text-muted-foreground">
                {todayChange > 0 ? `+${todayChange.toLocaleString()}` : todayChange.toLocaleString()} today
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">No change today</span>
            )}
          </div>
        </div>

        {/* Sparkline Graph */}
        {sparklinePoints ? (
          <div className="w-[120px] h-8 shrink-0 overflow-hidden">
            <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id={`grad-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeColors.accent} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={activeColors.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* Fill Area */}
              <path d={fillPath} fill={`url(#grad-${title.replace(/\s+/g, '-')})`} />
              {/* Stroke Line */}
              <polyline
                fill="none"
                points={sparklinePoints}
                className={cn("stroke-2", activeColors.stroke)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ) : null}
      </div>
    </div>
  )
}
