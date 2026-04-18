/**
 * Modal Styles
 */
export const modalStyles = {
  overlay: 'fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4',
  container: 'bg-card rounded-xl shadow-xl w-full max-h-[90vh] overflow-hidden flex flex-col',
  sizes: {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  },
  header: 'flex items-center justify-between px-6 py-4 border-b border-border',
  title: 'text-lg font-semibold text-foreground',
  closeButton: 'p-1 text-muted hover:text-foreground rounded-lg hover:bg-muted/20 transition-colors',
  content: 'p-6 overflow-y-auto',
  footer: 'px-6 py-4 border-t border-border flex justify-end gap-3',
};
