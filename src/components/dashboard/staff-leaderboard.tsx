"use client"

import { Crown, Sparkles, User, Shield, TrendingUp, Clock, DollarSign, Check } from 'lucide-react'
import type { ManagerLeaderboardItem } from '@/lib/dashboard/types'
import { formatCurrency } from '@/lib/currency'
import { useAuth } from '@/hooks/use-auth'

interface StaffLeaderboardProps {
  leaderboard: ManagerLeaderboardItem[]
}

export function StaffLeaderboard({ leaderboard }: StaffLeaderboardProps) {
  const { defaultCurrency } = useAuth()

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Staff Performance Leaderboard</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Ranked by lead conversions and closed deals revenue</p>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="bg-muted text-muted-foreground font-semibold border-b border-border uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3">Rank</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Assigned Leads</th>
                <th className="px-5 py-3">Conversions</th>
                <th className="px-5 py-3">WhatsApp Chats</th>
                <th className="px-5 py-3">Avg Response</th>
                <th className="px-5 py-3 text-right">Revenue Closed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leaderboard.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground italic">
                    No staff records found in this account.
                  </td>
                </tr>
              ) : (
                leaderboard.map((staff, index) => {
                  const rank = index + 1
                  const isTop = staff.isTopPerformer || rank === 1

                  return (
                    <tr key={staff.userId} className={`hover:bg-muted/40 transition align-middle ${isTop ? 'bg-primary/5 dark:bg-primary/5' : ''}`}>
                      {/* Rank */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1">
                          {rank === 1 ? (
                            <Crown className="h-4 w-4 text-amber-500 fill-amber-500 animate-bounce" />
                          ) : (
                            <span className="font-bold text-muted-foreground text-xs w-4 text-center">{rank}</span>
                          )}
                        </div>
                      </td>

                      {/* User profile */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {staff.avatarUrl ? (
                            <img
                              src={staff.avatarUrl}
                              alt={staff.name}
                              className="h-7 w-7 rounded-full border border-border shrink-0 object-cover"
                            />
                          ) : (
                            <div className="h-7 w-7 rounded-full bg-muted border border-border shrink-0 flex items-center justify-center text-muted-foreground">
                              <User className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-foreground flex items-center gap-1.5">
                              {staff.name}
                              {isTop && (
                                <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 py-0.25 text-[8px] font-bold uppercase tracking-wider">
                                  Top
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Assigned Leads */}
                      <td className="px-5 py-3.5 text-muted-foreground font-semibold">
                        {staff.assignedLeads} leads
                      </td>

                      {/* Conversions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-500">
                          <Check className="h-4 w-4 shrink-0" />
                          {staff.conversions}
                        </div>
                      </td>

                      {/* WhatsApp Chats */}
                      <td className="px-5 py-3.5 text-muted-foreground font-semibold">
                        {staff.whatsappConversations} chats
                      </td>

                      {/* Avg Response */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 text-muted-foreground font-semibold">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {staff.responseTimeMinutes > 0 ? `${staff.responseTimeMinutes} min` : 'N/A'}
                        </div>
                      </td>

                      {/* Revenue Closed */}
                      <td className="px-5 py-3.5 text-right font-bold text-foreground">
                        {formatCurrency(staff.revenue, defaultCurrency)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
