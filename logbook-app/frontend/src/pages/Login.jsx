import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [demoUsers, setDemoUsers] = useState([]);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    client.get('/auth/users').then((res) => setDemoUsers(res.data)).catch(() => {});
  }, []);

  async function handleLogin(username) {
    setError('');
    try {
      await login(username);
      navigate('/');
    } catch (err) {
      setError('Login failed. Is the backend running?');
    }
  }

  return (
    <div className="centered-card">
      <h1>Digital Logbook</h1>
      <p className="muted">
        Demo authentication — pick a demo account. In production this would be
        the college's real SSO / student login.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="demo-user-list">
        {demoUsers.map((u) => (
          <button key={u.username} className="btn btn-primary" onClick={() => handleLogin(u.username)}>
            Sign in as {u.username} {u.role === 'admin' ? '(college admin)' : '(student)'}
          </button>
        ))}
        {demoUsers.length === 0 && <p className="muted">Loading demo accounts…</p>}
      </div>
    </div>
  );
}
