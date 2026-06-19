// src/components/ResetPassword.jsx
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('pending'); // 'pending', 'success', 'error'

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { data, error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setStatus('error');
      setMessage(`Error: ${error.message}`);
    } else if (data) {
      setStatus('success');
      setMessage('Password updated successfully! Redirecting you back...');
      setTimeout(() => {
        // Strip out hash tokens and push user to home base
        window.location.href = window.location.origin;
      }, 2500);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F8F0', fontFamily: 'sans-serif', padding: '16px' }}>
      <div style={{ background: '#ffffff', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', maxWidth: '400px', width: '100%', border: '1px solid #E2E8F0' }}>
        <h2 style={{ color: '#1F3D2B', marginTop: 0, marginBottom: '8px', fontSize: '24px' }}>Reset Your Password</h2>
        <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '24px' }}>Please choose a strong new password for your account.</p>
        
        {status !== 'success' && (
          <form onSubmit={handlePasswordReset}>
            <input
              type="password"
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ display: 'block', width: '100%', padding: '12px', marginBottom: '16px', borderRadius: '6px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
            />
            <button 
              type="submit" 
              disabled={loading} 
              style={{ width: '100%', padding: '12px', background: '#1F3D2B', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Updating Security Records...' : 'Update Password'}
            </button>
          </form>
        )}
        
        {message && (
          <p style={{ marginTop: '16px', padding: '12px', borderRadius: '6px', fontSize: '14px', fontWeight: '500', textAlign: 'center', backgroundColor: status === 'success' ? '#ECFDF5' : '#FEF2F2', color: status === 'success' ? '#047857' : '#B91C1C' }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}