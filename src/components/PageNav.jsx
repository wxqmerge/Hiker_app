import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Browse Trails' },
  { to: '/trails', label: 'Trail Manager' },
  { to: '/schedule', label: 'Schedule Builder' },
];

export default function PageNav() {
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
    </nav>
  );
}
