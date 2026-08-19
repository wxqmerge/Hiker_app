export default function EmptyState({ icon, title, message, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-8 ${className}`}>
      {icon && <div className="text-gray-400 mb-3">{icon}</div>}
      {title && <h3 className="text-sm font-medium text-gray-700">{title}</h3>}
      {message && <p className="mt-1 text-sm text-gray-500">{message}</p>}
    </div>
  );
}
