import { CURRENT_YEAR } from '../utils/constants';
import Selector from './Selector';

export default function YearSelector({ selectedYear, onChange, title }) {
  const years = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

  return (
    <Selector value={selectedYear} onChange={onChange} title={title}>
      {years.map(year => (
        <option key={year} value={year}>{String(year).slice(-2)}</option>
      ))}
    </Selector>
  );
}
