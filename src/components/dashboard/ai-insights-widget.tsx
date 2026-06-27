"use client"

import { Sparkles, AlertTriangle, ShieldCheck, Flame, Hourglass, ArrowUpRight } from 'lucide-react'
import type { AiInsightsData } from '@/lib/dashboard/types'

interface AiInsightsWidgetProps {
  data: AiInsightsData
}

export function AiInsightsWidget({ data }: AiInsightsWidgetProps) {
  const summaryChips = [
    { label: 'Hot Leads', value: data.hotLeadsCount, icon: Flame, color: 'text-rose-500 bg-rose-500/10' },
    { label: 'Inactive Chats', value: data.inactiveLeadsCount, icon: Hourglass, color: 'text-amber-500 bg-amber-500/10' },
    { label: 'Urgent Alerts', value: data.urgentFollowUpsCount, icon: AlertTriangle, color: 'text-amber-500 bg-amber-500/10' },
    { label: 'High Conversion', value: data.highConversionLeadsCount, icon: ShieldCheck, color: 'text-emerald-500 bg-emerald-500/10' }
  ]

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'hot':
        return 'text-rose-500 dark:text-rose-400 bg-rose-500/15 border-rose-500/25'
      case 'urgent':
        return 'text-amber-500 dark:text-amber-400 bg-amber-500/15 border-amber-500/25'
      case 'inactive':
        return 'text-indigo-500 dark:text-indigo-400 bg-indigo-500/15 border-indigo-500/25'
      default:
        return 'text-sky-500 dark:text-sky-400 bg-sky-500/15 border-sky-500/25'
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">AI Intelligence & Suggestions</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Automated purchase intent and conversation health analysis</p>
          </div>
        </div>
      </div>

      {/* Analytics Summary Counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryChips.map((chip) => {
          const Icon = chip.icon
          return (
            <div key={chip.label} className="rounded-lg border border-border bg-muted/30 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground">{chip.label}</span>
                <div className="text-lg font-bold text-foreground mt-1">{chip.value}</div>
              </div>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${chip.color}`}>
                <Icon className="h-4 w-4" />
              </div>
            </div>
          )
        })}
      </div>

      {/* AI Recommendations List */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">AI Action Suggestions</h4>
        
        <div className="space-y-2.5">
          {data.suggestions.map((sug) => (
            <div key={sug.id} className="rounded-lg border border-border bg-muted/20 p-3.5 flex items-center justify-between gap-4 transition hover:border-muted-foreground/25">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground leading-relaxed">{sug.text}</p>
                  <span className={`inline-block border px-1.5 py-0.5 rounded text-[9px] font-bold uppercase mt-1.5 ${getCategoryColor(sug.category)}`}>
                    {sug.category.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Confidence Meter */}
              <div className="flex flex-col items-center shrink-0">
                <span className="text-[10px] font-bold text-muted-foreground">Confidence</span>
                <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded mt-1">
                  {sug.confidence}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
