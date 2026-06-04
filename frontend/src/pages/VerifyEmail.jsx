import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../services/api';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Missing verification token. Please open the link from your email.');
      return;
    }

    authService
      .verifyEmail(token)
      .then((response) => {
        setStatus('success');
        setMessage(response.data?.message || 'Email verified successfully.');

        setTimeout(() => {
          navigate('/login', {
            state: { success: 'Email verified successfully. You can now log in.' }
          });
        }, 1800);
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Email verification failed.');
      });
  }, [navigate, searchParams]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Email Verification</h1>
        <p
          style={{
            ...styles.message,
            color: status === 'error' ? '#7f1d1d' : '#065f46',
            backgroundColor: status === 'error' ? '#fee2e2' : '#d1fae5',
            borderColor: status === 'error' ? '#fecaca' : '#a7f3d0'
          }}
        >
          {message}
        </p>
        <Link to="/login" style={styles.link}>Go to Login</Link>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6'
  },
  card: {
    width: '100%',
    maxWidth: '460px',
    backgroundColor: '#fff',
    borderRadius: '10px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    padding: '2rem'
  },
  title: {
    marginTop: 0,
    marginBottom: '1rem',
    color: '#1f2937'
  },
  message: {
    margin: 0,
    padding: '0.9rem 1rem',
    borderRadius: '8px',
    border: '1px solid',
    marginBottom: '1.2rem'
  },
  link: {
    color: '#2563eb',
    fontWeight: 600,
    textDecoration: 'none'
  }
};

export default VerifyEmail;
