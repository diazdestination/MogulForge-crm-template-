import { useEffect, useRef, useState } from 'react';
import {
  useGetMe,
  useGetSettings,
  useUpdateSettings,
  getGetSettingsQueryKey,
  useListTemplates,
  useCreateTemplate,
  useDeleteTemplate,
  useUpdateTemplate,
  getListTemplatesQueryKey,
  useListAutomations,
  useCreateAutomation,
  useUpdateAutomation,
  useDeleteAutomation,
  getListAutomationsQueryKey,
  useListAutomationRuns,
  useGetEmailProviderStatus,
  useGetSmsProviderStatus,
  useListWebhooks,
  useCreateWebhook,
  useDeleteWebhook,
  useRotateWebhookSecret,
  useExpireWebhookPreviousSecret,
  getListWebhooksQueryKey,
  useListTags,
  useCreateTag,
  getListTagsQueryKey,
  useListUsers,
  useInviteUser,
  useResendInvite,
  useUpdateUser,
  getListUsersQueryKey,
  useListApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
  useUpdateApiKey,
  getListApiKeysQueryKey,
  useListAuditEvents,
  type AuditEvent,
  type BusinessProfile,
  type ServiceEntry,
  type ServiceAreaEntry,
  type LeadScoringSettings,
  type InspectionAvailabilitySettings,
  type AppointmentReminderSettings,
  type UserRole,
  expireWebhookPreviousSecret as expireWebhookPreviousSecretRequest,
  updateUser as updateUserRequest,
  resendInvite as resendInviteRequest,
  ApiError,
  type UpdateUserInput,
  type GoogleReviewsConfig,
} from '@workspace/api-client-react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Redirect } from 'wouter';
import { Loader2, Settings2, Trash2, Copy, Zap, RefreshCw, Pencil, ShieldAlert } from 'lucide-react';
import { canManageSettings } from '@/lib/permissions';
import { toLocalDateInputValue } from '@/lib/date-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast, toast as globalToast } from '@/hooks/use-toast';
import { previewTemplate, KNOWN_PLACEHOLDERS } from '@/lib/template-preview';
import { ToastAction } from '@/components/ui/toast';

const AUTOMATION_EVENTS = [
  'lead.created',
  'lead.updated',
  'lead.assigned',
  'appointment.booked',
  'estimate.sent',
  'lead.inactive',
  'review.request_due',
  'assessment.abandoned',
  'portal.photos_added',
];

const ACTION_TYPES = [
  'send_email',
  'send_sms',
  'create_task',
  'assign_lead',
  'change_stage',
  'call_webhook',
  'add_tag',
  'schedule_followup',
];

const ASSIGNABLE_ROLES: UserRole[] = [
  'admin',
  'sales_manager',
  'sales_rep',
  'inspector',
  'production',
  'office',
  'viewer',
];
function BusinessProfileTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const update = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: 'Business profile saved' });
      },
      onError: () => toast({ title: 'Could not save settings', variant: 'destructive' }),
    },
  });
  const [profile, setProfile] = useState<BusinessProfile>({});

  useEffect(() => {
    if (settings?.businessProfile) setProfile(settings.businessProfile);
  }, [settings]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const set = (key: keyof BusinessProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfile((p) => ({ ...p, [key]: e.target.value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business profile</CardTitle>
        <CardDescription>
          Used across the website, message templates ({'{{business.name}}'}, {'{{business.phone}}'}) and structured data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Business name</Label>
            <Input value={profile.businessName ?? ''} onChange={set('businessName')} placeholder="Painless Roofing & Water Restoration" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={profile.phone ?? ''} onChange={set('phone')} placeholder="(404) 444-4476" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={profile.email ?? ''} onChange={set('email')} />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={profile.addressLine1 ?? ''} onChange={set('addressLine1')} />
          </div>
          <div className="space-y-1.5">
            <Label>City</Label>
            <Input value={profile.city ?? ''} onChange={set('city')} placeholder="Canton" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input value={profile.state ?? ''} onChange={set('state')} placeholder="GA" />
            </div>
            <div className="space-y-1.5">
              <Label>ZIP</Label>
              <Input value={profile.postalCode ?? ''} onChange={set('postalCode')} placeholder="30115" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Hours</Label>
            <Input value={profile.hours ?? ''} onChange={set('hours')} placeholder="24/7" />
          </div>
          <div className="space-y-1.5">
            <Label>Website URL</Label>
            <Input value={profile.website ?? ''} onChange={set('website')} placeholder="https://painlessroofing.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Facebook URL</Label>
            <Input value={profile.facebookUrl ?? ''} onChange={set('facebookUrl')} />
          </div>
          <div className="space-y-1.5">
            <Label>Google Business URL</Label>
            <Input value={profile.googleBusinessUrl ?? ''} onChange={set('googleBusinessUrl')} />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch
              aria-label="24/7 emergency availability"
              checked={profile.emergencyAvailability ?? false}
              onCheckedChange={(v) => setProfile((p) => ({ ...p, emergencyAvailability: v }))}
            />
            <Label>24/7 emergency availability</Label>
          </div>
        </div>
        <Button
          onClick={() => update.mutate({ data: { businessProfile: profile } })}
          disabled={update.isPending}
        >
          {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save profile
        </Button>
      </CardContent>
    </Card>
  );
}

function FallbackInboxTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const update = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: 'Fallback inbox saved' });
      },
      onError: () => toast({ title: 'Could not save settings', variant: 'destructive' }),
    },
  });
  const [inbox, setInbox] = useState('');

  useEffect(() => {
    setInbox(settings?.fallbackNotificationInbox ?? '');
  }, [settings]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unassigned lead inbox</CardTitle>
        <CardDescription>
          When a homeowner posts a portal message on a lead with no usable assigned rep,
          the notification goes here instead of every admin. Leave blank to keep the current
          behavior (all active admins and owners are emailed).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fallback-inbox">Fallback notification inbox</Label>
          <Input
            id="fallback-inbox"
            type="email"
            value={inbox}
            onChange={(e) => setInbox(e.target.value)}
            placeholder="dispatch@yourcompany.com"
          />
        </div>
        <Button
          onClick={() =>
            update.mutate({
              data: { fallbackNotificationInbox: inbox.trim() || null },
            })
          }
          disabled={update.isPending}
        >
          {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save inbox
        </Button>
      </CardContent>
    </Card>
  );
}
function TemplatePreviewBlock({ subject, body, testId }: { subject?: string; body: string; testId: string }) {
  if (!body && !subject) return null;
  const subjectPreview = subject ? previewTemplate(subject) : null;
  const bodyPreview = previewTemplate(body);
  const unknown = [
    ...(subjectPreview?.unknownPlaceholders ?? []),
    ...bodyPreview.unknownPlaceholders.filter(
      (k) => !(subjectPreview?.unknownPlaceholders ?? []).includes(k),
    ),
  ];
  return (
    <div className="rounded-md border bg-muted/50 px-4 py-3 space-y-2" data-testid={testId}>
      <div className="text-xs font-medium text-muted-foreground uppercase">Preview with sample data</div>
      {subjectPreview && subject && (
        <div className="text-sm">
          <span className="font-medium">Subject: </span>
          {subjectPreview.rendered}
        </div>
      )}
      {body && <div className="text-sm whitespace-pre-wrap">{bodyPreview.rendered}</div>}
      {unknown.length > 0 && (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          data-testid={`${testId}-unknown-warning`}
        >
          <span className="font-medium">
            Unknown {unknown.length === 1 ? 'placeholder' : 'placeholders'}:{' '}
          </span>
          {unknown.map((k) => `{{${k}}}`).join(', ')} — {unknown.length === 1 ? 'it' : 'they'} will
          render as empty text in real messages. Available placeholders:{' '}
          {KNOWN_PLACEHOLDERS.map((k) => `{{${k}}}`).join(', ')}.
        </div>
      )}
    </div>
  );
}

function TemplatesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: templates, isLoading } = useListTemplates();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() });
  const create = useCreateTemplate({
    mutation: { onSuccess: () => { void invalidate(); toast({ title: 'Template created' }); } },
  });
  const remove = useDeleteTemplate({
    mutation: { onSuccess: () => { void invalidate(); toast({ title: 'Template deactivated' }); } },
  });
  const update = useUpdateTemplate({
    mutation: { onSuccess: () => { void invalidate(); toast({ title: 'Template updated' }); } },
  });
  const [draft, setDraft] = useState({ name: '', channel: 'email' as 'email' | 'sms', subject: '', body: '' });
  const [editing, setEditing] = useState<{ id: string; name: string; subject: string; body: string } | null>(null);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>New template</CardTitle>
          <CardDescription>
            Placeholders: {'{{contact.firstName}}'}, {'{{business.name}}'}, {'{{business.phone}}'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={draft.channel} onValueChange={(v) => setDraft({ ...draft, channel: v as 'email' | 'sms' })}>
                <SelectTrigger aria-label="Channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.channel === 'email' && (
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea rows={4} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </div>
          <TemplatePreviewBlock
            subject={draft.channel === 'email' ? draft.subject : undefined}
            body={draft.body}
            testId="preview-template-create"
          />
          <Button
            disabled={!draft.name || !draft.body || create.isPending}
            onClick={() =>
              create.mutate(
                { data: { name: draft.name, channel: draft.channel, subject: draft.subject || undefined, body: draft.body } },
                { onSuccess: () => setDraft({ name: '', channel: 'email', subject: '', body: '' }) },
              )
            }
          >
            Create template
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-3">
          {templates?.map((t) => (
            <Card key={t.id} className={!t.isActive ? 'opacity-50' : ''}>
              {editing?.id === t.id ? (
                <CardContent className="space-y-3 py-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Name</Label>
                      <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                    </div>
                    {t.channel === 'email' && (
                      <div className="space-y-1.5">
                        <Label>Subject</Label>
                        <Input value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Body</Label>
                    <Textarea rows={4} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
                  </div>
                  <TemplatePreviewBlock
                    subject={t.channel === 'email' ? editing.subject : undefined}
                    body={editing.body}
                    testId="preview-template-edit"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!editing.name || !editing.body || update.isPending}
                      onClick={() =>
                        update.mutate(
                          { id: t.id, data: { name: editing.name, subject: editing.subject || undefined, body: editing.body } },
                          { onSuccess: () => setEditing(null) },
                        )
                      }
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="flex items-start justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{t.name}</span>
                      <Badge variant="secondary" className="uppercase text-[10px]">{t.channel}</Badge>
                      {!t.isActive && <Badge variant="outline">inactive</Badge>}
                    </div>
                    {t.subject && <div className="text-xs text-muted-foreground">Subject: {t.subject}</div>}
                    <div className="text-xs text-muted-foreground truncate max-w-xl">{t.body}</div>
                  </div>
                  {t.isActive && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditing({ id: t.id, name: t.name, subject: t.subject ?? '', body: t.body })}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate({ id: t.id })}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
          {!templates?.length && <p className="text-sm text-muted-foreground text-center py-6">No templates yet.</p>}
        </div>
      )}
    </div>
  );
}

function AutomationsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: automations, isLoading } = useListAutomations();
  const { data: runs } = useListAutomationRuns();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListAutomationsQueryKey() });
  const create = useCreateAutomation({
    mutation: { onSuccess: () => { void invalidate(); toast({ title: 'Automation created' }); } },
  });
  const update = useUpdateAutomation({ mutation: { onSuccess: () => void invalidate() } });
  const remove = useDeleteAutomation({
    mutation: { onSuccess: () => { void invalidate(); toast({ title: 'Automation deactivated' }); } },
  });
  const [draft, setDraft] = useState({ name: '', event: 'lead.created', actionType: 'send_email', templateBody: '' });
  const { data: emailProvider } = useGetEmailProviderStatus();
  const { data: smsProvider } = useGetSmsProviderStatus();

  return (
    <div className="space-y-6">
      {emailProvider && (emailProvider.recentSendFailures ?? 0) > 0 && (
        <div
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          data-testid="banner-email-send-failures"
        >
          <p className="font-medium">
            Automation emails are failing to send
            {emailProvider.provider === 'gmail' && ' through Gmail'}
            {emailProvider.provider === 'resend' && ' through Resend'}
            {emailProvider.provider === 'mock' && ' (no provider connected)'}
            .
          </p>
          <p className="mt-1">
            The last {emailProvider.recentSendFailures === 1 ? 'email send attempt' : `${emailProvider.recentSendFailures} email send attempts`} failed
            {emailProvider.lastSendFailureDetail ? <>: <span className="font-mono text-xs">{emailProvider.lastSendFailureDetail}</span></> : ''}
            {'. '}
            {emailProvider.provider === 'gmail'
              ? 'The Gmail connection may have expired — reconnect Gmail from the Replit Connectors panel to resume sending.'
              : 'Check the email provider configuration to resume sending.'}
          </p>
        </div>
      )}
      {emailProvider && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            emailProvider.provider === 'mock'
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-border bg-muted/50 text-muted-foreground'
          }`}
          data-testid="text-email-provider-note"
        >
          {emailProvider.provider === 'gmail' && (
            <>
              Automation emails are sent through Gmail
              {emailProvider.senderEmail ? (
                <> from <span className="font-medium text-foreground">{emailProvider.senderEmail}</span></>
              ) : (
                ' (connected account)'
              )}
              .
            </>
          )}
          {emailProvider.provider === 'resend' && (
            <>Automation emails are sent via Resend from {emailProvider.senderEmail ?? 'the configured address'}.</>
          )}
          {emailProvider.provider === 'mock' && (
            <>No real email provider is connected — automation emails are only logged, not delivered. Connect Gmail to send real email.</>
          )}
        </div>
      )}
      {smsProvider && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            smsProvider.provider === 'mock'
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-border bg-muted/50 text-muted-foreground'
          }`}
          data-testid="text-sms-provider-note"
        >
          {smsProvider.provider === 'twilio' && (
            <>
              Automation texts are sent through Twilio
              {smsProvider.senderPhoneNumber ? (
                <> from <span className="font-medium text-foreground">{smsProvider.senderPhoneNumber}</span></>
              ) : (
                ''
              )}
              .
            </>
          )}
          {smsProvider.provider === 'mock' && (
            <>No real SMS provider is connected — automation texts are only logged, not delivered. Set the Twilio credentials to send real texts.</>
          )}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>New automation</CardTitle>
          <CardDescription>When an event happens, run an action. SMS actions are always consent-gated.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Instant lead reply" />
            </div>
            <div className="space-y-1.5">
              <Label>Trigger event</Label>
              <Select value={draft.event} onValueChange={(v) => setDraft({ ...draft, event: v })}>
                <SelectTrigger aria-label="Trigger event"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AUTOMATION_EVENTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Action</Label>
              <Select value={draft.actionType} onValueChange={(v) => setDraft({ ...draft, actionType: v })}>
                <SelectTrigger aria-label="Action type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(draft.actionType === 'send_email' || draft.actionType === 'send_sms' || draft.actionType === 'create_task') && (
            <div className="space-y-1.5">
              <Label>{draft.actionType === 'create_task' ? 'Task title' : 'Message body'}</Label>
              <Textarea
                rows={3}
                value={draft.templateBody}
                onChange={(e) => setDraft({ ...draft, templateBody: e.target.value })}
                placeholder="Hi {{contact.firstName}}, thanks for reaching out to {{business.name}}!"
              />
            </div>
          )}
          {(draft.actionType === 'send_email' || draft.actionType === 'send_sms') && (
            <TemplatePreviewBlock
              body={draft.templateBody}
              testId="preview-automation-create"
            />
          )}
          <Button
            disabled={!draft.name || create.isPending}
            onClick={() =>
              create.mutate(
                {
                  data: {
                    name: draft.name,
                    event: draft.event,
                    actions: [
                      {
                        type: draft.actionType as 'send_email',
                        params:
                          draft.actionType === 'create_task'
                            ? { title: draft.templateBody || 'Follow up' }
                            : { body: draft.templateBody },
                      },
                    ],
                  },
                },
                { onSuccess: () => setDraft({ name: '', event: 'lead.created', actionType: 'send_email', templateBody: '' }) },
              )
            }
          >
            <Zap className="w-4 h-4 mr-2" /> Create automation
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-3">
          {automations?.map((a) => (
            <Card key={a.id} className={!a.isActive ? 'opacity-50' : ''}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{a.name}</span>
                    <Badge variant="secondary" className="font-mono text-[10px]">{a.event}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {a.actions.map((act) => act.type).join(', ') || 'no actions'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={a.isActive}
                    onCheckedChange={(v) => update.mutate({ id: a.id, data: { isActive: v } })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate({ id: a.id })}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!automations?.length && <p className="text-sm text-muted-foreground text-center py-6">No automations yet.</p>}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border text-xs font-mono">
            {runs?.slice(0, 20).map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                <span className="text-primary font-semibold">{r.event}</span>
                <Badge variant={r.status === 'success' ? 'secondary' : r.status === 'failed' ? 'destructive' : 'outline'}>
                  {r.status}
                </Badge>
              </div>
            ))}
            {!runs?.length && <p className="text-sm text-muted-foreground font-sans text-center py-4">No runs yet.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WebhooksTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: webhooks, isLoading } = useListWebhooks();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListWebhooksQueryKey() });
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const create = useCreateWebhook({
    mutation: {
      onSuccess: (created) => {
        void invalidate();
        setNewSecret(created.secret);
        toast({ title: 'Webhook created — copy the signing secret now' });
      },
    },
  });
  const remove = useDeleteWebhook({
    mutation: { onSuccess: () => { void invalidate(); toast({ title: 'Webhook deactivated' }); } },
  });
  const [rotatedSecret, setRotatedSecret] = useState<{ id: string; secret: string } | null>(null);
  const rotate = useRotateWebhookSecret({
    mutation: {
      onSuccess: (rotated) => {
        void invalidate();
        setRotatedSecret({ id: rotated.id, secret: rotated.secret });
        toast({ title: 'Secret rotated — copy the new signing secret now' });
      },
      onError: () => toast({ title: 'Could not rotate secret', variant: 'destructive' }),
    },
  });
  const expirePrevious = useExpireWebhookPreviousSecret({
    mutation: {
      onSuccess: () => { void invalidate(); toast({ title: 'Old secret revoked — only the new secret is accepted now' }); },
      onError: (_e, vars) => showExpirePreviousSecretFailedToast(vars.id, queryClient),
    },
  });
  const [url, setUrl] = useState('');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>New webhook endpoint</CardTitle>
          <CardDescription>
            Deliveries are POSTed with a signature header <code>x-painless-signature: t=&lt;timestamp&gt;,v1=&lt;hmac&gt;</code> — an HMAC-SHA256 of <code>{'"{timestamp}.{body}"'}</code> using your endpoint secret. Verify it and reject timestamps older than 5 minutes. Retries: 1m, then 5m.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/hooks/painless" />
            <Button
              disabled={!url.startsWith('http') || create.isPending}
              onClick={() => create.mutate({ data: { url } }, { onSuccess: () => setUrl('') })}
            >
              Add
            </Button>
          </div>
          {newSecret && (
            <div className="flex items-center gap-2 bg-muted rounded-md p-3 text-xs font-mono">
              <span className="truncate">{newSecret}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  void navigator.clipboard.writeText(newSecret);
                  toast({ title: 'Secret copied' });
                }}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-3">
          {webhooks?.map((w) => (
            <Card key={w.id} className={!w.isActive ? 'opacity-50' : ''}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <div className="font-mono text-xs truncate">{w.url}</div>
                  <div className="text-xs text-muted-foreground">
                    {w.events.length ? w.events.join(', ') : 'all events'}
                  </div>
                  {w.previousSecretExpiresAt && new Date(w.previousSecretExpiresAt).getTime() > Date.now() && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 dark:text-amber-400">
                        Rotation in progress — old secret valid until {new Date(w.previousSecretExpiresAt).toLocaleString()}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        disabled={expirePrevious.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Revoke the old secret now? Deliveries signed only with the old secret will start failing immediately.',
                            )
                          ) {
                            expirePrevious.mutate({ id: w.id });
                          }
                        }}
                      >
                        Revoke old secret now
                      </Button>
                    </div>
                  )}
                </div>
                {w.isActive && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={rotate.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Rotate the signing secret? The old secret keeps working for 24 hours so your receiver can switch without missing deliveries. The new secret is shown only once.',
                          )
                        ) {
                          setRotatedSecret(null);
                          rotate.mutate({ id: w.id, data: { gracePeriodHours: 24 } });
                        }
                      }}
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Rotate secret
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate({ id: w.id })}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardContent>
              {rotatedSecret?.id === w.id && (
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 bg-muted rounded-md p-3 text-xs font-mono">
                    <span className="text-muted-foreground font-sans shrink-0">New secret (shown once):</span>
                    <span className="truncate">{rotatedSecret.secret}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        void navigator.clipboard.writeText(rotatedSecret.secret);
                        toast({ title: 'Secret copied' });
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
          {!webhooks?.length && <p className="text-sm text-muted-foreground text-center py-6">No webhooks configured.</p>}
        </div>
      )}
    </div>
  );
}

function TagsTab() {
  const queryClient = useQueryClient();
  const { data: tags } = useListTags();
  const create = useCreateTag({
    mutation: {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: getListTagsQueryKey() }),
    },
  });
  const [name, setName] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead tags</CardTitle>
        <CardDescription>Tags can be applied manually or by automations.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="storm-damage" />
          <Button
            disabled={!name.trim() || create.isPending}
            onClick={() => create.mutate({ data: { name: name.trim() } }, { onSuccess: () => setName('') })}
          >
            Add tag
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags?.map((t) => (
            <Badge key={t.id} variant="secondary">{t.name}</Badge>
          ))}
          {!tags?.length && <p className="text-sm text-muted-foreground">No tags yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  const { data: me, isLoading } = useGetMe();

  if (isLoading) {
    return <div className="flex h-full items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!me || !canManageSettings(me.role)) return <Redirect to="/" />;

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="px-6 py-4 border-b border-border bg-card shrink-0 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Settings2 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Settings</h1>
          <p className="text-sm text-muted-foreground">Business profile, automations, templates & integrations.</p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-6 max-w-4xl w-full">
        <Tabs defaultValue="business">
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="services">Services & Areas</TabsTrigger>
            <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
            <TabsTrigger value="scoring">Lead Scoring</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="automations">Automations</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="apikeys">API Keys</TabsTrigger>
            <TabsTrigger value="tags">Tags</TabsTrigger>
            <TabsTrigger value="reviews">Google Reviews</TabsTrigger>
          </TabsList>
          <TabsContent value="business" className="space-y-6"><BusinessProfileTab /><FallbackInboxTab /></TabsContent>
          <TabsContent value="team"><TeamTab meId={me.id} meRole={me.role} /></TabsContent>
          <TabsContent value="services"><ServicesTab /></TabsContent>
          <TabsContent value="scheduling" className="space-y-6"><SchedulingTab /><ReminderTab /></TabsContent>
          <TabsContent value="scoring"><ScoringTab /></TabsContent>
          <TabsContent value="ai"><AiTab /></TabsContent>
          <TabsContent value="automations"><AutomationsTab /></TabsContent>
          <TabsContent value="templates"><TemplatesTab /></TabsContent>
          <TabsContent value="webhooks"><WebhooksTab /></TabsContent>
          <TabsContent value="apikeys"><ApiKeysTab /></TabsContent>
          <TabsContent value="tags"><TagsTab /></TabsContent>
          <TabsContent value="reviews"><GoogleReviewsTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

const API_KEY_ROLES: UserRole[] = ['sales_manager', 'sales_rep', 'office', 'viewer'];

function ServicesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const update = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: 'Saved' });
      },
      onError: () => toast({ title: 'Could not save', variant: 'destructive' }),
    },
  });
  const [services, setServices] = useState<ServiceEntry[]>([]);
  const [areas, setAreas] = useState<ServiceAreaEntry[]>([]);
  const [newService, setNewService] = useState('');
  const [newArea, setNewArea] = useState({ name: '', state: 'GA' });

  useEffect(() => {
    if (settings) {
      setServices(settings.services);
      setAreas(settings.serviceAreas);
    }
  }, [settings]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Services offered</CardTitle>
          <CardDescription>The service list the website and CRM use. Toggle off to hide without deleting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {services.map((s, i) => (
            <div key={s.slug} className="flex items-center gap-3">
              <Switch
                checked={s.isActive}
                onCheckedChange={(v) => setServices(services.map((x, j) => (j === i ? { ...x, isActive: v } : x)))}
              />
              <Input
                value={s.name}
                onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <Button variant="ghost" size="icon" onClick={() => setServices(services.filter((_, j) => j !== i))}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <Input placeholder="New service name" value={newService} onChange={(e) => setNewService(e.target.value)} />
            <Button
              variant="secondary"
              disabled={!newService.trim() || services.some((s) => s.slug === slugify(newService))}
              onClick={() => {
                setServices([...services, { slug: slugify(newService), name: newService.trim(), isActive: true }]);
                setNewService('');
              }}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service areas</CardTitle>
          <CardDescription>Cities and towns you serve.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {areas.map((a, i) => (
            <div key={a.slug} className="flex items-center gap-3">
              <Switch
                checked={a.isActive}
                onCheckedChange={(v) => setAreas(areas.map((x, j) => (j === i ? { ...x, isActive: v } : x)))}
              />
              <Input
                value={a.name}
                onChange={(e) => setAreas(areas.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <Input
                className="w-20"
                value={a.state ?? ''}
                onChange={(e) => setAreas(areas.map((x, j) => (j === i ? { ...x, state: e.target.value } : x)))}
              />
              <Button variant="ghost" size="icon" onClick={() => setAreas(areas.filter((_, j) => j !== i))}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <Input placeholder="New city" value={newArea.name} onChange={(e) => setNewArea({ ...newArea, name: e.target.value })} />
            <Input className="w-20" placeholder="GA" value={newArea.state} onChange={(e) => setNewArea({ ...newArea, state: e.target.value })} />
            <Button
              variant="secondary"
              disabled={!newArea.name.trim() || areas.some((a) => a.slug === slugify(`${newArea.name}-${newArea.state}`))}
              onClick={() => {
                setAreas([
                  ...areas,
                  { slug: slugify(`${newArea.name}-${newArea.state}`), name: newArea.name.trim(), state: newArea.state, isActive: true },
                ]);
                setNewArea({ name: '', state: 'GA' });
              }}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={() => update.mutate({ data: { services, serviceAreas: areas } })}
        disabled={update.isPending}
      >
        {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save services & areas
      </Button>
    </div>
  );
}

/**
 * Error toasts with a Retry action for one-shot settings mutations. Module
 * level (global toast store + plain fetch client) so retrying keeps working
 * across re-renders — same pattern as pipeline.tsx / project-form-modal.tsx.
 */
function showExpirePreviousSecretFailedToast(webhookId: string, queryClient: QueryClient) {
  const { dismiss } = globalToast({
    variant: 'destructive',
    title: 'Could not revoke the old secret',
    description: 'Revoking the previous signing secret failed. Retry below.',
    action: (
      <ToastAction
        altText="Retry revoking the old secret"
        onClick={async () => {
          try {
            await expireWebhookPreviousSecretRequest(webhookId);
            queryClient.invalidateQueries({ queryKey: getListWebhooksQueryKey() });
            dismiss();
            globalToast({ title: 'Old secret revoked — only the new secret is accepted now' });
          } catch {
            showExpirePreviousSecretFailedToast(webhookId, queryClient);
          }
        }}
      >
        Retry
      </ToastAction>
    ),
  });
}

function showMemberUpdateFailedToast(userId: string, data: UpdateUserInput, queryClient: QueryClient) {
  const { dismiss } = globalToast({
    variant: 'destructive',
    title: 'Could not update member',
    description: 'Updating the team member failed. Retry below.',
    action: (
      <ToastAction
        altText="Retry member update"
        onClick={async () => {
          try {
            await updateUserRequest(userId, data);
            queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
            dismiss();
            globalToast({ title: 'Member updated' });
          } catch {
            showMemberUpdateFailedToast(userId, data, queryClient);
          }
        }}
      >
        Retry
      </ToastAction>
    ),
  });
}

function resendCooldownSeconds(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.status !== 429) return null;
  const retryAfter = Number(error.headers?.get?.('Retry-After'));
  return Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 60;
}

function showResendCooldownToast(seconds: number) {
  globalToast({
    title: 'Invite was just resent',
    description:
      seconds > 1
        ? `To avoid spamming their inbox, you can resend again in about ${seconds} seconds.`
        : 'To avoid spamming their inbox, you can resend again in a moment.',
  });
}

function showResendInviteFailedToast(userId: string, queryClient: QueryClient, error?: string) {
  const { dismiss } = globalToast({
    variant: 'destructive',
    title: 'Could not re-send the invite email',
    description: `${error || 'Re-sending the invite failed'}. Retry below.`,
    action: (
      <ToastAction
        altText="Retry re-sending the invite"
        onClick={async () => {
          try {
            const result = await resendInviteRequest(userId);
            if (result.sent) {
              queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
              dismiss();
              globalToast({ title: 'Invite email re-sent' });
            } else {
              showResendInviteFailedToast(userId, queryClient, result.error || undefined);
            }
          } catch (e) {
            const cooldown = resendCooldownSeconds(e);
            if (cooldown !== null) {
              dismiss();
              showResendCooldownToast(cooldown);
            } else {
              showResendInviteFailedToast(userId, queryClient);
            }
          }
        }}
      >
        Retry
      </ToastAction>
    ),
  });
}

function TeamTab({ meId, meRole }: { meId: string; meRole: UserRole }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useListUsers();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
  const invite = useInviteUser({
    mutation: {
      onSuccess: (member) => {
        void invalidate();
        if (member.inviteEmail?.sent) {
          toast({ title: 'Invite sent — we emailed them a sign-in link' });
        } else {
          toast({
            title: 'Invite created, but the email failed to send',
            description: `${member.inviteEmail?.error || 'Email could not be delivered'}. Ask them to sign in with their email address.`,
            variant: 'destructive',
          });
        }
      },
      onError: (e) => toast({ title: (e as Error)?.message || 'Could not invite member', variant: 'destructive' }),
    },
  });
  const update = useUpdateUser({
    mutation: {
      onSuccess: () => { void invalidate(); toast({ title: 'Member updated' }); },
      onError: (_e, vars) => showMemberUpdateFailedToast(vars.id, vars.data, queryClient),
    },
  });
  const [resendingId, setResendingId] = useState<string | null>(null);
  const resend = useResendInvite({
    mutation: {
      onSuccess: (result, vars) => {
        if (result.sent) {
          toast({ title: 'Invite email re-sent' });
        } else {
          showResendInviteFailedToast(vars.id, queryClient, result.error || undefined);
        }
      },
      onError: (e, vars) => {
        const cooldown = resendCooldownSeconds(e);
        if (cooldown !== null) {
          showResendCooldownToast(cooldown);
        } else {
          showResendInviteFailedToast(vars.id, queryClient);
        }
      },
      onSettled: () => setResendingId(null),
    },
  });
  const [draft, setDraft] = useState({ email: '', role: 'sales_rep' as UserRole, firstName: '' });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invite a team member</CardTitle>
          <CardDescription>They join with the selected role the first time they sign in with this email.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <Input placeholder="email@company.com" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            <Input placeholder="First name (optional)" value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
            <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v as UserRole })}>
              <SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              disabled={!draft.email.includes('@') || invite.isPending}
              onClick={() =>
                invite.mutate(
                  { data: { email: draft.email.trim(), role: draft.role, firstName: draft.firstName || undefined } },
                  { onSuccess: () => setDraft({ email: '', role: 'sales_rep', firstName: '' }) },
                )
              }
            >
              {invite.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-3">
          {users?.map((u) => {
            const isSelf = u.id === meId;
            const lockedOwner = u.role === 'owner' && meRole !== 'owner';
            const pendingInvite = u.id.startsWith('invite:');
            return (
              <Card key={u.id} className={!u.isActive ? 'opacity-50' : ''}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id}
                      </span>
                      {isSelf && <Badge variant="outline">you</Badge>}
                      {pendingInvite && <Badge variant="secondary">invite pending</Badge>}
                      {!u.isActive && <Badge variant="destructive">deactivated</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {pendingInvite && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={resend.isPending}
                        onClick={() => {
                          setResendingId(u.id);
                          resend.mutate({ id: u.id });
                        }}
                        data-testid={`button-resend-invite-${u.id}`}
                      >
                        {resend.isPending && resendingId === u.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Resend email
                      </Button>
                    )}
                    <Select
                      value={u.role}
                      onValueChange={(v) => update.mutate({ id: u.id, data: { role: v as UserRole } })}
                      disabled={isSelf || lockedOwner || update.isPending}
                    >
                      <SelectTrigger aria-label={`Role for ${u.email}`} className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(u.role === 'owner' ? (['owner', ...ASSIGNABLE_ROLES] as UserRole[]) : ASSIGNABLE_ROLES).map((r) => (
                          <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Switch
                      checked={u.isActive}
                      disabled={isSelf || lockedOwner || update.isPending}
                      onCheckedChange={(v) => update.mutate({ id: u.id, data: { isActive: v } })}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
function ScoringTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const update = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: 'Scoring rules saved' });
      },
      onError: () => toast({ title: 'Could not save scoring rules', variant: 'destructive' }),
    },
  });
  const [scoring, setScoring] = useState<LeadScoringSettings>(DEFAULT_SCORING);

  useEffect(() => {
    if (settings) {
      const s = settings.leadScoring;
      setScoring(s ? { ...DEFAULT_SCORING, ...s, intentPoints: { ...DEFAULT_SCORING.intentPoints, ...s.intentPoints } } : DEFAULT_SCORING);
    }
  }, [settings]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const num = (v: string) => Math.max(0, Math.min(100, Number(v) || 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead scoring rules</CardTitle>
        <CardDescription>
          Points added to new website and concierge leads. Total is capped at 100.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="text-sm font-semibold">Points by request type</Label>
          <div className="grid gap-3 md:grid-cols-2 mt-2">
            {Object.entries(scoring.intentPoints).map(([intent, points]) => (
              <div key={intent} className="flex items-center gap-3">
                <span className="text-sm flex-1 font-mono">{intent}</span>
                <Input
                  type="number"
                  className="w-24"
                  value={points}
                  onChange={(e) =>
                    setScoring({ ...scoring, intentPoints: { ...scoring.intentPoints, [intent]: num(e.target.value) } })
                  }
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-sm font-semibold">Bonus points</Label>
          <div className="grid gap-3 md:grid-cols-2 mt-2">
            {SCORING_FIELDS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-sm flex-1">{label}</span>
                <Input
                  type="number"
                  className="w-24"
                  value={scoring[key]}
                  onChange={(e) => setScoring({ ...scoring, [key]: num(e.target.value) })}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => update.mutate({ data: { leadScoring: scoring } })} disabled={update.isPending}>
            {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save scoring rules
          </Button>
          <Button variant="outline" onClick={() => setScoring(DEFAULT_SCORING)}>
            Reset to defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const DEFAULT_SCORING: LeadScoringSettings = {
  intentPoints: {
    'active-leak': 40,
    emergency: 40,
    'water-damage': 30,
    storm: 25,
    replacement: 20,
    repair: 15,
    general: 10,
  },
  emergencyUrgencyBonus: 20,
  highUrgencyBonus: 10,
  emailProvidedBonus: 5,
  smsConsentBonus: 10,
  detailedDescriptionBonus: 5,
  completeAddressBonus: 10,
  contactMethodBonus: 5,
};

const SCORING_FIELDS: Array<{ key: keyof Omit<LeadScoringSettings, 'intentPoints'>; label: string }> = [
  { key: 'emergencyUrgencyBonus', label: 'Emergency urgency bonus' },
  { key: 'highUrgencyBonus', label: 'High urgency bonus' },
  { key: 'emailProvidedBonus', label: 'Email provided' },
  { key: 'smsConsentBonus', label: 'Contact/SMS consent granted' },
  { key: 'detailedDescriptionBonus', label: 'Detailed description' },
  { key: 'completeAddressBonus', label: 'Complete address (concierge)' },
  { key: 'contactMethodBonus', label: 'Contact method confirmed (concierge)' },
];

function AiTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const update = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: 'AI instructions saved' });
      },
      onError: () => toast({ title: 'Could not save AI instructions', variant: 'destructive' }),
    },
  });
  const [text, setText] = useState('');

  useEffect(() => {
    if (settings) setText(settings.aiInstructions ?? '');
  }, [settings]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI instructions</CardTitle>
        <CardDescription>
          Extra org-specific guidance passed to the AI when it writes internal sales summaries.
          Safety guardrails (no pricing, damage, or insurance conclusions) always apply and cannot be overridden here.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          rows={8}
          maxLength={4000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Always mention if the homeowner referenced a neighbor's referral. Flag leads in Bridgemill for the north crew."
        />
        <Button onClick={() => update.mutate({ data: { aiInstructions: text } })} disabled={update.isPending}>
          {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save AI instructions
        </Button>
      </CardContent>
    </Card>
  );
}

/** Sentinel returned by the API when a key is saved but masked. */
function isServerMaskedKey(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.includes('••••');
}
function GoogleReviewsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const [cacheCleared, setCacheCleared] = useState(false);
  const update = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: 'Google Reviews settings saved' });
        setCacheCleared(true);
      },
      onError: () => toast({ title: 'Could not save Google Reviews settings', variant: 'destructive' }),
    },
  });
  const [config, setConfig] = useState<GoogleReviewsConfig>({});
  // Track whether the apiKey field still holds the server-returned mask (not
  // yet edited by the admin). When true, the field value is the placeholder
  // returned by the API and should not be sent as a new key.
  const [apiKeyIsServerMask, setApiKeyIsServerMask] = useState(false);
  // Set to true on Save button mousedown (fires before onBlur) so that onBlur
  // does not restore the masked sentinel when the admin clicks Save with an
  // intentionally empty field (to clear the stored key).
  const savePressedRef = useRef(false);

  useEffect(() => {
    if (settings) {
      setConfig(settings.googleReviews ?? {});
      setApiKeyIsServerMask(isServerMaskedKey(settings.googleReviews?.apiKey));
    }
  }, [settings]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const serverMaskedKey = isServerMaskedKey(settings?.googleReviews?.apiKey)
    ? settings!.googleReviews!.apiKey
    : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Google Reviews</CardTitle>
        <CardDescription>
          Connect your Google Business Profile so the public website shows live reviews. These
          credentials override the server environment variables; leave both blank to fall back to
          the environment configuration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {cacheCleared && (
          <div
            className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
            data-testid="banner-review-cache-cleared"
          >
            <p className="font-medium">Review cache cleared</p>
            <p className="mt-0.5">
              The server will fetch fresh reviews with the new credentials on the next website
              visit. Browsers that already cached the old reviews may continue to show them for
              up to 1 hour until their local cache expires.
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="google-place-id">Place ID</Label>
          <Input
            id="google-place-id"
            value={config.placeId ?? ''}
            onChange={(e) => { setConfig((c) => ({ ...c, placeId: e.target.value })); setCacheCleared(false); }}
            placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
          />
          <p className="text-xs text-muted-foreground">
            Find your Place ID at{' '}
            <a
              href="https://developers.google.com/maps/documentation/places/web-service/place-id#find-id"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              developers.google.com/maps/documentation/places
            </a>
            .
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="google-api-key">Places API key</Label>
          <Input
            id="google-api-key"
            type="password"
            value={config.apiKey ?? ''}
            onFocus={() => {
              // Clear the masked sentinel when the admin focuses the field so
              // they can type a fresh key from a blank slate.
              if (apiKeyIsServerMask) {
                setConfig((c) => ({ ...c, apiKey: '' }));
                setApiKeyIsServerMask(false);
                setCacheCleared(false);
              }
            }}
            onBlur={() => {
              // If the admin focused but didn't type anything, restore the
              // masked indicator so it's clear a key is still saved.
              // Skip the restore when the Save button is being clicked
              // (savePressedRef is set on mousedown, which fires before blur)
              // — an empty field in that context means an intentional clear.
              if (!config.apiKey?.trim() && serverMaskedKey && !savePressedRef.current) {
                setConfig((c) => ({ ...c, apiKey: serverMaskedKey }));
                setApiKeyIsServerMask(true);
              }
              savePressedRef.current = false;
            }}
            onChange={(e) => {
              setApiKeyIsServerMask(false);
              setCacheCleared(false);
              setConfig((c) => ({ ...c, apiKey: e.target.value }));
            }}
            placeholder={serverMaskedKey ? 'Enter a new key to replace the saved one' : 'AIza…'}
            autoComplete="off"
          />
          {apiKeyIsServerMask && (
            <p className="text-xs text-muted-foreground">
              A key is already saved. Click the field and enter a new key to replace it, or leave it unchanged.
            </p>
          )}
          {!apiKeyIsServerMask && (
            <p className="text-xs text-muted-foreground">
              Requires the <strong>Places API</strong> to be enabled in your Google Cloud project.
            </p>
          )}
        </div>
        <Button
          onMouseDown={() => { savePressedRef.current = true; }}
          onClick={() => {
            // When the apiKey field still holds the server-returned masked value
            // (unchanged), send it back as-is so the server recognises the
            // sentinel and preserves the stored key.
            // An explicitly empty value means the admin intentionally cleared
            // the field — send undefined so the key is removed.
            const apiKey = apiKeyIsServerMask
              ? (config.apiKey ?? undefined)
              : (config.apiKey?.trim() || undefined);
            update.mutate({
              data: {
                googleReviews: {
                  placeId: config.placeId?.trim() || undefined,
                  apiKey,
                },
              },
            });
          }}
          disabled={update.isPending}
        >
          {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save Google Reviews settings
        </Button>
      </CardContent>
    </Card>
  );
}

/** How far back a brute-force block is still worth calling out as an active alert. */
const SECURITY_ALERT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const BRUTE_FORCE_ACTION = 'api_key.brute_force_blocked';

function recentBruteForceEvents(
  events: AuditEvent[] | undefined,
  acknowledgedAt?: string | null,
): AuditEvent[] {
  if (!events) return [];
  const cutoff = Date.now() - SECURITY_ALERT_WINDOW_MS;
  // Defense in depth: the server already filters by action + since, but keep
  // the client-side check so a stale cache entry can't show the wrong events.
  const ackTime = acknowledgedAt ? new Date(acknowledgedAt).getTime() : null;
  return events.filter((e) => {
    if (e.action !== BRUTE_FORCE_ACTION) return false;
    const created = new Date(e.createdAt).getTime();
    if (created < cutoff) return false;
    // Alerts recorded at or before the acknowledgement are dismissed;
    // a newer block event surfaces a fresh banner.
    return ackTime === null || created > ackTime;
  });
}

function SecurityAlertsBanner() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Compute the window start once per mount so the query key stays stable.
  const [since] = useState(() => new Date(Date.now() - SECURITY_ALERT_WINDOW_MS).toISOString());
  const { data: events } = useListAuditEvents({ action: BRUTE_FORCE_ACTION, since });
  const { data: settings } = useGetSettings();
  const dismiss = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: 'Security alert dismissed' });
      },
      onError: () => toast({ title: 'Could not dismiss the alert', variant: 'destructive' }),
    },
  });
  const alerts = recentBruteForceEvents(events, settings?.securityAlertsAcknowledgedAt);
  if (alerts.length === 0) return null;
  // Acknowledge up to the newest shown alert (not "now") so a block that
  // lands while the admin is reading still surfaces afterwards.
  const newestAlertAt = alerts.reduce(
    (max, e) => Math.max(max, new Date(e.createdAt).getTime()),
    0,
  );
  return (
    <Alert variant="destructive" data-testid="alert-brute-force">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>
        Security alert: API key guessing attempts blocked
        {alerts.length > 1 ? ` (${alerts.length} in the last 7 days)` : ''}
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-1 space-y-1">
          {alerts.slice(0, 5).map((e) => {
            const ip = typeof e.metadata.ip === 'string' ? e.metadata.ip : 'unknown IP';
            return (
              <li key={e.id} data-testid={`alert-brute-force-${e.id}`}>
                {new Date(e.createdAt).toLocaleString()} — blocked repeated invalid API key attempts from{' '}
                <span className="font-mono">{ip}</span>
              </li>
            );
          })}
          {alerts.length > 5 && <li>…and {alerts.length - 5} more in the audit log.</li>}
        </ul>
        <p className="mt-2">
          Your keys were not compromised by these blocked attempts, but consider rotating any key that may be
          exposed and reviewing the audit log.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          disabled={dismiss.isPending}
          data-testid="button-dismiss-brute-force-alert"
          onClick={() =>
            dismiss.mutate({
              data: { securityAlertsAcknowledgedAt: new Date(newestAlertAt).toISOString() },
            })
          }
        >
          {dismiss.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Dismiss — I've reviewed this
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function ApiKeysTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: keys, isLoading } = useListApiKeys();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
  const [newKey, setNewKey] = useState<string | null>(null);
  const create = useCreateApiKey({
    mutation: {
      onSuccess: (created) => {
        void invalidate();
        setNewKey(created.key);
        toast({ title: 'API key created — copy it now, it will not be shown again' });
      },
      onError: () => toast({ title: 'Could not create API key', variant: 'destructive' }),
    },
  });
  const revoke = useRevokeApiKey({
    mutation: { onSuccess: () => { void invalidate(); toast({ title: 'API key revoked' }); } },
  });
  const updateKey = useUpdateApiKey({
    mutation: {
      onSuccess: () => {
        void invalidate();
        setEditingKey(null);
        toast({ title: 'API key updated' });
      },
      onError: () => toast({ title: 'Could not update API key', variant: 'destructive' }),
    },
  });
  const [draft, setDraft] = useState({ name: '', role: 'office' as UserRole, expiresAt: '' });
  const [editingKey, setEditingKey] = useState<{ id: string; name: string; expiresAt: string } | null>(null);

  return (
    <div className="space-y-6">
      <SecurityAlertsBanner />
      <Card>
        <CardHeader>
          <CardTitle>New API key</CardTitle>
          <CardDescription>
            Send the key in an <code>x-api-key</code> header. Keys are capped at the chosen access level and can never
            manage settings, team, or other keys.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <Input placeholder="Key name (e.g. Zapier)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Select value={draft.role} onValueChange={(v) => setDraft({ ...draft, role: v as UserRole })}>
              <SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger>
              <SelectContent>
                {API_KEY_ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              type="date"
              title="Expiration date (optional)"
              min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
              value={draft.expiresAt}
              onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })}
            />
            <Button
              disabled={!draft.name.trim() || create.isPending}
              onClick={() =>
                create.mutate(
                  {
                    data: {
                      name: draft.name.trim(),
                      role: draft.role,
                      ...(draft.expiresAt
                        ? { expiresAt: new Date(`${draft.expiresAt}T23:59:59`).toISOString() }
                        : {}),
                    },
                  },
                  { onSuccess: () => setDraft({ name: '', role: 'office', expiresAt: '' }) },
                )
              }
            >
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create key
            </Button>
          </div>
          {newKey && (
            <div className="flex items-center gap-2 bg-muted rounded-md p-3 text-xs font-mono">
              <span className="truncate">{newKey}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  void navigator.clipboard.writeText(newKey);
                  toast({ title: 'Key copied' });
                }}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-3">
          {keys?.map((k) => (
            <Card key={k.id} className={!k.isActive ? 'opacity-50' : ''}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{k.name}</span>
                    <Badge variant="secondary" className="font-mono text-[10px]">{k.prefix}…</Badge>
                    <Badge variant="outline">{k.role.replace('_', ' ')}</Badge>
                    {!k.isActive && <Badge variant="destructive">revoked</Badge>}
                    {k.isActive && k.expiresAt && new Date(k.expiresAt).getTime() <= Date.now() && (
                      <Badge variant="destructive">expired</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created {new Date(k.createdAt).toLocaleDateString()}
                    {k.lastUsedAt ? ` · last used ${new Date(k.lastUsedAt).toLocaleString()}` : ' · never used'}
                    {k.expiresAt
                      ? ` · ${new Date(k.expiresAt).getTime() <= Date.now() ? 'expired' : 'expires'} ${new Date(k.expiresAt).toLocaleDateString()}`
                      : ''}
                  </div>
                </div>
                {k.isActive && (
                  <div className="flex items-center gap-2 shrink-0">
                    {editingKey?.id === k.id ? (
                      <>
                        <Input
                          className="w-40"
                          placeholder="Key name"
                          data-testid={`input-edit-name-${k.id}`}
                          value={editingKey.name}
                          onChange={(e) => setEditingKey({ ...editingKey, name: e.target.value })}
                        />
                        <Input
                          type="date"
                          className="w-40"
                          data-testid={`input-edit-expiry-${k.id}`}
                          min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                          value={editingKey.expiresAt}
                          onChange={(e) => setEditingKey({ ...editingKey, expiresAt: e.target.value })}
                        />
                        <Button
                          size="sm"
                          data-testid={`button-save-expiry-${k.id}`}
                          disabled={updateKey.isPending || !editingKey.name.trim()}
                          onClick={() =>
                            updateKey.mutate({
                              id: k.id,
                              data: {
                                name: editingKey.name.trim(),
                                expiresAt: editingKey.expiresAt
                                  ? new Date(`${editingKey.expiresAt}T23:59:59`).toISOString()
                                  : null,
                              },
                            })
                          }
                        >
                          {updateKey.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit name or expiration"
                          data-testid={`button-edit-expiry-${k.id}`}
                          onClick={() =>
                            setEditingKey({
                              id: k.id,
                              name: k.name,
                              expiresAt: k.expiresAt ? toLocalDateInputValue(k.expiresAt) : '',
                            })
                          }
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => revoke.mutate({ id: k.id })}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {!keys?.length && <p className="text-sm text-muted-foreground text-center py-6">No API keys yet.</p>}
        </div>
      )}
    </div>
  );
}

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
];

const DEFAULT_AVAILABILITY: InspectionAvailabilitySettings = {
  timezone: 'America/New_York',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  windows: [
    { startHour: 9, endHour: 11 },
    { startHour: 13, endHour: 15 },
    { startHour: 16, endHour: 18 },
  ],
  maxBookingsPerWindow: 1,
  blackoutDates: [],
};

function SchedulingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const update = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: 'Inspection availability saved' });
      },
      onError: () => toast({ title: 'Could not save availability', variant: 'destructive' }),
    },
  });
  const [avail, setAvail] = useState<InspectionAvailabilitySettings>(DEFAULT_AVAILABILITY);
  const [newBlackout, setNewBlackout] = useState('');

  useEffect(() => {
    if (settings) setAvail(settings.inspectionAvailability ?? DEFAULT_AVAILABILITY);
  }, [settings]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const windowsValid = avail.windows.length > 0 && avail.windows.every((w) => w.endHour > w.startHour);
  const daysValid = avail.days.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inspection availability</CardTitle>
        <CardDescription>
          Controls which days and time windows the AI concierge offers homeowners when booking inspections in chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Bookable days</Label>
          <div className="flex flex-wrap gap-4">
            {ALL_DAYS.map((d) => (
              <label key={d} className="flex items-center gap-2 text-sm">
                <Switch
                  checked={avail.days.includes(d)}
                  onCheckedChange={(v) =>
                    setAvail({
                      ...avail,
                      days: v
                        ? [...ALL_DAYS.filter((x) => avail.days.includes(x) || x === d)]
                        : avail.days.filter((x) => x !== d),
                    })
                  }
                />
                {d}
              </label>
            ))}
          </div>
          {!daysValid && <p className="text-xs text-destructive">Pick at least one day.</p>}
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Daily time windows</Label>
          {avail.windows.map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <Select
                value={String(w.startHour)}
                onValueChange={(v) =>
                  setAvail({ ...avail, windows: avail.windows.map((x, j) => (j === i ? { ...x, startHour: Number(v) } : x)) })
                }
              >
                <SelectTrigger aria-label="Window start time" className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, h) => (
                    <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">to</span>
              <Select
                value={String(w.endHour)}
                onValueChange={(v) =>
                  setAvail({ ...avail, windows: avail.windows.map((x, j) => (j === i ? { ...x, endHour: Number(v) } : x)) })
                }
              >
                <SelectTrigger aria-label="Window end time" className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, idx) => idx + 1).map((h) => (
                    <SelectItem key={h} value={String(h)}>{hourLabel(h)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {w.endHour <= w.startHour && <span className="text-xs text-destructive">End must be after start</span>}
              <Button variant="ghost" size="icon" aria-label="Remove time window" onClick={() => setAvail({ ...avail, windows: avail.windows.filter((_, j) => j !== i) })}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            disabled={avail.windows.length >= 12}
            onClick={() => setAvail({ ...avail, windows: [...avail.windows, { startHour: 9, endHour: 11 }] })}
          >
            Add window
          </Button>
          {!avail.windows.length && <p className="text-xs text-destructive">Add at least one window.</p>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Timezone</Label>
            <Select value={avail.timezone} onValueChange={(v) => setAvail({ ...avail, timezone: v })}>
              <SelectTrigger aria-label="Timezone"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(COMMON_TIMEZONES.includes(avail.timezone) ? COMMON_TIMEZONES : [avail.timezone, ...COMMON_TIMEZONES]).map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Max bookings per window</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={avail.maxBookingsPerWindow}
              onChange={(e) =>
                setAvail({ ...avail, maxBookingsPerWindow: Math.max(1, Math.min(50, Math.floor(Number(e.target.value) || 1))) })
              }
            />
            <p className="text-xs text-muted-foreground">A window stops being offered once it has this many appointments.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold">Blackout dates</Label>
          <div className="flex flex-wrap gap-2">
            {avail.blackoutDates.map((d) => (
              <Badge key={d} variant="secondary" className="gap-1">
                {d}
                <button
                  className="ml-1 text-destructive"
                  onClick={() => setAvail({ ...avail, blackoutDates: avail.blackoutDates.filter((x) => x !== d) })}
                >
                  ×
                </button>
              </Badge>
            ))}
            {!avail.blackoutDates.length && <span className="text-xs text-muted-foreground">No blackout dates.</span>}
          </div>
          <div className="flex gap-3">
            <Input type="date" className="w-44" value={newBlackout} onChange={(e) => setNewBlackout(e.target.value)} />
            <Button
              variant="secondary"
              disabled={!/^\d{4}-\d{2}-\d{2}$/.test(newBlackout) || avail.blackoutDates.includes(newBlackout)}
              onClick={() => {
                setAvail({ ...avail, blackoutDates: [...avail.blackoutDates, newBlackout].sort() });
                setNewBlackout('');
              }}
            >
              Add date
            </Button>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => update.mutate({ data: { inspectionAvailability: avail } })}
            disabled={update.isPending || !windowsValid || !daysValid}
          >
            {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save availability
          </Button>
          <Button variant="outline" onClick={() => setAvail(DEFAULT_AVAILABILITY)}>
            Reset to defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const DEFAULT_REMINDER: AppointmentReminderSettings = {
  leadTimeHours: 24,
  smsBody:
    '{{business.name}} reminder: your roof inspection is tomorrow, {{appointment.window}}. {{reschedule.line}}',
  emailSubject: 'Reminder: your roof inspection is tomorrow — {{appointment.window}}',
  emailBody: [
    'Hi {{contact.firstName}},',
    '',
    'A quick reminder that your roof inspection with {{business.name}} is coming up:',
    '🗓 When: {{appointment.window}}',
    '',
    '{{reschedule.line}}',
    '',
    '— {{business.name}}',
  ].join('\n'),
};
const hourLabel = (h: number) => {
  const hh = h % 24;
  const ampm = hh < 12 ? 'AM' : 'PM';
  const display = hh % 12 === 0 ? 12 : hh % 12;
  return `${display} ${ampm}`;
};

const REMINDER_PLACEHOLDERS =
  '{{contact.firstName}}, {{business.name}}, {{business.phone}}, {{appointment.window}}, {{reschedule.line}}';

function ReminderTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useGetSettings();
  const update = useUpdateSettings({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
        toast({ title: 'Reminder settings saved' });
      },
      onError: () => toast({ title: 'Could not save reminder settings', variant: 'destructive' }),
    },
  });
  const [rem, setRem] = useState<AppointmentReminderSettings>(DEFAULT_REMINDER);

  useEffect(() => {
    if (settings)
      setRem({ ...DEFAULT_REMINDER, ...(settings.appointmentReminder ?? {}) });
  }, [settings]);

  if (isLoading) return null;

  const valid =
    rem.leadTimeHours >= 1 &&
    rem.leadTimeHours <= 336 &&
    rem.smsBody.trim().length > 0 &&
    rem.emailSubject.trim().length > 0 &&
    rem.emailBody.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inspection reminder</CardTitle>
        <CardDescription>
          The reminder homeowners get before their inspection window. Placeholders: {REMINDER_PLACEHOLDERS}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5 max-w-xs">
          <Label>Send reminder (hours before the inspection)</Label>
          <Input
            type="number"
            min={1}
            max={336}
            value={rem.leadTimeHours}
            onChange={(e) => setRem({ ...rem, leadTimeHours: Math.floor(Number(e.target.value) || 0) })}
          />
          <p className="text-xs text-muted-foreground">
            24 = day before (default), 48 = two days before, 3 = same morning. Bookings made closer than this still get a reminder right away.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Text message</Label>
          <Textarea rows={3} value={rem.smsBody} onChange={(e) => setRem({ ...rem, smsBody: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Email subject</Label>
          <Input value={rem.emailSubject} onChange={(e) => setRem({ ...rem, emailSubject: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Email body</Label>
          <Textarea rows={8} value={rem.emailBody} onChange={(e) => setRem({ ...rem, emailBody: e.target.value })} />
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => update.mutate({ data: { appointmentReminder: rem } })}
            disabled={update.isPending || !valid}
          >
            {update.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save reminder
          </Button>
          <Button variant="outline" onClick={() => setRem(DEFAULT_REMINDER)}>
            Reset to defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
