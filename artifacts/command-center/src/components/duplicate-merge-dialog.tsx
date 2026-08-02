import { useState } from 'react';
import {
  useGetLead,
  getGetLeadQueryKey,
  useGetContact,
  getGetContactQueryKey,
  useMergeLead,
  getListLeadsQueryKey,
  getListDuplicateLeadsQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export interface DuplicateMatchInfo {
  field: string;
  value: string;
}

/**
 * Side-by-side comparison of a duplicate group, letting the user pick the
 * surviving lead and merge the rest into it — without leaving the pipeline.
 */
export function DuplicateMergeDialog({
  leadIds,
  matches,
  open,
  onClose,
}: {
  leadIds: string[];
  matches: DuplicateMatchInfo[];
  open: boolean;
  onClose: () => void;
}) {
  const [survivorId, setSurvivorId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [merging, setMerging] = useState(false);
  const queryClient = useQueryClient();
  const mergeLead = useMergeLead();
  const { toast } = useToast();

  const reset = () => {
    setSurvivorId(null);
    setConfirming(false);
    setMerging(false);
  };

  const handleClose = () => {
    if (merging) return;
    reset();
    onClose();
  };

  const handleMerge = async () => {
    if (!survivorId) return;
    const sources = leadIds.filter(id => id !== survivorId);
    setMerging(true);
    let mergedCount = 0;
    try {
      for (const sourceLeadId of sources) {
        await mergeLead.mutateAsync({ id: survivorId, data: { sourceLeadId } });
        mergedCount++;
      }
      toast({
        title: 'Leads merged',
        description: `${mergedCount} duplicate${mergedCount === 1 ? '' : 's'} merged into the surviving lead.`,
      });
      reset();
      onClose();
    } catch {
      toast({
        title: 'Merge failed',
        description: mergedCount > 0
          ? `${mergedCount} of ${sources.length} duplicates merged before the failure. Refresh and try again.`
          : 'The merge could not be completed. Refresh and try again.',
        variant: 'destructive',
      });
      setMerging(false);
      setConfirming(false);
    } finally {
      queryClient.invalidateQueries({ queryKey: getListLeadsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListDuplicateLeadsQueryKey() });
      leadIds.forEach(id => queryClient.invalidateQueries({ queryKey: getGetLeadQueryKey(id) }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-amber-500" /> Resolve duplicate leads
          </DialogTitle>
          <DialogDescription>
            {matches.length > 0 && (
              <span>
                {matches.map((m, i) => (
                  <span key={i}>
                    {i > 0 && '; '}
                    <span className="capitalize">{m.field}</span> matches{' '}
                    <span className="font-mono">{m.value}</span>
                  </span>
                ))}
                .{' '}
              </span>
            )}
            Compare the leads and pick the one to keep. The others' activities and tags move to it, and they are marked lost.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 max-h-[50vh] overflow-y-auto pr-1" style={{ gridTemplateColumns: `repeat(${Math.min(leadIds.length, 3)}, minmax(0, 1fr))` }}>
          {leadIds.map(id => (
            <LeadComparisonCard
              key={id}
              leadId={id}
              selected={survivorId === id}
              disabled={merging}
              onSelect={() => { setSurvivorId(id); setConfirming(false); }}
            />
          ))}
        </div>

        <div className="pt-2 border-t border-border">
          {!confirming ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {survivorId
                  ? 'The selected lead survives; the rest merge into it.'
                  : 'Select the lead to keep.'}
              </p>
              <button
                type="button"
                disabled={!survivorId}
                onClick={() => setConfirming(true)}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
              >
                Merge duplicates…
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-foreground">
                Merge {leadIds.length - 1} lead{leadIds.length - 1 === 1 ? '' : 's'} into{' '}
                <span className="font-mono font-semibold">{survivorId?.substring(0, 8)}</span>? This can't be undone.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={merging}
                  onClick={handleMerge}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {merging && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm merge
                </button>
                <button
                  type="button"
                  disabled={merging}
                  onClick={() => setConfirming(false)}
                  className="border border-border px-4 py-2 rounded-md text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LeadComparisonCard({
  leadId,
  selected,
  disabled,
  onSelect,
}: {
  leadId: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { data: lead, isLoading } = useGetLead(leadId, {
    query: { enabled: !!leadId, queryKey: getGetLeadQueryKey(leadId) },
  });
  const { data: contact } = useGetContact(lead?.contactId!, {
    query: { enabled: !!lead?.contactId, queryKey: getGetContactQueryKey(lead?.contactId!) },
  });

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={`text-left border rounded-lg p-3 transition-colors ${
        selected
          ? 'border-primary ring-2 ring-primary/40 bg-primary/5'
          : 'border-border hover:border-primary/50 bg-card'
      } disabled:opacity-60`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-muted-foreground">{leadId.substring(0, 8)}</span>
        {selected && (
          <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            <Check className="w-3 h-3" /> Keep
          </span>
        )}
      </div>
      {isLoading || !lead ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-1.5 text-xs">
          <div className="font-medium text-sm text-foreground line-clamp-2">{lead.summary || 'Untitled Lead'}</div>
          <Row label="Status" value={lead.status.replace(/_/g, ' ')} capitalize />
          <Row label="Score" value={lead.score > 0 ? String(lead.score) : '—'} />
          <Row label="Urgency" value={lead.urgency} capitalize />
          <Row label="Value" value={lead.estimatedValueCents ? `$${(lead.estimatedValueCents / 100).toLocaleString()}` : '—'} />
          <Row label="Source" value={lead.source || '—'} capitalize />
          <Row label="Contact" value={contact ? `${contact.firstName} ${contact.lastName}`.trim() : '—'} />
          <Row label="Phone" value={contact?.phone || '—'} mono />
          <Row label="Email" value={contact?.email || '—'} />
          <Row label="Created" value={format(new Date(lead.createdAt), 'MMM d, yyyy')} />
        </div>
      )}
    </button>
  );
}

function Row({ label, value, capitalize, mono }: { label: string; value: string; capitalize?: boolean; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-foreground text-right truncate ${capitalize ? 'capitalize' : ''} ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
