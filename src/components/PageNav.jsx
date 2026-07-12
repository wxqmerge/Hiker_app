import { NavLink } from 'react-router-dom';
import { getGroupName } from '../utils/config';

const links = [
  { to: '/', label: 'Calendar' },
  { to: '/browse', label: 'Browse Trails' },
  { to: '/trails', label: 'Trail Manager' },
  { to: '/schedule', label: 'Schedule Builder' },
];

export default function PageNav() {
  const groupName = getGroupName();

  return (
    <nav className="flex items-baseline gap-2 mb-6">
      {links.map((link) => (
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
