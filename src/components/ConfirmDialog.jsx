import { Modal, Button } from './ui';

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
  const confirmVariant = danger ? 'danger' : 'primary';

  return (
    <Modal open={open} onClose={onCancel} title={title}>
      {message && <div className="text-sm text-gray-700 whitespace-pre-line">{message}</div>}
      <div className="flex gap-3 mt-6 justify-end flex-wrap">
        {actions ? (
          actions.map((action) => (
            <Button
              key={action.label}
              onClick={action.onClick}
              variant={action.variant === 'danger' ? 'danger' : action.variant === 'secondary' ? 'secondary' : confirmVariant}
            >
              {action.label}
            </Button>
          ))
        ) : (
          <>
            <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
            <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
          </>
        )}
      </div>
    </Modal>
  );
}
