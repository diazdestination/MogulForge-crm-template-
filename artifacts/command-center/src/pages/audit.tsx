import { useState } from 'react';
import { useListAuditEvents, getListAuditEventsQueryKey, useGetMe, type ListAuditEventsParams } from '@workspace/api-client-react';
import { Loader2, ShieldAlert, Activity, X } from 'lucide-react';
import { format } from 'date-fns';
import { canViewAuditLog } from '@/lib/permissions';
import { Redirect } from 'wouter';

export default function AuditLog() {
  const { data: me, isLoading: meLoading } = useGetMe();
  const [actionInput, setActionInput] = useState('');
  const [sinceInput, setSinceInput] = useState('');
  const action = actionInput.trim();
  const params: ListAuditEventsParams | undefined = action || sinceInput
    ? {
        ...(action ? { action } : {}),
        ...(sinceInput ? { since: new Date(sinceInput).toISOString() } : {}),
      }
    : undefined;
  const { data: events, isLoading: eventsLoading } = useListAuditEvents(params, { query: { enabled: !!me && canViewAuditLog(me.role), queryKey: getListAuditEventsQueryKey(params) } });
  const hasFilters = !!params;

  if (meLoading) return <div className="flex h-full items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!me || !canViewAuditLog(me.role)) return <Redirect to="/" />;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="px-4 py-3 md:px-6 md:py-4 border-b border-border bg-card shrink-0 flex items-center gap-3 md:gap-4 sticky top-0 z-10">
        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20 shadow-sm shrink-0">
          <ShieldAlert className="w-5 h-5 md:w-6 md:h-6" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Audit Log</h1>
          <p className="hidden md:block text-sm text-muted-foreground">Immutable record of system changes.</p>
        </div>
      </header>

      <div className="px-4 py-3 md:px-6 border-b border-border bg-card/50 shrink-0 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-filter-action" className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Action</label>
          <input
            id="audit-filter-action"
            type="text"
            value={actionInput}
            onChange={e => setActionInput(e.target.value)}
            placeholder="e.g. api_key.created"
            className="h-9 w-56 rounded-lg border border-border bg-background px-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-filter-since" className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Since</label>
          <input
            id="audit-filter-since"
            type="date"
            value={sinceInput}
            onChange={e => setSinceInput(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setActionInput(''); setSinceInput(''); }}
            className="h-9 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear filters
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
        {eventsLoading ? (
          <div className="flex items-center justify-center py-12 h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Mobile View: Card List */}
            <div className="md:hidden space-y-3">
              {events?.map(event => (
                <div key={event.id} className="bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden">
                   <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive/50" />
                   <div className="flex justify-between items-start mb-3">
                     <div className="font-bold text-primary font-mono text-sm tracking-tight">{event.action}</div>
                     <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                        {format(new Date(event.createdAt), 'MMM d, HH:mm')}
                     </div>
                   </div>
                   
                   <div className="grid grid-cols-2 gap-3 mb-3 text-xs bg-muted/20 p-3 rounded-lg border border-border/50">
                      <div>
                        <span className="block text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">Actor ID</span>
                        <span className="font-mono text-foreground font-medium">{event.actorUserId ? event.actorUserId.substring(0,8) : 'SYSTEM'}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase tracking-widest text-muted-foreground mb-0.5">Entity</span>
                        <span className="font-medium text-foreground">{event.entityType}</span>
                        {event.entityId && <span className="block font-mono text-muted-foreground mt-0.5">{event.entityId.substring(0,8)}</span>}
                      </div>
                   </div>
                   
                   <div className="bg-background border border-border/50 rounded-lg p-2.5 overflow-x-auto">
                     <span className="block text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Metadata Payload</span>
                     <code className="text-[10px] text-muted-foreground whitespace-pre-wrap break-all leading-tight">
                       {JSON.stringify(event.metadata)}
                     </code>
                   </div>
                </div>
              ))}
              {!events?.length && (
                 <div className="py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-2xl bg-muted/10 flex flex-col items-center justify-center gap-2">
                   <Activity className="w-6 h-6 opacity-20" />
                   <span className="font-medium text-sm">{hasFilters ? 'No audit events match the current filters.' : 'No audit events recorded.'}</span>
                 </div>
              )}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-[10px] text-muted-foreground uppercase tracking-widest bg-muted/30 border-b border-border font-bold">
                  <tr>
                    <th className="px-6 py-4">Timestamp</th>
                    <th className="px-6 py-4">Actor ID</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Entity</th>
                    <th className="px-6 py-4">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono text-xs">
                  {events?.map(event => (
                    <tr key={event.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 text-muted-foreground font-medium">
                        {format(new Date(event.createdAt), 'yyyy-MM-dd HH:mm:ss')}
                      </td>
                      <td className="px-6 py-4 text-foreground font-bold">
                        {event.actorUserId ? event.actorUserId.substring(0,8) : <span className="text-secondary">SYSTEM</span>}
                      </td>
                      <td className="px-6 py-4 font-bold text-primary bg-primary/5">
                        {event.action}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-muted-foreground font-bold font-sans uppercase tracking-widest text-[10px]">{event.entityType}</span>
                        {event.entityId && <span className="ml-2 bg-background border border-border px-2 py-0.5 rounded-md text-[10px] shadow-sm">{event.entityId.substring(0,8)}</span>}
                      </td>
                      <td className="px-6 py-4">
                        <div className="truncate max-w-sm text-muted-foreground bg-muted/20 px-2 py-1 rounded-md border border-border/50" title={JSON.stringify(event.metadata)}>
                          {JSON.stringify(event.metadata)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!events?.length && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground font-sans text-sm font-medium">
                        {hasFilters ? 'No audit events match the current filters.' : 'No audit events recorded.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
