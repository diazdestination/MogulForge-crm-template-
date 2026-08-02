import ContactSelect from '@/components/contact-select';
import { Loader2, Plus, Home, MapPin, Edit, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { canWrite } from '@/lib/permissions';
import { useGetMe } from '@workspace/api-client-react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useListProperties, useCreateProperty, useUpdateProperty, getListPropertiesQueryKey, useListContacts, listProperties, type Property } from '@workspace/api-client-react';

export default function Properties() {
  const { data: properties, isLoading, dataUpdatedAt } = useListProperties();
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();

  // Extra pages loaded as the rep scrolls past the first server page (200 rows).
  const PAGE_SIZE = 200;
  const [extraProperties, setExtraProperties] = useState<Property[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const loadTokenRef = useRef(0);
  useEffect(() => {
    // First page refetched: drop stale extra pages.
    loadTokenRef.current += 1;
    setExtraProperties([]);
    setReachedEnd(false);
    setLoadingMore(false);
  }, [dataUpdatedAt]);

  const firstPage = properties ?? [];
  const hasMore = !reachedEnd && firstPage.length >= PAGE_SIZE;
  const loadMore = useCallback(async () => {
    if (loadingMore || reachedEnd || firstPage.length < PAGE_SIZE) return;
    const token = loadTokenRef.current;
    setLoadingMore(true);
    try {
      const next = await listProperties({
        offset: firstPage.length + extraProperties.length,
      });
      if (token !== loadTokenRef.current) return; // first page refetched mid-flight
      setExtraProperties(prev => {
        const seen = new Set([...firstPage, ...prev].map(p => p.id));
        return [...prev, ...next.filter(p => !seen.has(p.id))];
      });
      if (next.length < PAGE_SIZE) setReachedEnd(true);
    } catch {
      // Leave state untouched; scrolling again retries.
    } finally {
      if (token === loadTokenRef.current) setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingMore, reachedEnd, firstPage, extraProperties.length]);

  const allProperties = useMemo(() => [...firstPage, ...extraProperties], [firstPage, extraProperties]);
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!hasMore) return;
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) loadMore();
  };

  const canEdit = canWrite(me?.role);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<any>(null);

  const openEdit = (prop: any) => {
    setEditingProperty(prop);
    setIsFormOpen(true);
  };

  const openCreate = () => {
    setEditingProperty(null);
    setIsFormOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <header className="px-4 py-3 md:px-6 md:py-4 border-b border-border flex items-center justify-between bg-card shrink-0 gap-4 sticky top-0 z-10">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Properties</h1>
          <p className="hidden md:block text-sm text-muted-foreground">Service locations and structures.</p>
        </div>
        <div>
          {canEdit && (
            <button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 md:px-3 md:py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-transform active:scale-95 shadow-sm shadow-primary/20">
              <Plus className="w-4 h-4" /> <span className="hidden md:inline">Add Property</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6" onScroll={handleScroll}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {allProperties.map(prop => (
              <div key={prop.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative group cursor-pointer active:scale-[0.98] md:active:scale-100 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Home className="w-6 h-6" />
                  </div>
                  {canEdit && (
                    <button onClick={(e) => { e.stopPropagation(); openEdit(prop); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors active:scale-95 shrink-0">
                      <Edit className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <h3 className="font-bold text-foreground text-lg leading-tight mb-1">{prop.addressLine1}</h3>
                {prop.addressLine2 && <p className="text-sm text-muted-foreground font-medium mb-1">{prop.addressLine2}</p>}
                <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mt-1 mb-6">
                  <MapPin className="w-4 h-4 shrink-0 opacity-70" />
                  <span>{prop.city}, {prop.state} {prop.postalCode}</span>
                </div>
                
                <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-md">
                    {prop.propertyType || 'Residential'}
                  </span>
                  {prop.contactId && (
                    <span className="text-[10px] bg-secondary/15 text-secondary px-2.5 py-1 rounded-md uppercase tracking-widest font-bold">
                      Linked
                    </span>
                  )}
                </div>
              </div>
            ))}
            {loadingMore && (
              <div className="col-span-full flex justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!allProperties.length && (
              <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-2xl bg-muted/10">
                No properties found.
              </div>
            )}
          </div>
        )}
      </div>

      {isFormOpen && (
        <PropertyFormModal 
          property={editingProperty} 
          onClose={() => setIsFormOpen(false)} 
        />
      )}
    </div>
  );
}

function PropertyFormModal({ property, onClose }: { property?: any, onClose: () => void }) {
  const [address1, setAddress1] = useState(property?.addressLine1 || '');
  const [address2, setAddress2] = useState(property?.addressLine2 || '');
  const [city, setCity] = useState(property?.city || '');
  const [state, setState] = useState(property?.state || '');
  const [zip, setZip] = useState(property?.postalCode || '');
  const [contactId, setContactId] = useState(property?.contactId || '');
  const [propType, setPropType] = useState(property?.propertyType || 'residential');
  
  const createProperty = useCreateProperty();
  const updateProperty = useUpdateProperty();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const isSubmitting = createProperty.isPending || updateProperty.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address1 || !city || !state || !zip) return;

    const data = {
      addressLine1: address1,
      addressLine2: address2 || undefined,
      city,
      state,
      postalCode: zip,
      contactId: contactId || undefined,
      propertyType: propType
    };

    const handleSaveError = (error: unknown) => {
      const serverMessage =
        error && typeof error === 'object' && 'data' in error
          ? (error as { data?: { error?: string } }).data?.error
          : undefined;
      toast({
        variant: 'destructive',
        title: property ? 'Property not saved' : 'Property not created',
        description: serverMessage || 'Saving the property failed. Check your connection and try again.',
      });
    };

    if (property) {
      updateProperty.mutate({ id: property.id, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
          onClose();
        },
        onError: handleSaveError,
      });
    } else {
      createProperty.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPropertiesQueryKey() });
          onClose();
        },
        onError: handleSaveError,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-card border-t md:border border-border shadow-2xl md:rounded-2xl rounded-t-2xl w-full max-w-md overflow-hidden mt-auto md:my-auto animate-in slide-in-from-bottom-8 md:slide-in-from-bottom-0 md:zoom-in-95 duration-300 pb-safe md:pb-0">
        <div className="p-4 md:p-6 border-b border-border flex justify-between items-center bg-muted/20">
          <h2 className="text-lg font-bold text-foreground">{property ? 'Edit Property' : 'New Property'}</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground active:scale-95 transition-all">
             <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 md:space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest">Address Line 1 *</label>
            <input required className="w-full bg-background border border-border rounded-xl px-4 py-3 md:py-2.5 text-base md:text-sm focus:ring-2 focus:ring-primary focus:outline-none shadow-sm transition-all" value={address1} onChange={e => setAddress1(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest">Address Line 2</label>
            <input className="w-full bg-background border border-border rounded-xl px-4 py-3 md:py-2.5 text-base md:text-sm focus:ring-2 focus:ring-primary focus:outline-none shadow-sm transition-all" value={address2} onChange={e => setAddress2(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest">City *</label>
              <input required className="w-full bg-background border border-border rounded-xl px-4 py-3 md:py-2.5 text-base md:text-sm focus:ring-2 focus:ring-primary focus:outline-none shadow-sm transition-all" value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest">State *</label>
                <input required className="w-full bg-background border border-border rounded-xl px-4 py-3 md:py-2.5 text-base md:text-sm focus:ring-2 focus:ring-primary focus:outline-none shadow-sm transition-all" value={state} onChange={e => setState(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest">Zip *</label>
                <input required className="w-full bg-background border border-border rounded-xl px-4 py-3 md:py-2.5 text-base md:text-sm focus:ring-2 focus:ring-primary focus:outline-none font-mono shadow-sm transition-all" value={zip} onChange={e => setZip(e.target.value)} />
              </div>
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest">Property Type</label>
            <select className="w-full bg-background border border-border rounded-xl px-4 py-3 md:py-2.5 text-base md:text-sm focus:ring-2 focus:ring-primary focus:outline-none shadow-sm transition-all appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2224%22%20height%3D%2224%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010L12%2015L17%2010%22%20stroke%3D%22%236B7280%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.5rem_center] bg-no-repeat pr-10" value={propType} onChange={e => setPropType(e.target.value)}>
              <option value="residential">Residential</option>
              <option value="commercial">Commercial</option>
              <option value="multi-family">Multi-Family</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest">Link to Contact</label>
            <ContactSelect value={contactId} onChange={setContactId} />
          </div>
          
          <div className="pt-6 md:pt-4 flex flex-col-reverse md:flex-row justify-end gap-3">
            <button type="button" onClick={onClose} className="w-full md:w-auto px-4 py-3 md:py-2 text-base md:text-sm font-semibold hover:bg-muted rounded-xl border border-transparent hover:border-border transition-all active:scale-95">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="w-full md:w-auto bg-primary text-primary-foreground px-6 py-3 md:py-2 rounded-xl text-base md:text-sm font-bold shadow-sm shadow-primary/20 hover:shadow-primary/40 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center min-w-[120px]">
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Property'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
