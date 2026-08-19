export default function Badge({ className = '', children, ...props }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${className}`} {...props}>
      {children}
    </span>
  );
}
