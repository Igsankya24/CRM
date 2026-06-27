"use client"

import type { PipelineStageData } from '@/lib/dashboard/types'
import { formatCurrency } from '@/lib/currency'
import { useAuth } from '@/hooks/use-auth'

interface SalesPipelineStagesProps {
  stagesData: PipelineStageData[]
}

export function SalesPipelineStages({ stagesData }: SalesPipelineStagesProps) {
  const { defaultCurrency } = useAuth()

  // Default fallback stages if DB doesn't have them
  const defaultStages: PipelineStageData[] = [
    { stage: 'New', count: 0, revenue: 0, conversionRate: 0, color: 'bg-sky-500' },
    { stage: 'Qualified', count: 0, revenue: 0, conversionRate: 0, color: 'bg-indigo-500' },
    { stage: 'Quotation Sent', count: 0, revenue: 0, conversionRate: 0, color: 'bg-amber-500' },
    { stage: 'Negotiation', count: 0, revenue: 0, conversionRate: 0, color: 'bg-purple-500' },
    { stage: 'Won', count: 0, revenue: 0, conversionRate: 0, color: 'bg-emerald-500' },
    { stage: 'Lost', count: 0, revenue: 0, conversionRate: 0, color: 'bg-rose-500' }
  ]

  const mergedStages = defaultStages.map((def) => {
    const matched = stagesData.find((s) => s.stage.toLowerCase() === def.stage.toLowerCase())
    return matched ? { ...def, ...matched } : def
  })

  // Calculate max count to scale the progress bars
  const maxCount = Math.max(...mergedStages.map((s) => s.count), 1)

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Sales Pipeline Funnel</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Active deals and revenue distribution by pipeline stage</p>
      </div>

      <div className="space-y-3.5 pt-1">
        {mergedStages.map((s) => {
          const progressPercent = Math.round((s.count / maxCount) * 100)
          
          return (
            <div key={s.stage} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                  <span className="text-foreground">{s.stage}</span>
                </div>
                
                <div className="flex items-center gap-4 text-right">
                  <span className="text-muted-foreground">{s.count} deal{s.count === 1 ? '' : 's'}</span>
                  <span className="text-foreground min-w-[70px]">
                    {formatCurrency(s.revenue, defaultCurrency)}
                  </span>
                  <span className="text-muted-foreground text-[10px] bg-muted px-1.5 py-0.5 rounded min-w-[36px] block">
                    {s.conversionRate}%
                  </span>
                </div>
              </div>

              {/* Progress bar container */}
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${s.color}`} 
                  style={{ width: `${progressPercent}%` }} 
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
