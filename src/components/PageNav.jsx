import { NavLink } from 'react-router-dom';
import { getGroupName } from '../utils/config';
import { NAV_LINKS } from '../utils/constants';

export default function PageNav() {
  const groupName = getGroupName();

  return (
    <nav className="flex items-baseline gap-2 mb-6">
      {NAV_LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            isActive
              ? 'text-xl font-bold text-gray-900'
              : 'text-sm text-green-700 hover:text-green-900 font-medium'
          }
        >
          {link.label}
        </NavLink>
      ))}
      {groupName && (
        <span className="text-2xl font-black text-green-800 ml-4 uppercase tracking-tight">
          {groupName}
        </span>
      )}
    </nav>
  );
}
