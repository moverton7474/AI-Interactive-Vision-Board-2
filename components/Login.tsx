
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { SparklesIcon } from './Icons';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'SIGN_IN' | 'SIGN_UP'>('SIGN_IN');
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'SIGN_UP') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        // Check if email confirmation is required (session will be null if confirmation needed)
        if (data?.session) {
          // User is automatically signed in (email confirmation disabled)
          setMessage({ type: 'success', text: 'Account created successfully! Redirecting to your dashboard...' });
        } else if (data?.user && !data?.session) {
          // Email confirmation is required
          setMessage({ type: 'success', text: 'Check your email for the confirmation link!' });
        } else {
          setMessage({ type: 'success', text: 'Account created! You can now sign in.' });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-12 h-12 bg-navy-900 rounded-xl flex items-center justify-center shadow-lg">
            <span className="text-gold-500 font-serif font-bold text-3xl">V</span>
          </div>
        </div>
        <h1 className="text-4xl font-serif font-bold text-navy-900">Visionary</h1>
        <p className="text-gray-500 mt-2">Design your future. Secure your legacy.</p>
      </div>

      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-8">
        <div className="flex gap-4 mb-8 border-b border-gray-100 pb-4">
          <button
            onClick={() => { setMode('SIGN_IN'); setMessage(null); }}
            className={`flex-1 pb-2 text-sm font-bold transition-colors ${mode === 'SIGN_IN' ? 'text-navy-900 border-b-2 border-navy-900' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setMode('SIGN_UP'); setMessage(null); }}
            className={`flex-1 pb-2 text-sm font-bold transition-colors ${mode === 'SIGN_UP' ? 'text-navy-900 border-b-2 border-navy-900' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:border-gold-500 focus:ring-1 focus:ring-gold-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          {message && (
            <div className={`p-3 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-navy-900 text-white font-bold py-3.5 rounded-lg hover:bg-navy-800 transition-transform active:scale-95 shadow-lg flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {mode === 'SIGN_IN' ? 'Access Dashboard' : 'Start Your Journey'}
                <SparklesIcon className="w-4 h-4 text-gold-500" />
              </>
            )}
          </button>
        </form>
      </div>
      
      <p className="mt-8 text-xs text-gray-400 text-center max-w-xs">
        By continuing, you agree to Visionary's Terms of Service and Privacy Policy.
        <br />Protected by Supabase Auth.
      </p>
    </div>
  );
};

export default Login;
