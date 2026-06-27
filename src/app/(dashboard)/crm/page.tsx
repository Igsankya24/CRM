'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useCrmKanban } from '@/hooks/use-crm-kanban';
import { KanbanBoard } from '@/components/crm/kanban-board';
import { LeadDetailDrawer } from '@/components/crm/lead-detail-drawer';
import { CircularBoard } from '@/components/crm/circular-board';
import { LeadCard } from '@/components/crm/lead-card';
import { CRM_STAGE_LABELS } from '@/types/crm';
import type { CrmLead, CrmStage, CrmOverview, CrmSource, CreateCrmLeadRequest } from '@/types/crm';
import {
  TrendingUp,
  Flame,
  IndianRupee,
  Users,
  Clock,
  Plus,
  LayoutGrid,
  List,
  Search,
  Filter,
  RefreshCw,
  Zap,
  Target,
  ArrowUpRight,
  BarChart3,
  X,
} from 'lucide-react';

const SOURCE_OPTIONS: { value: CrmSource; label: string }[] = [
  { value: 'INDIAMART', label: 'IndiaMART' },
  { value: 'TRADEINDIA', label: 'TradeIndia' },
  { value: 'EXPORTERSINDIA', label: 'ExportersIndia' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'ADS', label: 'Ads' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'REFERRAL', label: 'Referral' },
];

export default function CrmPipelinePage() {
  const {
    stages,
    overview,
    loading,
    error,
    fetchKanban,
    moveLeadOptimistic,
    commitTransition,
    getStageLeads,
    getStageStats,
  } = useCrmKanban();

  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'circular' | 'kanban'>('circular');
  const [selectedStage, setSelectedStage] = useState<CrmStage | null>(null);

  useEffect(() => {
    fetchKanban();
  }, [fetchKanban]);

  const handleLeadClick = useCallback((lead: CrmLead) => {
    setSelectedLead(lead);
    setDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedLead(null);
  }, []);

  const handleTransition = useCallback(
    async (leadId: string, toStage: CrmStage, reason?: string) => {
      const result = await commitTransition(leadId, toStage, reason);
      if (result.success) {
        // Refresh kanban and close drawer
        await fetchKanban();
        handleCloseDrawer();
      }
      return result;
    },
    [commitTransition, fetchKanban, handleCloseDrawer],
  );

  const handleUpdate = useCallback(
    async (leadId: string, data: Partial<CrmLead>) => {
      await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await fetchKanban();
    },
    [fetchKanban],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchKanban();
    setRefreshing(false);
  }, [fetchKanban]);

  // Extract all leads from the indexed stage records
  const allLeads = useMemo(() => {
    return Object.values(stages).map((s) => s.leads).flat();
  }, [stages]);

  // Filter leads by the selected circle stage
  const selectedLeads = useMemo(() => {
    if (!selectedStage) return allLeads;
    return stages[selectedStage]?.leads || [];
  }, [selectedStage, stages, allLeads]);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">CRM Pipeline</h1>
          <p className="text-sm text-slate-400">
            {viewMode === 'circular'
              ? 'Circular circular lead workflow. Click any stage to show leads'
              : 'Drag and drop leads between stages to manage your sales pipeline'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-1">
            <button
              onClick={() => setViewMode('circular')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'circular'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Circular View
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                viewMode === 'kanban'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban View
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className={`rounded-lg border border-slate-700 p-2 text-slate-400 transition-all hover:border-slate-600 hover:text-white ${refreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowNewLeadModal(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
            >
              <Plus className="h-4 w-4" />
              New Lead
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      {overview && <StatsRow overview={overview} />}

      {/* Main View Container */}
      <div className="flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/20 p-3">
        {loading && Object.keys(stages).length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-slate-400">Loading pipeline...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={handleRefresh}
                className="mt-2 text-xs text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        ) : viewMode === 'circular' ? (
          <div className="flex flex-col h-full overflow-y-auto pr-1">
            <CircularBoard
              leads={allLeads}
              selectedStage={selectedStage}
              onSelectStage={setSelectedStage}
            />

            {/* Filtered Lead Cards List */}
            <div className="flex flex-col gap-3 mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300">
                  {selectedStage ? `${CRM_STAGE_LABELS[selectedStage]} Leads` : 'All Pipeline Leads'}
                  <span className="ml-2 text-xs font-medium text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                    {selectedLeads.length}
                  </span>
                </h3>
                {selectedStage && (
                  <button
                    onClick={() => setSelectedStage(null)}
                    className="text-xs text-primary hover:underline"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              
              {selectedLeads.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {selectedLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onClick={() => handleLeadClick(lead)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 rounded-xl border border-dashed border-slate-800 bg-slate-900/10 text-center">
                  <p className="text-sm text-slate-500">No leads currently in this stage.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <KanbanBoard
            stages={stages}
            onLeadClick={handleLeadClick}
            onMoveLeadOptimistic={moveLeadOptimistic}
            onCommitTransition={commitTransition}
          />
        )}
      </div>

      {/* Lead Detail Drawer */}
      <LeadDetailDrawer
        lead={selectedLead}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        onTransition={handleTransition}
        onUpdate={handleUpdate}
      />

      {/* New Lead Modal */}
      {showNewLeadModal && (
        <NewLeadModal
          onClose={() => setShowNewLeadModal(false)}
          onCreated={async () => {
            setShowNewLeadModal(false);
            await fetchKanban();
          }}
        />
      )}
    </div>
  );
}

// ── Stats Row ──
function StatsRow({ overview }: { overview: CrmOverview }) {
  const stats = [
    {
      label: 'Total Leads',
      value: overview.total_leads,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'New Today',
      value: overview.new_today,
      icon: Zap,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Hot Leads',
      value: overview.hot_leads,
      icon: Flame,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
    },
    {
      label: 'Pipeline Value',
      value: formatINR(overview.total_pipeline_value),
      icon: IndianRupee,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      isText: true,
    },
    {
      label: 'Conversion',
      value: `${overview.conversion_rate || 0}%`,
      icon: Target,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      isText: true,
    },
    {
      label: 'Overdue',
      value: overview.overdue_followups,
      icon: Clock,
      color: overview.overdue_followups > 0 ? 'text-red-400' : 'text-slate-400',
      bg: overview.overdue_followups > 0 ? 'bg-red-500/10' : 'bg-slate-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3 backdrop-blur transition-all hover:border-slate-700 hover:bg-slate-900/60"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg}`}>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div>
              <p className="text-lg font-bold text-white leading-tight">
                {stat.isText ? stat.value : stat.value}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── New Lead Modal ──
function NewLeadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [formData, setFormData] = useState<CreateCrmLeadRequest>({
    source: 'MANUAL',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create lead');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field: keyof CreateCrmLeadRequest, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <h3 className="text-lg font-bold text-white">Create New Lead</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Source */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Source *</label>
            <select
              value={formData.source}
              onChange={(e) => updateField('source', e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputField label="Buyer Name" value={formData.buyer_name} onChange={(v) => updateField('buyer_name', v)} />
            <InputField label="Company" value={formData.company_name} onChange={(v) => updateField('company_name', v)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputField label="Phone" value={formData.phone} onChange={(v) => updateField('phone', v)} />
            <InputField label="Email" value={formData.email} onChange={(v) => updateField('email', v)} type="email" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <InputField label="City" value={formData.city} onChange={(v) => updateField('city', v)} />
            <InputField label="State" value={formData.state} onChange={(v) => updateField('state', v)} />
            <InputField label="Country" value={formData.country} onChange={(v) => updateField('country', v)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputField label="Product" value={formData.product_name} onChange={(v) => updateField('product_name', v)} />
            <InputField label="Quantity" value={formData.quantity} onChange={(v) => updateField('quantity', v)} />
          </div>

          <InputField
            label="Expected Value (₹)"
            value={formData.expected_value?.toString()}
            onChange={(v) => setFormData((p) => ({ ...p, expected_value: Number(v) || undefined }))}
            type="number"
          />

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
      />
    </div>
  );
}

function formatINR(value: number): string {
  if (!value) return '₹0';
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value}`;
}
