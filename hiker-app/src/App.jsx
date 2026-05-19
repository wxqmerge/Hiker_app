import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import TrailDetail from './pages/TrailDetail';
import ScheduleBuilder from './pages/ScheduleBuilder';

function App() {
  return (
    <MemoryRouter initialEntries={['/']} initialIndex={0}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trail/:id" element={<TrailDetail />} />
        <Route path="/schedule" element={<ScheduleBuilder />} />
      </Routes>
    </MemoryRouter>
  );
}

export default App;
