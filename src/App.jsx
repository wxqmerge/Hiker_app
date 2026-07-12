import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Calendar from './pages/Calendar';
import Home from './pages/Home';
import TrailDetail from './pages/TrailDetail';
import TrailManager from './pages/TrailManager';
import ScheduleBuilder from './pages/ScheduleBuilder';
import { useEffect } from 'react';
import { ensureScheduleWritable, request } from './api/client.js';
import { getApiBase } from './utils/url.js';
import { useToast } from './hooks/useToast';
import ToastContainer from './components/Toast.jsx';
import { getGroupName } from './utils/config';

function ApiKeySync() {
  const { search } = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const key = params.get('apikey');
    if (key) {
      localStorage.setItem('hiker-api-key', key);
    }
  }, [search]);
  return null;
}

function App() {
  const showToast = useToast();

  useEffect(() => {
    request('/api/schedule/group').then(data => {
      if (data?.name !== getGroupName()) {
        showToast('Failed to read schedule because different group', 'error');
      }
    }).catch(() => {
      showToast('Failed to connect to group server', 'error');
    });
  }, [showToast]);

  useEffect(() => {
    const apiBase = getApiBase();

    if (apiBase) {
      const host = new URL(apiBase).hostname;
      const prefix = host.split('.')[0];
      document.title = prefix;
    } else {
      document.title = 'hiker-app';
    }
  }, []);

  useEffect(() => {
    ensureScheduleWritable().then((result) => {
      if (result && !result.success) {
        const failed = result.results?.filter(r => !r.success);
        if (failed?.length) {
          showToast('Some exported_data files are not writable: ' + failed.map(r => r.file).join(', '), 'error');
        }
      }
    }).catch(() => {});
  }, [showToast]);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ApiKeySync />
      <Routes>
        <Route path="/" element={<Calendar />} />
        <Route path="/browse" element={<Home />} />
        <Route path="/trail/:id" element={<TrailDetail />} />
        <Route path="/trails" element={<TrailManager />} />
        <Route path="/schedule" element={<ScheduleBuilder />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
