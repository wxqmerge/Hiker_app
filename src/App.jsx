import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Calendar from './pages/Calendar';
import LoadingSpinner from './components/LoadingSpinner';
import { useEffect, useState, lazy, Suspense } from 'react';

const Home = lazy(() => import('./pages/Home'));
const TrailDetail = lazy(() => import('./pages/TrailDetail'));
const TrailManager = lazy(() => import('./pages/TrailManager'));
const ScheduleBuilder = lazy(() => import('./pages/ScheduleBuilder'));

const PageLazy = ({ children }) => (
  <Suspense fallback={<LoadingSpinner />}>
    {children}
  </Suspense>
);
import { ensureScheduleWritable, request } from './api/client.js';
import { getApiBase } from './utils/url.js';
import { useToast } from './hooks/useToast';
import ToastContainer from './components/Toast.jsx';
import { setGroupConfig, getGroupName } from './utils/config';

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
  const [isConfigLoaded, setIsConfigLoaded] = useState(!!getGroupName());

  useEffect(() => {
    request('/api/schedule/group').then(data => {
      if (data && data.name && data.hikeDays) {
        setGroupConfig({
          name: data.name,
          hikeDays: data.hikeDays
        });
      } else {
        showToast('Server configuration missing', 'error');
      }
    }).catch(() => {
      showToast('Failed to connect to group server', 'error');
    }).finally(() => {
      setIsConfigLoaded(true);
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

  if (!isConfigLoaded) {
    return <LoadingSpinner message="Loading group configuration..." />;
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ApiKeySync />
      <Routes>
        <Route path="/" element={<Calendar />} />
        <Route path="/browse" element={<PageLazy><Home /></PageLazy>} />
        <Route path="/trail/:id" element={<PageLazy><TrailDetail /></PageLazy>} />
        <Route path="/trails" element={<PageLazy><TrailManager /></PageLazy>} />
        <Route path="/schedule" element={<PageLazy><ScheduleBuilder /></PageLazy>} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
