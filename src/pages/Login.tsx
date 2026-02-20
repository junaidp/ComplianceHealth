import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Shield, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">PDPL Compliance Tool</h1>
          <p className="text-gray-500 mt-1">KSA Health Sector Compliance Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                placeholder="you@organization.sa"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary-600 font-medium hover:text-primary-700">
                Register
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 bg-white/70 backdrop-blur rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Demo Credentials</p>
          <div className="space-y-2">
            <button type="button" onClick={() => { setEmail('admin@demo-hospital.sa'); setPassword('Admin@12345678'); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-primary-50 transition-colors text-left group">
              <div>
                <p className="text-sm font-medium text-gray-800 group-hover:text-primary-700">admin@demo-hospital.sa</p>
                <p className="text-xs text-gray-400">Admin@12345678</p>
              </div>
              <span className="text-xs font-medium bg-primary-100 text-primary-700 px-2 py-0.5 rounded">Org Admin</span>
            </button>
            <button type="button" onClick={() => { setEmail('dpo@demo-hospital.sa'); setPassword('Dpo@123456789'); }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-primary-50 transition-colors text-left group">
              <div>
                <p className="text-sm font-medium text-gray-800 group-hover:text-primary-700">dpo@demo-hospital.sa</p>
                <p className="text-xs text-gray-400">Dpo@123456789</p>
              </div>
              <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded">DPO</span>
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">Click a row to auto-fill credentials</p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Compliant with PDPL, NCA ECC, and MoH Data Governance Policy
        </p>
      </div>
    </div>
  );
}
