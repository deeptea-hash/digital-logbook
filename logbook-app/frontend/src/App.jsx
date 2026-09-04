import React from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Templates from './pages/Templates';
import TemplateDesigner from './pages/TemplateDesigner';
import FillRecord from './pages/FillRecord';
import MyRecords from './pages/MyRecords';

function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <nav className="navbar">
      <Link to="/" className="brand">Digital Logbook</Link>
      <Link to="/">Templates</Link>
      <Link to="/my-records">My records</Link>
      <span className="spacer" />
      <span className="muted">{user.username} ({user.role})</span>
      <button className="btn btn-link" onClick={() => { logout(); navigate('/login'); }}>Sign out</button>
    </nav>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Nav />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Templates /></Protected>} />
        <Route path="/templates/:templateId/design" element={<Protected><TemplateDesigner /></Protected>} />
        <Route path="/records/:recordId" element={<Protected><FillRecord /></Protected>} />
        <Route path="/my-records" element={<Protected><MyRecords /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
