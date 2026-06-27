'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Search,
  SlidersHorizontal,
  LayoutList,
  LayoutGrid,
  RefreshCw,
  ChevronDown,
  X,
  Loader2,
  Clock,
  Filter,
  Upload,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { B2BPlatform, B2BLeadStatus, Profile } from '@/types'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'

export type ViewMode = 'table' | 'card'

export interface LeadFilters {
  search: string
  platform: string
  status: string
  assignedTo: string
  dateRange: string
  showDeleted: boolean
}

interface LeadsToolbarProps {
  filters: LeadFilters
  onFiltersChange: (filters: LeadFilters) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  totalCount: number
  filteredCount: number
  staff: Profile[]
  defaultPlatform?: B2BPlatform | 'all'
  showOnlyAssignedToMe?: boolean
  showOnlyReports?: boolean
  isAutoSyncing?: boolean
  autoSyncStatus?: string
  lastSyncAt?: string | null
  onSyncAll?: () => void
  onSyncPlatform?: (platform: B2BPlatform) => void
  syncingPlatform?: B2BPlatform | null
  isSyncingAll?: boolean
  onImportClick?: () => void
  onExportCSV?: () => void
  onExportExcel?: () => void
  onExportPDF?: () => void
  onTemplateClick?: () => void
  onHistoryClick?: () => void
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'New', color: 'bg-slate-500/20 text-slate-400' },
  { value: 'assigned', label: 'Assigned', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'contacted', label: 'Contacted', color: 'bg-amber-500/20 text-amber-400' },
  { value: 'quoted', label: 'Quoted', color: 'bg-indigo-500/20 text-indigo-400' },
  { value: 'converted', label: 'Converted', color: 'bg-emerald-500/20 text-emerald-400' },
  { value: 'rejected', label: 'Rejected', color: 'bg-rose-500/20 text-rose-400' },
  { value: 'lost', label: 'Lost', color: 'bg-red-900/20 text-red-400' },
]

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
]

const PLATFORM_OPTIONS = [
  { value: 'all', label: 'All Platforms' },
  { value: 'INDIAMART', label: 'IndiaMART', color: 'text-sky-400' },
  { value: 'TRADEINDIA', label: 'TradeIndia', color: 'text-amber-400' },
  { value: 'EXPORTERSINDIA', label: 'ExportersIndia', color: 'text-teal-400' },
]

export function LeadsToolbar({
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  totalCount,
  filteredCount,
  staff,
  defaultPlatform = 'all',
  showOnlyAssignedToMe = false,
  showOnlyReports = false,
  isAutoSyncing = false,
  autoSyncStatus,
  lastSyncAt,
  onSyncAll,
  onSyncPlatform,
  syncingPlatform,
  isSyncingAll,
  onImportClick,
  onExportCSV,
  onExportExcel,
  onExportPDF,
  onTemplateClick,
  onHistoryClick,
}: LeadsToolbarProps) {
  const [showFilters, setShowFilters] = useState(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [localSearch, setLocalSearch] = useState(filters.search)

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value)
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        onFiltersChange({ ...filters, search: value })
      }, 300)
    },
    [filters, onFiltersChange]
  )

  const handleClearSearch = () => {
    setLocalSearch('')
    onFiltersChange({ ...filters, search: '' })
  }

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.assignedTo !== 'all' ||
    filters.dateRange !== 'all' ||
    filters.showDeleted ||
    (defaultPlatform === 'all' && filters.platform !== 'all')

  const handleResetFilters = () => {
    setLocalSearch('')
    onFiltersChange({
      search: '',
      platform: defaultPlatform,
      status: 'all',
      assignedTo: 'all',
      dateRange: 'all',
      showDeleted: false,
    })
  }

  const syncDotColor =
    isAutoSyncing || autoSyncStatus === 'syncing'
      ? 'bg-blue-400 animate-pulse'
      : autoSyncStatus === 'success'
      ? 'bg-emerald-400'
      : autoSyncStatus === 'error'
      ? 'bg-red-400'
      : autoSyncStatus === 'rate_limited'
      ? 'bg-amber-400'
      : 'bg-muted-foreground/40'

  return (
    <div className="space-y-2">
      {/* Sync status bar */}
      {!showOnlyReports && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full shrink-0', syncDotColor)} />
            <span className="text-xs font-medium text-muted-foreground">
              {isAutoSyncing || autoSyncStatus === 'syncing'
                ? 'Syncing…'
                : autoSyncStatus === 'success'
                ? 'Auto-sync active'
                : autoSyncStatus === 'error'
                ? 'Sync error'
                : autoSyncStatus === 'rate_limited'
                ? 'Rate limited'
                : 'Auto-sync ready'}
            </span>
            {lastSyncAt && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                <Clock className="h-3 w-3" />
                {new Date(lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {onSyncAll && (
              <button
                type="button"
                onClick={onSyncAll}
                disabled={isSyncingAll || !!syncingPlatform}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
              >
                {isSyncingAll ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                Sync All
              </button>
            )}
            {(['INDIAMART', 'TRADEINDIA', 'EXPORTERSINDIA'] as B2BPlatform[]).map(
              (platform) => {
                const colors: Record<string, string> = {
                  INDIAMART: 'text-sky-400 border-sky-500/20 hover:bg-sky-500/10',
                  TRADEINDIA: 'text-amber-400 border-amber-500/20 hover:bg-amber-500/10',
                  EXPORTERSINDIA: 'text-teal-400 border-teal-500/20 hover:bg-teal-500/10',
                }
                const labels: Record<string, string> = {
                  INDIAMART: 'IndiaMART',
                  TRADEINDIA: 'TradeIndia',
                  EXPORTERSINDIA: 'ExportersIndia',
                }
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => onSyncPlatform?.(platform)}
                    disabled={!!syncingPlatform || isSyncingAll}
                    className={cn(
                      'hidden sm:flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold border disabled:opacity-50 transition-colors',
                      colors[platform]
                    )}
                  >
                    {syncingPlatform === platform ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    {labels[platform]}
                  </button>
                )
              }
            )}
          </div>
        </div>
      )}

      {/* Main toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search enquiries."
            className="w-full h-8 rounded-lg border border-border bg-background pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
          />
          {localSearch && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Quick filter chips */}
        <div className="flex items-center gap-1.5">
          {/* Platform filter (only on All Enquiries view) */}
          {defaultPlatform === 'all' && (
            <select
              value={filters.platform}
              onChange={(e) => onFiltersChange({ ...filters, platform: e.target.value })}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all cursor-pointer"
            >
              {PLATFORM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {/* Status filter */}
          <select
            value={filters.status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
            className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all cursor-pointer"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Date range */}
          <select
            value={filters.dateRange}
            onChange={(e) => onFiltersChange({ ...filters, dateRange: e.target.value })}
            className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all cursor-pointer"
          >
            {DATE_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Staff filter (not when showOnlyAssignedToMe) */}
          {!showOnlyAssignedToMe && (
            <select
              value={filters.assignedTo}
              onChange={(e) => onFiltersChange({ ...filters, assignedTo: e.target.value })}
              className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all cursor-pointer"
            >
              <option value="all">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
          )}

          {/* Show deleted toggle */}
          <label className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background cursor-pointer hover:bg-muted/40 transition-colors select-none">
            <input
              type="checkbox"
              checked={filters.showDeleted}
              onChange={(e) => onFiltersChange({ ...filters, showDeleted: e.target.checked })}
              className="h-3.5 w-3.5 rounded accent-primary"
            />
            <span className="text-xs text-muted-foreground">Deleted</span>
          </label>

          {/* Reset filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 h-8 px-2.5 rounded-lg border border-rose-500/20 bg-rose-500/5 text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Count badge */}
        <span className="text-xs text-muted-foreground shrink-0">
          {filteredCount !== totalCount ? (
            <span>
              <span className="font-semibold text-foreground">{filteredCount}</span>
              <span className="text-muted-foreground"> of {totalCount}</span>
            </span>
          ) : (
            <span>
              <span className="font-semibold text-foreground">{totalCount}</span>
              <span className="text-muted-foreground"> enquiries</span>
            </span>
          )}
        </span>

        {/* Import & Export Actions */}
        <div className="flex items-center gap-1.5">
          {onTemplateClick && (
            <button
              type="button"
              onClick={onTemplateClick}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-all cursor-pointer"
              title="Download Import Excel Template"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Template</span>
            </button>
          )}

          {onImportClick && (
            <button
              type="button"
              onClick={onImportClick}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-all cursor-pointer"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Import</span>
            </button>
          )}

          {onHistoryClick && (
            <button
              type="button"
              onClick={onHistoryClick}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-all cursor-pointer"
              title="View Import/Export History Logs"
            >
              <Clock className="h-3.5 w-3.5" />
              <span>History</span>
            </button>
          )}

          {(onExportCSV || onExportExcel || onExportPDF) && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-all cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export</span>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 min-w-[120px]">
                {onExportExcel && (
                  <DropdownMenuItem onClick={onExportExcel} className="text-slate-300 focus:bg-slate-800 focus:text-white flex items-center gap-1.5 cursor-pointer">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Excel</span>
                  </DropdownMenuItem>
                )}
                {onExportCSV && (
                  <DropdownMenuItem onClick={onExportCSV} className="text-slate-300 focus:bg-slate-800 focus:text-white flex items-center gap-1.5 cursor-pointer">
                    <FileText className="h-3.5 w-3.5 text-blue-400" />
                    <span>CSV</span>
                  </DropdownMenuItem>
                )}
                {onExportPDF && (
                  <DropdownMenuItem onClick={onExportPDF} className="text-slate-300 focus:bg-slate-800 focus:text-white flex items-center gap-1.5 cursor-pointer">
                    <FileText className="h-3.5 w-3.5 text-red-400" />
                    <span>PDF</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
          <button
            type="button"
            onClick={() => onViewModeChange('table')}
            className={cn(
              'flex items-center justify-center h-6 w-6 rounded-md transition-all',
              viewMode === 'table'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Table view"
          >
            <LayoutList className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('card')}
            className={cn(
              'flex items-center justify-center h-6 w-6 rounded-md transition-all',
              viewMode === 'card'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Card view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
