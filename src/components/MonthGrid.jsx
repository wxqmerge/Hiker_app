/**
 * A shared component for rendering a grid or list of months.
 * @param {Object} props
 * @param {string[]} props.months - The array of month names/abbreviations to map over (e.g., MONTH_NAMES, MONTH_ABBR).
 * @param {function} props.renderMonth - A function that returns the UI for a single month. 
 *                                      Receives (month, index) as arguments.
 * @param {string} [props.className] - Optional container class.
 */
export default function MonthGrid({ months, renderMonth, className = '' }) {
  return (
    <div className={className}>
      {months.map((month, idx) => renderMonth(month, idx))}
    </div>
  );
}
