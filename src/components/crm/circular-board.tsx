'use client';

import React from 'react';
import {
  User,
  FileQuestion,
  FileText,
  ClipboardList,
  Factory,
  ClipboardCheck,
  Receipt,
  BarChart3,
  Truck,
  Coins,
  ThumbsUp,
  LucideIcon
} from 'lucide-react';
import { CrmLead, CrmStage, CRM_STAGE_LABELS, CRM_STAGE_COLORS } from '@/types/crm';

interface CircularBoardProps {
  leads: CrmLead[];
  selectedStage: CrmStage | null;
  onSelectStage: (stage: CrmStage | null) => void;
}

interface StageDetail {
  id: CrmStage;
  number: string;
  name: string;
  color: string;
  icon: LucideIcon;
}

const STAGES_DETAILS: StageDetail[] = [
  { id: 'Customer', number: '01', name: 'Customer', color: '#3b82f6', icon: User },
  { id: 'Enquiry Design Estimate', number: '02', name: 'Enquiry Design Estimate', color: '#10b981', icon: FileQuestion },
  { id: 'PO / Advance', number: '03', name: 'PO / Advance', color: '#8b5cf6', icon: FileText },
  { id: 'Bill of Material', number: '04', name: 'Bill of Material', color: '#f97316', icon: ClipboardList },
  { id: 'Manufacturing', number: '05', name: 'Manufacturing', color: '#ec4899', icon: Factory },
  { id: 'Inspection', number: '06', name: 'Inspection', color: '#06b6d4', icon: ClipboardCheck },
  { id: 'Invoice', number: '07', name: 'Invoice', color: '#14b8a6', icon: Receipt },
  { id: 'Estimate vs Actual', number: '08', name: 'Estimate vs Actual', color: '#f59e0b', icon: BarChart3 },
  { id: 'Dispatch', number: '09', name: 'Dispatch', color: '#6366f1', icon: Truck },
  { id: 'Payment', number: '10', name: 'Payment', color: '#0ea5e9', icon: Coins },
  { id: 'Appreciation', number: '11', name: 'Appreciation', color: '#e11d48', icon: ThumbsUp },
];

export function CircularBoard({ leads, selectedStage, onSelectStage }: CircularBoardProps) {
  // Precalculate counts and values per stage
  const stageStats = React.useMemo(() => {
    const stats: Record<CrmStage, { count: number; value: number }> = {} as any;
    
    // Initialize
    STAGES_DETAILS.forEach(stage => {
      stats[stage.id] = { count: 0, value: 0 };
    });

    // Populate
    leads.forEach(lead => {
      if (stats[lead.stage]) {
        stats[lead.stage].count += 1;
        stats[lead.stage].value += lead.expected_value || 0;
      }
    });

    return stats;
  }, [leads]);

  // Total pipeline statistics
  const totalValue = React.useMemo(() => {
    return leads.reduce((sum, lead) => sum + (lead.expected_value || 0), 0);
  }, [leads]);

  // Format currency value in Lakhs or standard format
  const formatCurrency = (val: number) => {
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(2)}L`;
    }
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // Center coordinates for SVG
  const size = 600;
  const center = size / 2;
  const radius = 220; // Radius of the circular path

  // Calculate angles and coordinates for each stage node
  const nodes = React.useMemo(() => {
    return STAGES_DETAILS.map((stage, i) => {
      // Offset by -90 deg (top/12 o'clock)
      const theta = -Math.PI / 2 + (i * 2 * Math.PI) / 11;
      const x = center + radius * Math.cos(theta);
      const y = center + radius * Math.sin(theta);
      return { ...stage, x, y, theta };
    });
  }, [center, radius]);

  // Draw connecting clockwise curved arrows
  const connections = React.useMemo(() => {
    return nodes.map((node, i) => {
      const nextNode = nodes[(i + 1) % nodes.length];
      
      // Calculate angular distance and subtract buffer for node circles
      const angularBuffer = 0.22; // approx 12 degrees
      const thetaStart = node.theta + angularBuffer;
      const thetaEnd = nextNode.theta - angularBuffer;

      const xStart = center + radius * Math.cos(thetaStart);
      const yStart = center + radius * Math.sin(thetaStart);
      const xEnd = center + radius * Math.cos(thetaEnd);
      const yEnd = center + radius * Math.sin(thetaEnd);

      return {
        id: `arrow-${i}`,
        d: `M ${xStart} ${yStart} A ${radius} ${radius} 0 0 1 ${xEnd} ${yEnd}`,
        color: node.color
      };
    });
  }, [nodes, center, radius]);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-950/20 border border-slate-900 rounded-2xl shadow-xl backdrop-blur-md">
      {/* Circular Visualization Container */}
      <div className="relative w-full max-w-[620px] aspect-square flex items-center justify-center select-none">
        
        {/* SVG for connecting arrows */}
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
        >
          <defs>
            {/* Custom arrowheads for each color */}
            {STAGES_DETAILS.map(stage => (
              <marker
                key={`marker-${stage.id}`}
                id={`arrow-${stage.id}`}
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={stage.color} />
              </marker>
            ))}
          </defs>

          {/* Curved connections */}
          {connections.map((conn, i) => {
            const sourceStage = STAGES_DETAILS[i];
            return (
              <path
                key={conn.id}
                d={conn.d}
                fill="none"
                stroke={conn.color}
                strokeWidth="2.5"
                strokeDasharray="4 4"
                className="opacity-70 transition-all duration-300"
                markerEnd={`url(#arrow-${sourceStage.id})`}
              />
            );
          })}
        </svg>

        {/* Center Panel (Aggregate Stats) */}
        <div 
          onClick={() => onSelectStage(null)}
          className={`absolute flex flex-col items-center justify-center w-[130px] h-[130px] rounded-full bg-slate-950 border transition-all duration-300 cursor-pointer shadow-lg z-10 ${
            selectedStage === null 
              ? 'border-primary ring-4 ring-primary/20 scale-105' 
              : 'border-slate-800 hover:border-slate-600'
          }`}
        >
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Pipeline</span>
          <span className="text-xl font-extrabold text-white mt-1">{leads.length}</span>
          <span className="text-[11px] font-semibold text-emerald-400 mt-0.5">{formatCurrency(totalValue)}</span>
        </div>

        {/* Stage Nodes */}
        {nodes.map((node) => {
          const stats = stageStats[node.id] || { count: 0, value: 0 };
          const isActive = selectedStage === node.id;
          const NodeIcon = node.icon;

          // Convert coordinates to percentages for full responsiveness
          const pctX = (node.x / size) * 100;
          const pctY = (node.y / size) * 100;

          return (
            <div
              key={node.id}
              style={{
                position: 'absolute',
                left: `${pctX}%`,
                top: `${pctY}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="flex flex-col items-center z-10"
            >
              {/* The Circle */}
              <button
                onClick={() => onSelectStage(isActive ? null : node.id)}
                className={`relative flex items-center justify-center w-[60px] h-[60px] rounded-full bg-slate-900 border-2 transition-all duration-300 group shadow-md hover:scale-110`}
                style={{
                  borderColor: isActive ? node.color : 'rgba(71, 85, 105, 0.4)',
                  boxShadow: isActive ? `0 0 16px ${node.color}40, inset 0 0 10px ${node.color}20` : 'none',
                }}
              >
                {/* Number Badge */}
                <div
                  className="absolute -top-2 -right-1 flex items-center justify-center w-[22px] h-[22px] rounded-full text-[10px] font-extrabold border shadow-sm"
                  style={{
                    backgroundColor: node.color,
                    color: '#ffffff',
                    borderColor: '#020617',
                  }}
                >
                  {node.number}
                </div>

                {/* Central Icon */}
                <NodeIcon 
                  className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" 
                  style={{ color: node.color }}
                />

                {/* Lead Count Pill */}
                {stats.count > 0 && (
                  <div className="absolute -bottom-2 flex items-center justify-center px-1.5 py-0.5 bg-slate-950 border border-slate-800 rounded-full text-[9px] font-bold text-slate-300">
                    {stats.count}
                  </div>
                )}
              </button>

              {/* Text details below circle */}
              <div className="text-center mt-3 flex flex-col items-center max-w-[110px]">
                <span 
                  onClick={() => onSelectStage(isActive ? null : node.id)}
                  className={`text-[11px] font-bold tracking-tight cursor-pointer hover:underline truncate max-w-[100px] transition-colors ${
                    isActive ? 'text-white' : 'text-slate-300'
                  }`}
                  style={{ color: isActive ? node.color : undefined }}
                >
                  {node.name}
                </span>
                
                {stats.value > 0 && (
                  <span className="text-[10px] text-emerald-400 font-semibold mt-0.5">
                    {formatCurrency(stats.value)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
