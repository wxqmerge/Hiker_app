import { Modal, Button } from './ui';

export default function SwapConfirmationModal({ pendingSwap, onConfirm, onCancel }) {
  if (!pendingSwap) return null;

  return (
    <Modal open onClose={onCancel} title="Swap Hikes?">
      <div className="space-y-3 text-sm text-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">1</div>
          <span><strong>{pendingSwap.sourceTrailName}</strong> moves to {pendingSwap.targetDayLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">2</div>
          <span><strong>{pendingSwap.targetTrailName}</strong> moves to {pendingSwap.sourceDayLabel}</span>
        </div>
      </div>
      <div className="flex gap-3 mt-6 justify-end">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm}>Swap</Button>
      </div>
    </Modal>
  );
}
