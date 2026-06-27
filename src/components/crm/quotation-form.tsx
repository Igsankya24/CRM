'use client';

import { useState, useCallback } from 'react';
import { CrmQuotationItem } from '@/types/crm';
import {
  Plus,
  Trash2,
  FileText,
  IndianRupee,
  Send,
  Save,
  X,
  GripVertical,
} from 'lucide-react';

interface QuotationFormProps {
  leadId: string;
  leadName: string;
  onSave: (data: QuotationFormData) => Promise<void>;
  onClose: () => void;
}

export interface QuotationFormData {
  quotation_number: string;
  items: Array<{
    product_name: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
  }>;
  tax_percent: number;
  discount_percent: number;
  currency: string;
  valid_until: string;
  notes: string;
  terms_conditions: string;
}

const EMPTY_ITEM = {
  product_name: '',
  description: '',
  quantity: 1,
  unit: 'pcs',
  unit_price: 0,
};

export function QuotationForm({ leadId, leadName, onSave, onClose }: QuotationFormProps) {
  const [form, setForm] = useState<QuotationFormData>({
    quotation_number: `QT-${Date.now().toString(36).toUpperCase()}`,
    items: [{ ...EMPTY_ITEM }],
    tax_percent: 18, // default GST
    discount_percent: 0,
    currency: 'INR',
    valid_until: '',
    notes: '',
    terms_conditions: 'Payment within 30 days of invoice.\nDelivery as per agreed schedule.',
  });
  const [saving, setSaving] = useState(false);

  // Calculations
  const subtotal = form.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const discountAmount = (subtotal * form.discount_percent) / 100;
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * form.tax_percent) / 100;
  const total = afterDiscount + taxAmount;

  const addItem = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...EMPTY_ITEM }],
    }));
  }, []);

  const removeItem = useCallback((index: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }, []);

  const updateItem = useCallback(
    (index: number, field: keyof typeof EMPTY_ITEM, value: string | number) => {
      setForm((prev) => ({
        ...prev,
        items: prev.items.map((item, i) =>
          i === index ? { ...item, [field]: value } : item,
        ),
      }));
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[90vh] sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10">
              <FileText className="h-4 w-4 text-teal-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create Quotation</h3>
              <p className="text-xs text-slate-400">For {leadName}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Quotation Number */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Quotation Number</label>
                <input
                  type="text"
                  value={form.quotation_number}
                  onChange={(e) => setForm((p) => ({ ...p, quotation_number: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Valid Until</label>
                <input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm((p) => ({ ...p, valid_until: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Items
                </label>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
                >
                  <Plus className="h-3 w-3" />
                  Add Item
                </button>
              </div>

              <div className="space-y-2">
                {form.items.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-slate-800 bg-slate-900/30 p-3"
                  >
                    <div className="mb-2 flex items-start gap-2">
                      <input
                        type="text"
                        placeholder="Product name"
                        value={item.product_name}
                        onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                        className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      />
                      {form.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="rounded p-1 text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      className="mb-2 w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                    />
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="mb-0.5 block text-[10px] text-slate-500">Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                          className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[10px] text-slate-500">Unit</label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateItem(index, 'unit', e.target.value)}
                          className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                        >
                          <option value="pcs">pcs</option>
                          <option value="kg">kg</option>
                          <option value="mt">MT</option>
                          <option value="box">box</option>
                          <option value="set">set</option>
                          <option value="lot">lot</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[10px] text-slate-500">Unit Price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', Number(e.target.value))}
                          className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white focus:border-primary focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[10px] text-slate-500">Total</label>
                        <div className="flex h-[30px] items-center rounded-md border border-slate-700/50 bg-slate-800/50 px-2 text-xs font-semibold text-emerald-400">
                          ₹{(item.quantity * item.unit_price).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tax & Discount */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Tax % (GST)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={form.tax_percent}
                  onChange={(e) => setForm((p) => ({ ...p, tax_percent: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-400">Discount %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={form.discount_percent}
                  onChange={(e) => setForm((p) => ({ ...p, discount_percent: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Summary
              </h4>
              <div className="space-y-1.5 text-sm">
                <SummaryRow label="Subtotal" value={subtotal} />
                {form.discount_percent > 0 && (
                  <SummaryRow label={`Discount (${form.discount_percent}%)`} value={-discountAmount} isNegative />
                )}
                <SummaryRow label={`Tax (${form.tax_percent}%)`} value={taxAmount} />
                <div className="border-t border-slate-700 pt-1.5">
                  <SummaryRow label="Total" value={total} isTotal />
                </div>
              </div>
            </div>

            {/* Notes & Terms */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Additional notes for the customer..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">
                Terms & Conditions
              </label>
              <textarea
                rows={3}
                value={form.terms_conditions}
                onChange={(e) => setForm((p) => ({ ...p, terms_conditions: e.target.value }))}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3">
            <span className="text-sm font-bold text-white">
              Total: <span className="text-emerald-400">₹{total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || form.items.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white shadow-lg shadow-primary/20 hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Quotation'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}

function SummaryRow({
  label,
  value,
  isNegative,
  isTotal,
}: {
  label: string;
  value: number;
  isNegative?: boolean;
  isTotal?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`${isTotal ? 'font-bold text-white' : 'text-slate-400'} text-xs`}>
        {label}
      </span>
      <span
        className={`text-xs font-semibold ${
          isNegative
            ? 'text-red-400'
            : isTotal
              ? 'text-lg text-emerald-400'
              : 'text-slate-200'
        }`}
      >
        {isNegative ? '-' : ''}₹{Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
