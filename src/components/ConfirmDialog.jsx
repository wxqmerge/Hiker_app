import { useCallback } from 'react';

/**
 * Shared confirmation modal to replace native `confirm()` dialogs.
 *
 * Default usage renders a Cancel + Confirm button pair. Pass `actions`
 * (an array of { label, onClick, variant }) to render custom buttons
 * instead (e.g. a three-way "update / new / cancel" choice).
 *
 * `message` may contain newlines; they are preserved via whitespace-pre-line.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
  actions,
}) {
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onCancel();
  }, [onCancel]);

  const handleContentClick = useCallback((e) => {
    e.stopPropagation();
  }, []);

  if (!open) return null;

  const buttonBase = 'px-4 py-2 text-sm font-medium rounded-lg transition-colors';
  const cancelClass = `${buttonBase} text-gray-700 bg-gray-100 hover:bg-gray-200`;
  const confirmClass = danger
    ? `${buttonBase} text-white bg-red-600 hover:bg-red-700`
    : `${buttonBase} text-white bg-green-600 hover:bg-green-700`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleBackdropClick}>
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm mx-auto" onClick={handleContentClick} role="dialog" aria-modal="true" aria-label={title}>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>
        {message && <div className="text-sm text-gray-700 whitespace-pre-line">{message}</div>}
        <div className="flex gap-3 mt-6 justify-end flex-wrap">
          {actions ? (
            actions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className={
                  action.variant === 'danger'
                    ? `${buttonBase} text-white bg-red-600 hover:bg-red-700`
                    : action.variant === 'secondary'
                      ? cancelClass
                      : confirmClass
                }
              >
                {action.label}
              </button>
            ))
          ) : (
            <>
              <button onClick={onCancel} className={cancelClass}>{cancelLabel}</button>
              <button onClick={onConfirm} className={confirmClass}>{confirmLabel}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
