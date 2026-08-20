// Tiny icon wrapper so stroke-width/size stay consistent across the app.
// Pass a single `path` (d attribute) or multiple <path> children.
export default function Icon({ size = 'w-4 h-4', className = '', path, children, ...props }) {
  return (
    <svg className={`${size} ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...props}>
      {path
        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
        : children}
    </svg>
  );
}
