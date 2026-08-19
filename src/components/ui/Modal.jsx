import { useCallback } from 'react';

export default function Modal({ open, onClose, title, children, className = '', maxWidth = 'max-w-sm' }) {
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleContentClick = useCallback((e) => {
    e.stopPropagation();
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleBackdropClick}>
      <div
        className={`bg-white rounded-xl shadow-2xl p-6 ${maxWidth} mx-auto ${className}`}
        onClick={handleContentClick}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
