import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ImageOff } from 'lucide-react';

export interface LightboxPhoto {
  src: string;
  alt?: string;
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function PhotoLightbox({ photos, index, onClose, onNavigate }: PhotoLightboxProps) {
  const [zoomed, setZoomed] = useState(false);
  const [failedSrcs, setFailedSrcs] = useState<ReadonlySet<string>>(new Set());

  const goPrev = useCallback(() => {
    setZoomed(false);
    onNavigate((index - 1 + photos.length) % photos.length);
  }, [index, photos.length, onNavigate]);

  const goNext = useCallback(() => {
    setZoomed(false);
    onNavigate((index + 1) % photos.length);
  }, [index, photos.length, onNavigate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goPrev, goNext]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const photo = photos[index];
  if (!photo) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 z-10" onClick={e => e.stopPropagation()}>
        <div className="text-white/80 text-sm font-mono">{index + 1} / {photos.length}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={zoomed ? 'Zoom out' : 'Zoom in'}
            onClick={() => setZoomed(z => !z)}
            className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            {zoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div
        className={`max-w-full max-h-full flex items-center justify-center ${zoomed ? 'overflow-auto' : ''} w-full h-full p-12`}
        onClick={e => e.stopPropagation()}
      >
        {failedSrcs.has(photo.src) ? (
          <div
            data-testid="lightbox-photo-unavailable"
            className="flex flex-col items-center justify-center gap-3 text-white/70 border-2 border-dashed border-white/20 rounded-2xl px-10 py-14"
          >
            <ImageOff className="w-10 h-10 opacity-70" aria-hidden="true" />
            <span className="text-sm font-bold uppercase tracking-widest">Photo unavailable</span>
          </div>
        ) : (
          <img
            src={photo.src}
            alt={photo.alt || `Photo ${index + 1}`}
            onClick={() => setZoomed(z => !z)}
            onError={() => setFailedSrcs(prev => {
              if (prev.has(photo.src)) return prev;
              const next = new Set(prev);
              next.add(photo.src);
              return next;
            })}
            className={
              zoomed
                ? 'max-w-none cursor-zoom-out'
                : 'max-w-full max-h-full object-contain cursor-zoom-in'
            }
            style={zoomed ? { width: '160%' } : undefined}
          />
        )}
      </div>

      {/* Nav arrows */}
      {photos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={e => { e.stopPropagation(); goPrev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={e => { e.stopPropagation(); goNext(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
