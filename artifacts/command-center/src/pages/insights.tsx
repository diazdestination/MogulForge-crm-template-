import { useMemo } from 'react';
import { useGetPlaybookInsights, type InsightsFunnelRow } from '@workspace/api-client-react';
import { Loader2, TrendingUp, Brain, Clock, Pin } from 'lucide-react';

/**
 * Conversion Insights — the Closer Engine's learning loop, made visible.
 * Funnel conversion by playbook/step/variant/channel, plus the explainable
 * log of every optimization decision the engine has made and the lift it
 * has achieved over the org's pooled baseline.
 */
export default function Insights() {
  const { data, isLoading } = useGetPlaybookInsights();

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; rows: InsightsFunnelRow[] }>();
    (data?.funnel ?? []).forEach(row => {
      const g = map.get(row.playbookId) ?? { name: row.playbookName, rows: [] };
      g.rows.push(row);
      map.set(row.playbookId, g);
    });
    return [...map.entries()];
  }, [data]);

  const pct = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : '—');

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto">
      <header className="px-4 py-3 md:px-6 md:py-4 border-b border-border bg-card sticky top-0 z-10">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Conversion Insights</h1>
        <p className="hidden md:block text-sm text-muted-foreground">
          How the Closer Engine's outreach is converting — and what it's learning from every touch.
        </p>
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.totalTouches === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-24 px-6 text-center">
          <Brain className="w-10 h-10 text-muted-foreground/50 mb-3" />
          <h2 className="font-semibold text-foreground">No outreach data yet</h2>
          <p className="text-sm text-muted-foreground max-w-md mt-1">
            Once playbook touches start going out, the engine tracks every reply, booking, and
            win back to the message that drove it — and this page fills in.
          </p>
        </div>
      ) : (
        <div className="p-4 md:p-6 space-y-6 max-w-5xl">
          {/* Lift summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Touches sent" value={String(data.totalTouches)} />
            <StatCard label="Baseline reply rate" value={`${(data.baselineReplyRate * 100).toFixed(1)}%`} />
            <StatCard label="Engine-optimized rate" value={`${(data.engineReplyRate * 100).toFixed(1)}%`} />
            <StatCard
              label="Engine lift"
              value={data.liftPercent != null ? `${data.liftPercent >= 0 ? '+' : ''}${data.liftPercent}%` : '—'}
              highlight={data.liftPercent != null && data.liftPercent > 0}
            />
          </div>

          {/* Funnel by playbook/step/variant */}
          {grouped.map(([playbookId, group]) => (
            <section key={playbookId} className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-sm text-foreground">{group.name}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="px-4 py-2 font-semibold">Step</th>
                      <th className="px-2 py-2 font-semibold">Variant</th>
                      <th className="px-2 py-2 font-semibold">Channel</th>
                      <th className="px-2 py-2 font-semibold text-right">Sent</th>
                      <th className="px-2 py-2 font-semibold text-right">Replied</th>
                      <th className="px-2 py-2 font-semibold text-right">Booked</th>
                      <th className="px-2 py-2 font-semibold text-right">Won</th>
                      <th className="px-4 py-2 font-semibold text-right">Reply rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((r, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2 font-medium">Step {r.stepIndex + 1}</td>
                        <td className="px-2 py-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-muted text-xs font-medium">
                            {r.variantKey}
                          </span>
                        </td>
                        <td className="px-2 py-2 capitalize text-muted-foreground">{r.channel}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{r.sent}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{r.replied}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{r.booked}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{r.won}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums">{pct(r.replied, r.sent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          {/* Decision log */}
          <section className="bg-card border border-border rounded-xl shadow-sm">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm text-foreground">Engine decisions</h2>
              <span className="text-xs text-muted-foreground ml-auto">every optimization, explained</span>
            </div>
            {data.decisions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                No optimization decisions yet — the engine explores evenly until each message
                variant has enough sends to compare fairly.
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {data.decisions.map((d, i) => (
                  <li key={i} className="px-4 py-3 flex items-start gap-3">
                    {d.kind === 'send_window'
                      ? <Clock className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                      : <Pin className="w-4 h-4 mt-0.5 text-indigo-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{d.explanation}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(d.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${highlight ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
        {value}
      </div>
    </div>
  );
}
