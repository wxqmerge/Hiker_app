const SIZES = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-2',
};

export default function Spinner({ size = 'md', className = '' }) {
  return (
    <div
      className={`animate-spin rounded-full border-green-600 border-t-transparent ${SIZES[size] || SIZES.md} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
