import { Link } from 'react-router-dom';

export default function Header() {
  return (
    <div className="bg-white border-b border-gray-200 px-4 py-2">
      <div className="container mx-auto flex items-center justify-between">
        <Link to="/" className="text-green-700 hover:text-green-900 font-medium text-sm">
          ← Browse Trails
        </Link>
        <Link to="/schedule" className="text-green-700 hover:text-green-900 font-medium text-sm">
          Schedule Builder
        </Link>
      </div>
    </div>
  );
}
