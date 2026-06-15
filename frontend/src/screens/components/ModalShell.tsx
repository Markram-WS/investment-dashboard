import React, { useEffect, useRef, useCallback } from 'react';

interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  closeOnBackdrop?: boolean;
  backdropClassName?: string;
  zIndex?: number;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ModalShell({
  open,
  onClose,
  children,
  title,
  closeOnBackdrop = true,
  backdropClassName = 'bg-black/50',
  zIndex = 50,
}: ModalShellProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && contentRef.current) {
        const focusable = contentRef.current.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR,
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    requestAnimationFrame(() => {
      if (contentRef.current) {
        const firstFocusable = contentRef.current.querySelector<HTMLElement>(
          FOCUSABLE_SELECTOR,
        );
        if (firstFocusable) firstFocusable.focus();
      }
    });

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center animate-modal-backdrop ${backdropClassName}`}
      style={{ zIndex }}
      onClick={() => {
        if (closeOnBackdrop) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div ref={contentRef} className="animate-modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
