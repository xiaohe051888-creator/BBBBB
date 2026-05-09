import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginModal from '../components/admin/LoginModal';
import { getAdminToken } from '../services/api';
import AdminPage from './AdminPage';

const AdminEntryPage: React.FC = () => {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(() => getAdminToken());

  useEffect(() => {
    const handleAuthChanged = () => setToken(getAdminToken());
    window.addEventListener('auth_token_changed', handleAuthChanged);
    return () => window.removeEventListener('auth_token_changed', handleAuthChanged);
  }, []);

  if (token) return <AdminPage />;

  return (
    <LoginModal
      visible={true}
      onCancel={() => navigate('/login', { replace: true })}
      onSuccess={() => setToken(getAdminToken())}
    />
  );
};

export default AdminEntryPage;

