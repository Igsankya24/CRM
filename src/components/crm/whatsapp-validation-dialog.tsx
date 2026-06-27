"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";

interface WhatsAppValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditCustomer: () => void;
}

export function WhatsAppValidationDialog({
  open,
  onOpenChange,
  onEditCustomer,
}: WhatsAppValidationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-800 bg-slate-900 text-slate-100 max-w-sm">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 mb-3">
            <AlertCircle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-base font-semibold">
            Mobile Number Missing
          </DialogTitle>
          <DialogDescription className="text-center text-slate-400 text-xs mt-1">
            Customer mobile number is missing.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-center">
          <button
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-md border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onEditCustomer}
            className="flex-1 rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-white hover:bg-amber-500 transition-colors"
          >
            Edit Customer
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
