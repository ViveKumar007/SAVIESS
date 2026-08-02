import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff, ShieldAlert, CheckCircle } from 'lucide-react';
import { API } from '../api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const userString = localStorage.getItem('user');
    if (token && userString) {
      const user = JSON.parse(userString);
      redirectUser(user.role);
    }
  }, []);

  const redirectUser = (role) => {
    if (role === 'rhp') {
      navigate('/rhp-dashboard');
    } else if (role === 'field_officer') {
      navigate('/fo-dashboard');
    } else if (role === 'program_director') {
      navigate('/pd-dashboard');
    } else if (role === 'field_manager') {
      navigate('/fm-dashboard');
    } else if (role === 'super_admin') {
      navigate('/admin-dashboard');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API}/auth/login`, {
        email,
        password
      });

      if (response.data.success) {
        setSuccess(true);
        const { accessToken, user } = response.data;
        
        // Save to local storage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('user', JSON.stringify(user));

        setTimeout(() => {
          redirectUser(user.role);
        }, 1000);
      }
    } catch (err) {
      console.error('Login request error:', err);
      setError(err.response?.data?.error || 'Unable to connect to service. Please check backend.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative px-4 bg-slate-900">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-teal-500 rounded-full mix-blend-multiply filter blur-2xl opacity-10 animate-blob"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-2xl opacity-10 animate-blob animation-delay-2000"></div>

      {/* Main Glass Card */}
      <div className="w-full max-w-md p-8 rounded-2xl shadow-2xl glass-panel-dark relative z-10 border border-slate-700/50">
        
        {/* Branding header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-teal-500/10 rounded-xl mb-3 border border-teal-500/20">
            <span className="text-teal-400 font-extrabold text-2xl tracking-wider">VEP</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Vision Entrepreneur Platform</h2>
          <p className="text-slate-400 text-xs mt-1">A joint initiative: Preheal, SAVIESS, & VisionSpring</p>
        </div>

        {/* Form status notices */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start space-x-3 text-rose-300 text-sm">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-start space-x-3 text-teal-300 text-sm">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>Success! Redirecting to workspace...</span>
          </div>
        )}

        {/* Input Fields */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email Address</label>
            <input
              type="email"
              required
              disabled={loading || success}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm transition-all"
              placeholder="name@saviess.org"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={loading || success}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm transition-all pr-11"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-3.5 rounded-xl bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-slate-900 font-bold text-sm shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center my-5">
          <div className="flex-1 border-t border-slate-700/50"></div>
          <span className="px-3 text-xs text-slate-500 font-medium">OR</span>
          <div className="flex-1 border-t border-slate-700/50"></div>
        </div>

        {/* Register as RHP */}
        <button
          onClick={() => navigate('/register-rhp')}
          className="w-full py-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:text-indigo-200 font-semibold text-sm transition-all flex items-center justify-center space-x-2"
        >
          <span>Register as RHP</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
        </button>

      </div>
    </div>
  );
};

export default Login;
