const PillButton = ({ active, onClick, children, title, color = 'green', ariaLabel, ariaPressed }) => {
  const activeClass = color === 'blue' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white';
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${
        active ? activeClass : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
    >
      {children}
    </button>
  );
};

export default PillButton;
