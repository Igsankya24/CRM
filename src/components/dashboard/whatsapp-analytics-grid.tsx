"use client"

import Link from 'next/link'
import { MessageSquare, MailWarning, Send, Zap, Clock, ShieldCheck, ExternalLink } from 'lucide-react'
import type { WhatsAppStatsData } from '@/lib/dashboard/types'

interface WhatsAppAnalyticsGridProps {
  data: WhatsAppStatsData
}

export function WhatsAppAnalyticsGrid({ data }: WhatsAppAnalyticsGridProps) {
  const statCards = [
    {
      title: 'Active Chats',
      value: data.activeConversations,
      desc: 'Open conversations',
      icon: MessageSquare,
      color: 'text-sky-500'
    },
    {
      title: 'Unread Chats',
      value: data.unreadChats,
      desc: 'Requires attention',
      icon: MailWarning,
      color: data.unreadChats > 0 ? 'text-rose-500' : 'text-slate-400'
    },
    {
      title: 'Messages Today',
      value: data.messagesToday,
      desc: 'Inbound + Outbound',
      icon: Send,
      color: 'text-primary'
    },
    {
      title: 'Response Rate',
      value: `${data.responseRate.toFixed(0)}%`,
      desc: 'Replies vs Inbound',
      icon: ShieldCheck,
      color: 'text-emerald-500'
    },
    {
      title: 'Avg Response Time',
      value: `${data.avgResponseTime} min`,
      desc: 'Average first reply',
      icon: Clock,
      color: 'text-amber-500'
    },
    {
      title: 'Broadcast Read Rate',
      value: `${data.broadcastStats.sent > 0 ? Math.round((data.broadcastStats.read / data.broadcastStats.sent) * 100) : 0}%`,
      desc: `${data.broadcastStats.sent} total messages sent`,
      icon: Zap,
      color: 'text-indigo-500'
    }
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">WhatsApp Analytics</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time interaction and agent response tracking</p>
        </div>

        {/* Quick buttons */}
        <div className="flex flex-wrap gap-2">
          <Link href="/inbox">
            <Button size="sm" variant="ghost" className="border border-border text-xs flex items-center gap-1.5 h-8">
              Open Inbox
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
          <Link href="/broadcasts">
            <Button size="sm" variant="ghost" className="border border-border text-xs flex items-center gap-1.5 h-8">
              Broadcast
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
          <Link href="/automations">
            <Button size="sm" variant="ghost" className="border border-border text-xs flex items-center gap-1.5 h-8">
              Templates
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Grid of stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.title} className="rounded-lg border border-border bg-muted/40 p-4 space-y-2.5 transition hover:border-muted-foreground/25">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{c.title}</span>
                <Icon className={`h-4 w-4 ${c.color}`} />
              </div>
              <div className="space-y-1">
                <div className="text-lg font-bold text-foreground">{c.value}</div>
                <div className="text-[10px] text-muted-foreground font-semibold">{c.desc}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  size?: string
  variant?: string
}

// Inline fallback Button component to prevent dependency imports from breaking
function Button({ children, className, onClick, size, variant, ...props }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md bg-background px-3 py-1.5 font-semibold text-foreground border border-border hover:bg-muted transition duration-150 cursor-pointer ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
