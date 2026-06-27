"use client"

import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { LeadSourceData } from '@/lib/dashboard/types'

// Curated color palette mapping for each source
const COLORS: Record<string, string> = {
  INDIAMART: '#0ea5e9', // Sky Blue
  TRADEINDIA: '#f59e0b', // Amber
  EXPORTERSINDIA: '#14b8a6', // Teal
  Website: '#a855f7', // Purple
  WhatsApp: '#22c55e', // Emerald Green
  Manual: '#64748b' // Slate
}

interface CustomTooltipProps {
  active?: boolean
  payload?: {
    payload: {
      name: string
      value: number
      percentage: number
    }
  }[]
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const p = payload[0].payload
    const color = COLORS[p.name] || '#64748b'
    return (
      <div className="rounded-lg border border-border bg-card p-2 shadow-md text-xs">
        <div className="flex items-center gap-1.5 font-bold">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-foreground">{p.name}</span>
        </div>
        <div className="text-muted-foreground mt-1 font-semibold pl-4">
          {p.value} leads ({p.percentage}%)
        </div>
      </div>
    )
  }
  return null
}

interface LeadSourceChartProps {
  data: LeadSourceData[]
  onRangeChange?: (range: 7 | 30 | 90 | 365) => void
}

export function LeadSourceChart({ data, onRangeChange }: LeadSourceChartProps) {
  const [activeRange, setActiveRange] = useState<7 | 30 | 90 | 365>(30)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleRangeClick = (r: 7 | 30 | 90 | 365) => {
    setActiveRange(r)
    if (onRangeChange) onRangeChange(r)
  }

  const chartData = data.map((d) => ({
    name: d.source,
    value: d.count,
    percentage: d.percentage
  })).filter(d => d.value > 0)

  const rangeOptions: { label: string; value: 7 | 30 | 90 | 365 }[] = [
    { label: '7 Days', value: 7 },
    { label: '30 Days', value: 30 },
    { label: '90 Days', value: 90 },
    { label: '1 Year', value: 365 }
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Lead Source Shares</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Leads distribution by integration channel</p>
        </div>

        {/* Time filters */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border self-start">
          {rangeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleRangeClick(opt.value)}
              className={`text-[10px] font-bold h-6 px-2.5 rounded-md transition-all ${
                activeRange === opt.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
        {/* Donut Chart */}
        <div className="md:col-span-2 w-full h-[180px] min-w-0 overflow-hidden flex items-center justify-center relative">
          {chartData.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">No lead records in range</div>
          ) : !isMounted ? (
            <div className="text-xs text-muted-foreground italic">Loading chart...</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#64748b'} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}

          {/* Absolute Center Stats */}
          {chartData.length > 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[20px] font-bold text-foreground">
                {chartData.reduce((sum, d) => sum + d.value, 0)}
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Total Leads
              </span>
            </div>
          )}
        </div>

        {/* Legend Breakdown */}
        <div className="md:col-span-3 space-y-2.5 max-h-[190px] overflow-y-auto pr-1">
          {chartData.length === 0 ? (
            <div className="text-xs text-muted-foreground italic pl-4">Add channels to start analytics</div>
          ) : (
            chartData.map((item) => {
              const color = COLORS[item.name] || '#64748b'
              return (
                <div key={item.name} className="flex items-center justify-between text-xs border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-semibold text-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3 font-semibold">
                    <span className="text-foreground">{item.value}</span>
                    <span className="text-muted-foreground text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
