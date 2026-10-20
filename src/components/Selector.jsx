export default function Selector({ value, onChange, title, children, ...props }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="min-w-0 px-3 py-1.5 border border-gray-300 rounded-lg text-base focus:ring-green-500 focus:border-green-500 sm:text-lg"
      title={title}
      aria-label={title}
      {...props}
    >
      {children}
    </select>
  );
}
