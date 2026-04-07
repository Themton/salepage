import { HashRouter, Routes, Route } from 'react-router-dom';
import SalePage from './components/SalePage';
import AdminDashboard from './components/AdminDashboard';
import PageEditor from './components/PageEditor';
import './index.css';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/:pageId" element={<PageEditor />} />
        <Route path="/:slug" element={<SalePage />} />
        <Route path="/" element={<AdminDashboard />} />
      </Routes>
    </HashRouter>
  );
}
