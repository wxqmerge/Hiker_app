import { useRef, useCallback, useEffect } from 'react';
import { useTooltips } from '../hooks/useTooltips';

export default function DualRangeSlider({
  min,
  max,
  step,
  value,
  onChange,
  unit,
  tooltip,
  label,
}) {
  const { title: tt } = useTooltips();
  const containerRef = useRef(null);
  const activeHandleRef = useRef(null);

  const pct = (v) => ((v - min) / (max - min)) * 100;

  const getValueFromPosition = useCallback((clientX) => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const rawValue = min + ratio * (max - min);
    return Math.round(rawValue / step) * step;
  }, [min, max, step]);

  const handleMouseDown = useCallback((e) => {
    const valueFromPos = getValueFromPosition(e.clientX);
    if (valueFromPos === null) return;

    const distToMin = Math.abs(valueFromPos - value.min);
    const distToMax = Math.abs(valueFromPos - value.max);

    if (distToMin <= distToMax) {
      activeHandleRef.current = 'min';
      const newValue = Math.max(min, Math.min(value.max - step, valueFromPos));
      onChange({ ...value, min: newValue });
    } else {
      activeHandleRef.current = 'max';
      const newValue = Math.min(max, Math.max(value.min + step, valueFromPos));
      onChange({ ...value, max: newValue });
    }

    e.preventDefault();
  }, [value, min, max, step, onChange, getValueFromPosition]);

  const handleMouseMove = useCallback((e) => {
    if (!activeHandleRef.current) return;
    const valueFromPos = getValueFromPosition(e.clientX);
    if (valueFromPos === null) return;

    if (activeHandleRef.current === 'min') {
      const newValue = Math.max(min, Math.min(value.max - step, valueFromPos));
      onChange({ ...value, min: newValue });
    } else {
      const newValue = Math.min(max, Math.max(value.min + step, valueFromPos));
      onChange({ ...value, max: newValue });
    }
  }, [value, min, max, step, onChange, getValueFromPosition]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      activeHandleRef.current = null;
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, []);

  return (
    <label className="flex flex-col gap-1 text-sm text-gray-600" title={tooltip ? tt(tooltip) : undefined} role="group" aria-label={tooltip}>
      <span className="font-medium">{label}</span>
      <div
        ref={containerRef}
        className="relative flex items-center h-6 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        {/* Bar background */}
        <div className="absolute w-full h-2 rounded bg-gray-200" />
        {/* Gradient fill between handles */}
        <div
          className="absolute h-2 rounded"
          style={{
            left: `${pct(value.min)}%`,
            width: `${pct(value.max) - pct(value.min)}%`,
            background: 'linear-gradient(to right, #22c55e, #3b82f6)',
          }}
        />
        {/* Green min circle */}
        <div
          className="absolute w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow pointer-events-none"
          style={{ left: `calc(${pct(value.min)}% - 8px)` }}
        />
        {/* Blue max circle */}
        <div
          className="absolute w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow pointer-events-none"
          style={{ left: `calc(${pct(value.max)}% - 8px)` }}
        />
      </div>
      <span className="text-xs text-gray-500" aria-live="polite">
        {value.min}{unit} – {value.max}{unit}
      </span>
    </label>
  );
}
