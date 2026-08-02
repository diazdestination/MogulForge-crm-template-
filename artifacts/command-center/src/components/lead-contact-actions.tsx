import { useState } from 'react';
import { Mail, Phone, MessageSquareText, Loader2 } from 'lucide-react';
import {
  useCreateLeadActivity,
  useSendLeadEmail,
  getListLeadActivitiesQueryKey,
  useGetMe,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { canWrite } from '@/lib/permissions';

type Channel = 'email' | 'call' | 'text';

const CHANNEL_CONFIG: Record<
  Channel,
  { label: string; title: string; Icon: typeof Mail; href: (target: string) => string }
> = {
  email: { label: 'Email', title: 'Emailed lead', Icon: Mail, href: t => `mailto:${t}` },
  call: { label: 'Call', title: 'Called lead', Icon: Phone, href: t => `tel:${t}` },
  text: { label: 'Text', title: 'Texted lead', Icon: MessageSquareText, href: t => `sms:${t}` },
};

/**
 * One-click Email / Call / Text actions for a lead's contact. Opens the
 * rep's mail/phone app via mailto:/tel:/sms: and logs the outbound contact
 * attempt to the lead's activity timeline (when the user can write).
 */
export function LeadContactActions({
  leadId,
  email,
  phone,
  compact = false,
}: {
  leadId: string;
  email?: string | null;
  phone?: string | null;
  compact?: boolean;
}) {
  const createActivity = useCreateLeadActivity();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const [composeOpen, setComposeOpen] = useState(false);

  if (!email && !phone) return null;

  const logAttempt = (channel: Channel, target: string) => {
    if (!canWrite(me?.role)) return;
    createActivity.mutate(
      {
        id: leadId,
        data: {
          type: 'communication',
          title: CHANNEL_CONFIG[channel].title,
          body: `Outbound ${channel === 'email' ? 'email' : channel === 'call' ? 'call' : 'text'} to ${target}`,
          metadata: { channel, target, source: 'crm-contact-action' },
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLeadActivitiesQueryKey(leadId) });
        },
      },
    );
  };

  const actions: { channel: Channel; target: string }[] = [];
  if (email) actions.push({ channel: 'email', target: email });
  if (phone) actions.push({ channel: 'call', target: phone }, { channel: 'text', target: phone });

  const actionClass = compact
    ? 'inline-flex items-center justify-center w-7 h-7 rounded-md border border-border bg-background text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors'
    : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-xs font-semibold text-foreground hover:text-primary hover:border-primary/50 transition-colors';

  return (
    <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
      {actions.map(({ channel, target }) => {
        const { label, Icon, href } = CHANNEL_CONFIG[channel];
        if (channel === 'email') {
          // Email composes and sends through the company Gmail account
          // in-app (logged server-side) instead of opening a mail client.
          return (
            <button
              key={channel}
              type="button"
              onClick={() => setComposeOpen(true)}
              data-testid="button-lead-email"
              title={`${label} ${target}`}
              aria-label={`${label} ${target}`}
              className={actionClass}
            >
              <Icon className="w-3.5 h-3.5" />
              {!compact && label}
            </button>
          );
        }
        return (
          <a
            key={channel}
            href={href(target)}
            onClick={() => logAttempt(channel, target)}
            data-testid={`button-lead-${channel}`}
            title={`${label} ${target}`}
            className={actionClass}
          >
            <Icon className="w-3.5 h-3.5" />
            {!compact && label}
          </a>
        );
      })}
      {composeOpen && email && (
        <LeadEmailComposeModal
          leadId={leadId}
          to={email}
          onClose={() => setComposeOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * In-CRM email compose modal. Sends through the org's connected Gmail
 * account via the API, which also logs the send on the lead's timeline.
 */
function LeadEmailComposeModal({
  leadId,
  to,
  onClose,
}: {
  leadId: string;
  to: string;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sendEmail = useSendLeadEmail();
  const queryClient = useQueryClient();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim() || sendEmail.isPending) return;
    setError(null);
    sendEmail.mutate(
      { id: leadId, data: { subject: subject.trim(), body: body.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLeadActivitiesQueryKey(leadId) });
          onClose();
        },
        onError: err => {
          const serverMessage =
            err && typeof err === 'object' && 'data' in err
              ? (err as { data?: { error?: string } }).data?.error
              : undefined;
          setError(serverMessage || 'Sending the email failed. Check your connection and try again.');
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.stopPropagation()}
    >
      <div className="bg-card border border-border shadow-xl rounded-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-border flex justify-between items-center bg-muted/30 shrink-0">
          <h2 className="text-lg font-bold">Send Email</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">To</label>
            <div
              className="w-full bg-muted/40 border border-border rounded-md px-3 py-2 text-sm text-muted-foreground"
              data-testid="text-email-to"
            >
              {to}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lead-email-subject" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject *</label>
            <input
              id="lead-email-subject"
              required
              data-testid="input-email-subject"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="lead-email-body" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message *</label>
            <textarea
              id="lead-email-body"
              required
              rows={7}
              data-testid="input-email-body"
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-y"
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert" data-testid="text-email-error">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sendEmail.isPending || !subject.trim() || !body.trim()}
              data-testid="button-email-send"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {sendEmail.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {sendEmail.isPending ? 'Sending…' : 'Send Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
