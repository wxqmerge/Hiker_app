const VARIANTS = {
  primary: 'bg-green-600 hover:bg-green-700 text-white',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
  icon: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
};

const SIZES = {
  sm: 'px-2.5 py-1 text-sm',
  md: 'px-4 py-2 text-sm',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
