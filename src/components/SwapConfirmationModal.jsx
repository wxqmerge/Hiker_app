import { Modal, Button } from './ui';

export default function SwapConfirmationModal({ pendingSwap, onConfirm, onCancel }) {
  if (!pendingSwap) return null;

  // No real source slot (drag from Available Hikes) or duplicate-copy: the
  // occupant is replaced, not moved back. Say so instead of promising a swap.
  const isReplace = pendingSwap.duplicate
    || pendingSwap.sourceDay === null
    || pendingSwap.sourceDay === undefined;

  return (
    <Modal open onClose={onCancel} title={isReplace ? 'Replace Hike?' : 'Swap Hikes?'}>
      <div className="space-y-3 text-sm text-gray-700">
        {isReplace ? (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold shrink-0">!</div>
            <span>
              <strong>{pendingSwap.sourceTrailName}</strong> replaces <strong>{pendingSwap.targetTrailName}</strong> on {pendingSwap.targetDayLabel}.
              {pendingSwap.duplicate ? ' The original stays where it is.' : ` ${pendingSwap.targetTrailName} will be removed.`}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">1</div>
              <span><strong>{pendingSwap.sourceTrailName}</strong> moves to {pendingSwap.targetDayLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">2</div>
              <span><strong>{pendingSwap.targetTrailName}</strong> moves to {pendingSwap.sourceDayLabel}</span>
            </div>
          </>
        )}
      </div>
      <div className="flex gap-3 mt-6 justify-end">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm}>{isReplace ? 'Replace' : 'Swap'}</Button>
      </div>
    </Modal>
  );
}
