import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useFeedbackToast from '../hooks/useFeedbackToast';

import '../../styles/copilot-register.css';

const Register = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  useFeedbackToast(error, 'error');
  useFeedbackToast(success, 'success');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await register(username, email, password, fullName, phone);
      setSuccess(response?.message || 'Registration successful. You can now log in.');
      navigate('/login', {
        state: {
          success: response?.message || 'Registration successful. You can now log in.'
        }
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.body.classList.add('copilot-register-bg');
    return () => document.body.classList.remove('copilot-register-bg');
  }, []);

  return (
    <div className="copilot-register-container">
      <div className="copilot-register-card">
        <h1 className="copilot-register-title">Registration Disabled</h1>
        <p className="copilot-register-subtitle">Please contact the admin to create an account.</p>
        <p className="copilot-register-login-link">
          <Link to="/login">Back to Login</Link>
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f3f4f6'
  },
  card: {
    backgroundColor: 'white',
    padding: '3rem',
    borderRadius: '0.5rem',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    width: '100%',
    maxWidth: '400px'
  },
  title: {
    textAlign: 'center',
    marginBottom: '0.5rem',
    color: '#1f2937'
  },
  subtitle: {
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: '2rem'
  },
  formGroup: {
    marginBottom: '1rem'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#7f1d1d',
    padding: '0.75rem',
    borderRadius: '0.375rem',
    marginBottom: '1rem',
    border: '1px solid #fecaca'
  },
  success: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '0.75rem',
    borderRadius: '0.375rem',
    marginBottom: '1rem',
    border: '1px solid #a7f3d0'
  },
  submitBtn: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.3s'
  },
  loginLink: {
    textAlign: 'center',
    marginTop: '1.5rem',
    color: '#6b7280'
  },
  link: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: '600'
  }
};

export default Register;
