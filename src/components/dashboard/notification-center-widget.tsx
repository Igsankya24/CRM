"use client"

import { useState } from 'react'
import { Sparkles, MessageSquare, UserCheck, AlertTriangle, Info, Bell, CheckCheck } from 'lucide-react'
import type { SystemNotificationItem } from '@/lib/dashboard/types'

interface NotificationCenterWidgetProps {
  notifications: SystemNotificationItem[]
}

type FilterType = 'all' | 'lead' | 'message' | 'ai'

export function NotificationCenterWidget({ notifications: initialNotifications }: NotificationCenterWidgetProps) {
  const [notifications, setNotifications] = useState<SystemNotificationItem[]>(initialNotifications)
  const [filter, setFilter] = useState<FilterType>('all')

  const unreadCount = notifications.filter((n) => n.unread).length

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
  }

  const handleMarkSingleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    )
  }

  const filteredNotifs = notifications.filter((n) => {
    if (filter === 'all') return true
    return n.type === filter
  })

  const getIcon = (type: string) => {
    switch (type) {
      case 'lead':
        return { icon: Sparkles, color: 'text-sky-500 bg-sky-500/10' }
      case 'message':
        return { icon: MessageSquare, color: 'text-emerald-500 bg-emerald-500/10' }
      case 'assignment':
        return { icon: UserCheck, color: 'text-indigo-500 bg-indigo-500/10' }
      case 'ai':
        return { icon: AlertTriangle, color: 'text-rose-500 bg-rose-500/10' }
      default:
        return { icon: Info, color: 'text-slate-500 bg-slate-500/10' }
    }
  }

  const formatRelativeTime = (timestampStr: string) => {
    const d = new Date(timestampStr)
    const diffMin = Math.round((new Date().getTime() - d.getTime()) / 60000)
    
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    
    const diffHrs = Math.round(diffMin / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="h-4 w-4 text-foreground" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-rose-500 animate-ping" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Notification Center</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Live CRM activity and agent assignment log</p>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg border border-border">
            {(['all', 'lead', 'message', 'ai'] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[9px] font-bold h-6 px-2.5 rounded-md capitalize transition-all ${
                  filter === f
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
        {filteredNotifs.length === 0 ? (
          <div className="text-xs text-muted-foreground italic text-center py-6">
            No system notifications found.
          </div>
        ) : (
          filteredNotifs.map((n) => {
            const config = getIcon(n.type)
            const Icon = config.icon

            return (
              <div
                key={n.id}
                onClick={() => handleMarkSingleRead(n.id)}
                className={`rounded-lg border border-border/60 bg-muted/10 p-3 flex items-start justify-between gap-3 transition cursor-pointer hover:border-muted-foreground/25 ${
                  n.unread ? 'border-primary/30 bg-primary/2 dark:bg-primary/2' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className={`text-xs text-foreground leading-relaxed ${n.unread ? 'font-semibold' : ''}`}>
                      {n.message}
                    </p>
                    <span className="text-[10px] text-muted-foreground block mt-1">
                      {formatRelativeTime(n.timestamp)}
                    </span>
                  </div>
                </div>

                {n.unread && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
