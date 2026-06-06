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
  const barRef = null;

  const pct = (v) => ((v - min) / (max - min)) * 100;

  const handleMinChange = (e) => {
    const v = parseFloat(e.target.value);
    onChange({ ...value, min: Math.min(v, value.max - step) });
  };

  const handleMaxChange = (e) => {
    const v = parseFloat(e.target.value);
    onChange({ ...value, max: Math.max(v, value.min + step) });
  };

  return (
    <label className="flex flex-col gap-1 text-sm text-gray-600" title={tooltip ? tt(tooltip) : undefined}>
      <span className="font-medium">{label}</span>
      <div className="relative flex items-center h-6">
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
        {/* Min handle */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value.min}
          onChange={handleMinChange}
          className="absolute w-full h-2 opacity-0 cursor-pointer"
          style={{ zIndex: 2 }}
          aria-label="Minimum"
        />
        {/* Max handle */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value.max}
          onChange={handleMaxChange}
          className="absolute w-full h-2 opacity-0 cursor-pointer"
          style={{ zIndex: 1 }}
          aria-label="Maximum"
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
      <span className="text-xs text-gray-500">
        {value.min}{unit} – {value.max}{unit}
      </span>
    </label>
  );
}
