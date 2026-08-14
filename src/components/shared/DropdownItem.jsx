const DropdownItem = ({ onClick, disabled, locked, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
      disabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'
    }`}
  >
    <span>{children}</span>
    {locked && <span className="text-xs">locked</span>}
  </button>
);

export default DropdownItem;
