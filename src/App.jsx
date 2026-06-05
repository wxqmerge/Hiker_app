import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import TrailDetail from './pages/TrailDetail';
import TrailManager from './pages/TrailManager';
import ScheduleBuilder from './pages/ScheduleBuilder';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trail/:id" element={<TrailDetail />} />
        <Route path="/trails" element={<TrailManager />} />
        <Route path="/schedule" element={<ScheduleBuilder />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
