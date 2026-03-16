import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import TrailDetail from './pages/TrailDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trail/:id" element={<TrailDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
