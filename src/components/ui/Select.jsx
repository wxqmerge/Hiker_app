export default function Select({ className = '', children, ...props }) {
  return (
    <select
      className={`px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-green-500 focus:border-green-500 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
