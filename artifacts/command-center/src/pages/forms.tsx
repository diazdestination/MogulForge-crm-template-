/**
 * Smart Forms admin: create/edit multi-step forms and assessments, publish
 * them, and grab the share assets (hosted link, embed snippet, QR code).
 * Structured editor — steps and fields are edited as cards, branching and
 * scoring as simple rule rows. Admin-only (settings.manage).
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetMe,
  useListForms,
  useCreateForm,
  useUpdateForm,
  useDeleteForm,
  useListFormSubmissions,
  useGetFormShareAssets,
  getListFormsQueryKey,
  type SmartForm,
} from '@workspace/api-client-react';
import { Shell } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { canManageSettings } from '@/lib/permissions';
import {
  ClipboardList,
  Copy,
  ExternalLink,
  Loader2,
  Plus,
  QrCode,
  Trash2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Editable definition model (mirrors the server-side FormStep/FormField)
// ---------------------------------------------------------------------------

interface EditField {
  key: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  mapTo: string;
  optionsText: string; // one option per line: value | label | urgency?
  scoringText: string; // one rule per line: points | reason | value?
}

interface EditStep {
  key: string;
  title: string;
  description?: string;
  showIfField: string;
  showIfOp: string;
  showIfValue: string;
  fields: EditField[];
}

const FIELD_TYPES = [
  'text', 'textarea', 'email', 'phone', 'select', 'multiselect',
  'checkbox', 'number', 'date', 'photos', 'consent', 'hidden',
];

const MAPPINGS = [
  'none',
  'contact.firstName', 'contact.lastName', 'contact.email', 'contact.phone',
  'property.addressLine1', 'property.addressLine2', 'property.city', 'property.state', 'property.postalCode',
  'lead.description', 'lead.serviceType', 'lead.urgency', 'lead.budget', 'lead.timeline', 'lead.insurance',
];

const URGENCIES = ['low', 'normal', 'high', 'emergency'];

function slugify(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
}

function keyify(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64);
}

function toEditModel(steps: Array<Record<string, unknown>>): EditStep[] {
  return (steps ?? []).map((s: any) => ({
    key: s.key ?? '',
    title: s.title ?? '',
    description: s.description ?? '',
    showIfField: s.showIf?.fieldKey ?? '',
    showIfOp: s.showIf?.op ?? 'eq',
    showIfValue: Array.isArray(s.showIf?.value) ? s.showIf.value.join(', ') : String(s.showIf?.value ?? ''),
    fields: (s.fields ?? []).map((f: any) => ({
      key: f.key ?? '',
      type: f.type ?? 'text',
      label: f.label ?? '',
      required: Boolean(f.required),
      placeholder: f.placeholder ?? '',
      helpText: f.helpText ?? '',
      mapTo: f.mapTo ?? 'none',
      optionsText: (f.options ?? [])
        .map((o: any) => [o.value, o.label, o.urgency].filter(Boolean).join(' | '))
        .join('\n'),
      scoringText: (f.scoring ?? [])
        .map((r: any) => [r.points, r.reason, r.when?.value].filter((x: unknown) => x !== undefined && x !== null && x !== '').join(' | '))
        .join('\n'),
    })),
  }));
}

function fromEditModel(steps: EditStep[]): Array<Record<string, unknown>> {
  return steps.map((s) => {
    const step: Record<string, unknown> = {
      key: s.key || keyify(s.title),
      title: s.title,
      ...(s.description ? { description: s.description } : {}),
      fields: s.fields.map((f) => {
        const field: Record<string, unknown> = {
          key: f.key || keyify(f.label),
          type: f.type,
          label: f.label,
          required: f.required,
          mapTo: f.mapTo,
          ...(f.placeholder ? { placeholder: f.placeholder } : {}),
          ...(f.helpText ? { helpText: f.helpText } : {}),
        };
        if (f.type === 'select' || f.type === 'multiselect') {
          field.options = f.optionsText
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              const [value, label, urgency] = line.split('|').map((x) => x.trim());
              return {
                value,
                label: label || value,
                ...(urgency && URGENCIES.includes(urgency) ? { urgency } : {}),
              };
            });
        }
        const scoring = f.scoringText
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [points, reason, value] = line.split('|').map((x) => x.trim());
            return {
              points: Number(points),
              reason: reason ?? '',
              ...(value ? { when: { op: 'eq', value } } : {}),
            };
          })
          .filter((r) => Number.isFinite(r.points) && r.reason);
        if (scoring.length) field.scoring = scoring;
        return field;
      }),
    };
    if (s.showIfField) {
      step.showIf = {
        fieldKey: s.showIfField,
        op: s.showIfOp,
        ...(s.showIfOp === 'answered'
          ? {}
          : s.showIfOp === 'in'
            ? { value: s.showIfValue.split(',').map((x) => x.trim()).filter(Boolean) }
            : { value: s.showIfValue }),
      };
    }
    return step;
  });
}

const STARTER_STEPS: EditStep[] = [
  {
    key: 'contact',
    title: 'How can we reach you?',
    description: '',
    showIfField: '', showIfOp: 'eq', showIfValue: '',
    fields: [
      { key: 'first_name', type: 'text', label: 'First name', required: true, mapTo: 'contact.firstName', optionsText: '', scoringText: '' },
      { key: 'phone', type: 'phone', label: 'Phone', required: true, mapTo: 'contact.phone', optionsText: '', scoringText: '' },
      { key: 'email', type: 'email', label: 'Email', required: false, mapTo: 'contact.email', optionsText: '', scoringText: '' },
      { key: 'consent', type: 'consent', label: 'I agree to be contacted about my request.', required: true, mapTo: 'none', optionsText: '', scoringText: '' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FormsPage() {
  const { data: me } = useGetMe();
  const role = me?.role;
  const allowed = canManageSettings(role);

  return (
    <Shell>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-forms-title">Smart Forms</h1>
          <p className="text-muted-foreground text-sm">
            Configurable multi-step forms and assessments. Embed them on any website or share them as hosted pages with QR codes.
          </p>
        </div>
        {allowed ? <FormsAdmin /> : (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            You need admin access to manage forms.
          </CardContent></Card>
        )}
      </div>
    </Shell>
  );
}

function FormsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: forms, isLoading } = useListForms();
  const createForm = useCreateForm();
  const updateForm = useUpdateForm();
  const deleteForm = useDeleteForm();

  const [editing, setEditing] = useState<SmartForm | null>(null);
  const [creating, setCreating] = useState(false);
  const [sharing, setSharing] = useState<SmartForm | null>(null);
  const [viewingSubmissions, setViewingSubmissions] = useState<SmartForm | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListFormsQueryKey() });

  const togglePublish = (form: SmartForm) => {
    const status = form.status === 'published' ? 'draft' : 'published';
    updateForm.mutate(
      { id: form.id, data: { status } },
      {
        onSuccess: () => { refresh(); toast({ title: status === 'published' ? 'Form published' : 'Form unpublished' }); },
        onError: () => toast({ title: 'Could not update form', variant: 'destructive' }),
      },
    );
  };

  const remove = (form: SmartForm) => {
    if (!window.confirm(`Delete "${form.name}"? Forms with submissions are archived instead.`)) return;
    deleteForm.mutate(
      { id: form.id },
      {
        onSuccess: (r) => { refresh(); toast({ title: r.outcome === 'deleted' ? 'Form deleted' : 'Form archived (it has submissions)' }); },
        onError: () => toast({ title: 'Could not delete form', variant: 'destructive' }),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} data-testid="button-create-form">
          <Plus className="w-4 h-4 mr-2" /> New form
        </Button>
      </div>

      {isLoading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>}

      <div className="grid gap-4">
        {(forms ?? []).map((form) => (
          <Card key={form.id} data-testid={`card-form-${form.slug}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-muted-foreground" />
                  {form.name}
                  <Badge variant={form.status === 'published' ? 'default' : 'secondary'}>{form.status}</Badge>
                  {form.isSeeded && <Badge variant="outline">seeded</Badge>}
                </CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setSharing(form)} data-testid={`button-share-${form.slug}`}>
                    <QrCode className="w-4 h-4 mr-1" /> Share
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setViewingSubmissions(form)} data-testid={`button-submissions-${form.slug}`}>
                    Submissions
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(form)} data-testid={`button-edit-${form.slug}`}>
                    Edit
                  </Button>
                  <Button size="sm" variant={form.status === 'published' ? 'secondary' : 'default'} onClick={() => togglePublish(form)} data-testid={`button-publish-${form.slug}`}>
                    {form.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Delete ${form.name}`} onClick={() => remove(form)} data-testid={`button-delete-${form.slug}`}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <span className="font-mono">/{form.slug}</span> · {form.steps.length} step{form.steps.length === 1 ? '' : 's'}
              {form.description ? <> · {form.description}</> : null}
            </CardContent>
          </Card>
        ))}
        {!isLoading && (forms ?? []).length === 0 && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">No forms yet.</CardContent></Card>
        )}
      </div>

      {creating && (
        <FormEditorDialog
          title="New form"
          initial={{ name: '', slug: '', description: '', steps: STARTER_STEPS }}
          saving={createForm.isPending}
          onClose={() => setCreating(false)}
          onSave={(payload) => {
            createForm.mutate(
              { data: { name: payload.name, slug: payload.slug, description: payload.description, steps: fromEditModel(payload.steps) } },
              {
                onSuccess: () => { refresh(); setCreating(false); toast({ title: 'Form created as draft' }); },
                onError: (err: any) => toast({ title: err?.data?.error ?? 'Could not create form', variant: 'destructive' }),
              },
            );
          }}
        />
      )}

      {editing && (
        <FormEditorDialog
          title={`Edit "${editing.name}"`}
          initial={{
            name: editing.name,
            slug: editing.slug,
            description: editing.description ?? '',
            steps: toEditModel(editing.steps as Array<Record<string, unknown>>),
          }}
          saving={updateForm.isPending}
          onClose={() => setEditing(null)}
          onSave={(payload) => {
            updateForm.mutate(
              { id: editing.id, data: { name: payload.name, slug: payload.slug, description: payload.description, steps: fromEditModel(payload.steps) } },
              {
                onSuccess: () => { refresh(); setEditing(null); toast({ title: 'Form saved' }); },
                onError: (err: any) => toast({ title: err?.data?.error ?? 'Could not save form', variant: 'destructive' }),
              },
            );
          }}
        />
      )}

      {sharing && <ShareDialog form={sharing} onClose={() => setSharing(null)} />}
      {viewingSubmissions && <SubmissionsDialog form={viewingSubmissions} onClose={() => setViewingSubmissions(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor dialog
// ---------------------------------------------------------------------------

function FormEditorDialog(props: {
  title: string;
  initial: { name: string; slug: string; description: string; steps: EditStep[] };
  saving: boolean;
  onClose: () => void;
  onSave: (payload: { name: string; slug: string; description: string; steps: EditStep[] }) => void;
}) {
  const [name, setName] = useState(props.initial.name);
  const [slug, setSlug] = useState(props.initial.slug);
  const [description, setDescription] = useState(props.initial.description);
  const [steps, setSteps] = useState<EditStep[]>(props.initial.steps);

  const priorFieldKeys = (idx: number) =>
    steps.slice(0, idx).flatMap((s) => s.fields.map((f) => f.key || keyify(f.label))).filter(Boolean);

  const patchStep = (i: number, patch: Partial<EditStep>) =>
    setSteps((cur) => cur.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const patchField = (i: number, j: number, patch: Partial<EditField>) =>
    setSteps((cur) =>
      cur.map((s, idx) =>
        idx === i ? { ...s, fields: s.fields.map((f, fj) => (fj === j ? { ...f, ...patch } : f)) } : s,
      ),
    );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{props.title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="form-name">Name</Label>
              <Input id="form-name" value={name} data-testid="input-form-name"
                onChange={(e) => { setName(e.target.value); if (!props.initial.slug) setSlug(slugify(e.target.value)); }} />
            </div>
            <div>
              <Label htmlFor="form-slug">Slug (URL identifier)</Label>
              <Input id="form-slug" value={slug} data-testid="input-form-slug" onChange={(e) => setSlug(slugify(e.target.value))} />
            </div>
          </div>
          <div>
            <Label htmlFor="form-description">Description</Label>
            <Input id="form-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {steps.map((step, i) => (
            <Card key={i} className="border-dashed">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Step {i + 1}</CardTitle>
                  <Button size="sm" variant="ghost" aria-label={`Remove step ${i + 1}`}
                    onClick={() => setSteps((cur) => cur.filter((_, idx) => idx !== i))}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Title</Label>
                    <Input value={step.title} data-testid={`input-step-title-${i}`}
                      onChange={(e) => patchStep(i, { title: e.target.value, key: step.key || keyify(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={step.description ?? ''} onChange={(e) => patchStep(i, { description: e.target.value })} />
                  </div>
                </div>

                {i > 0 && (
                  <div className="grid sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <Label>Show only when (field)</Label>
                      <Select value={step.showIfField || 'always'} onValueChange={(v) => patchStep(i, { showIfField: v === 'always' ? '' : v })}>
                        <SelectTrigger aria-label="Show only when field" data-testid={`select-showif-${i}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="always">Always show</SelectItem>
                          {priorFieldKeys(i).map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {step.showIfField && (
                      <>
                        <div>
                          <Label>Condition</Label>
                          <Select value={step.showIfOp} onValueChange={(v) => patchStep(i, { showIfOp: v })}>
                            <SelectTrigger aria-label="Condition operator"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {['eq', 'ne', 'in', 'answered', 'gte', 'lte'].map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        {step.showIfOp !== 'answered' && (
                          <div>
                            <Label>Value{step.showIfOp === 'in' ? 's (comma separated)' : ''}</Label>
                            <Input value={step.showIfValue} onChange={(e) => patchStep(i, { showIfValue: e.target.value })} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {step.fields.map((field, j) => (
                  <div key={j} className="rounded-lg border p-3 space-y-2 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-muted-foreground">{field.key || keyify(field.label) || 'field'}</span>
                      <Button size="sm" variant="ghost" aria-label={`Remove field ${field.label || j + 1}`}
                        onClick={() => patchStep(i, { fields: step.fields.filter((_, fj) => fj !== j) })}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <Label>Label</Label>
                        <Input value={field.label} data-testid={`input-field-label-${i}-${j}`}
                          onChange={(e) => patchField(i, j, { label: e.target.value, key: field.key || keyify(e.target.value) })} />
                      </div>
                      <div>
                        <Label>Type</Label>
                        <Select value={field.type} onValueChange={(v) => patchField(i, j, { type: v })}>
                          <SelectTrigger aria-label="Field type" data-testid={`select-field-type-${i}-${j}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-2 items-end">
                      <div>
                        <Label>Saves to</Label>
                        <Select value={field.mapTo} onValueChange={(v) => patchField(i, j, { mapTo: v })}>
                          <SelectTrigger aria-label="Saves to" data-testid={`select-field-mapto-${i}-${j}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MAPPINGS.map((m) => <SelectItem key={m} value={m}>{m === 'none' ? 'submission only' : m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Placeholder</Label>
                        <Input value={field.placeholder ?? ''} onChange={(e) => patchField(i, j, { placeholder: e.target.value })} />
                      </div>
                      <label className="flex items-center gap-2 pb-2 text-sm">
                        <Checkbox checked={field.required} onCheckedChange={(v) => patchField(i, j, { required: v === true })} />
                        Required
                      </label>
                    </div>
                    {(field.type === 'select' || field.type === 'multiselect') && (
                      <div>
                        <Label>Options — one per line: value | label | urgency (optional)</Label>
                        <Textarea rows={3} value={field.optionsText} data-testid={`input-field-options-${i}-${j}`}
                          onChange={(e) => patchField(i, j, { optionsText: e.target.value })}
                          placeholder={'urgent | Urgent issue | high\nquote | Request a quote'} />
                      </div>
                    )}
                    <div>
                      <Label>Scoring rules — one per line: points | reason | matching answer (optional)</Label>
                      <Textarea rows={2} value={field.scoringText}
                        onChange={(e) => patchField(i, j, { scoringText: e.target.value })}
                        placeholder={'30 | Urgent issue reported | urgent'} />
                    </div>
                  </div>
                ))}
                <Button size="sm" variant="outline" data-testid={`button-add-field-${i}`}
                  onClick={() => patchStep(i, {
                    fields: [...step.fields, { key: '', type: 'text', label: '', required: false, mapTo: 'none', optionsText: '', scoringText: '' }],
                  })}>
                  <Plus className="w-4 h-4 mr-1" /> Add field
                </Button>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" data-testid="button-add-step"
            onClick={() => setSteps((cur) => [...cur, { key: '', title: '', description: '', showIfField: '', showIfOp: 'eq', showIfValue: '', fields: [] }])}>
            <Plus className="w-4 h-4 mr-1" /> Add step
          </Button>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="ghost" onClick={props.onClose}>Cancel</Button>
            <Button
              disabled={props.saving || !name.trim() || !slug.trim()}
              onClick={() => props.onSave({ name: name.trim(), slug: slug.trim(), description: description.trim(), steps })}
              data-testid="button-save-form"
            >
              {props.saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save form
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Share + submissions dialogs
// ---------------------------------------------------------------------------

function ShareDialog({ form, onClose }: { form: SmartForm; onClose: () => void }) {
  const { toast } = useToast();
  const { data, isLoading } = useGetFormShareAssets(form.id);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied` });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Share "{form.name}"</DialogTitle></DialogHeader>
        {isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}
        {data && (
          <div className="space-y-4">
            {form.status !== 'published' && (
              <p className="text-sm text-amber-600">This form is not published yet — links will show nothing until you publish it.</p>
            )}
            <div>
              <Label>Hosted page link</Label>
              <div className="flex gap-2 mt-1">
                <Input readOnly value={data.hostedUrl} data-testid="input-hosted-url" />
                <Button size="icon" variant="outline" aria-label="Copy hosted link" onClick={() => copy(data.hostedUrl, 'Link')}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="outline" aria-label="Open hosted page" asChild>
                  <a href={data.hostedUrl} target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" /></a>
                </Button>
              </div>
            </div>
            <div>
              <Label>Embed on any website</Label>
              <div className="flex gap-2 mt-1">
                <Textarea readOnly rows={3} value={data.embedSnippet} className="font-mono text-xs" data-testid="input-embed-snippet" />
                <Button size="icon" variant="outline" aria-label="Copy embed snippet" onClick={() => copy(data.embedSnippet, 'Snippet')}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>QR code (links to the hosted page)</Label>
              <div
                className="mt-2 w-48 h-48 bg-white rounded-lg p-2 border"
                data-testid="img-form-qr"
                role="img"
                aria-label={`QR code for ${form.name}`}
                // Server-generated SVG from the qrcode library — safe, no user input.
                dangerouslySetInnerHTML={{ __html: data.qrSvg }}
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SubmissionsDialog({ form, onClose }: { form: SmartForm; onClose: () => void }) {
  const { data, isLoading } = useListFormSubmissions(form.id);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Submissions — {form.name}</DialogTitle></DialogHeader>
        {isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}
        {data && data.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No submissions yet.</p>}
        <div className="space-y-3">
          {(data ?? []).map((s) => (
            <Card key={s.id}>
              <CardContent className="py-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</span>
                  <Badge variant={s.dedupeOutcome === 'existing_lead' ? 'secondary' : 'default'}>
                    {s.dedupeOutcome === 'existing_lead' ? 'merged into existing lead' : 'new lead'}
                  </Badge>
                </div>
                <div className="font-mono text-xs text-muted-foreground break-all">
                  {Object.entries(s.answers as Record<string, unknown>)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`)
                    .join(' · ')}
                </div>
                {Object.keys(s.attribution as Record<string, unknown>).length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Source: {Object.entries(s.attribution as Record<string, string>).map(([k, v]) => `${k}=${v}`).join(', ')}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
