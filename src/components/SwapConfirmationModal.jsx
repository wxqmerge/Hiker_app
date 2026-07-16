import { useCallback } from 'react';

export default function SwapConfirmationModal({ pendingSwap, onConfirm, onCancel }) {
  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onCancel();
  }, [onCancel]);

  const handleContentClick = useCallback((e) => {
    e.stopPropagation();
  }, []);

  if (!pendingSwap) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleBackdropClick}>
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm mx-auto" onClick={handleContentClick}>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Swap Hikes?</h3>
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
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
          >
            Swap
          </button>
        </div>
      </div>
    </div>
  );
}
