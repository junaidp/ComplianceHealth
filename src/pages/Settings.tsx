import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Settings as SettingsIcon, User, Globe, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user } = useAuthStore();
  const [language, setLanguage] = useState(user?.language || 'en');

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    toast.success(lang === 'ar' ? 'تم التبديل إلى العربية' : 'Switched to English');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <SettingsIcon className="w-7 h-7 text-primary-600" /> Settings
        </h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5" /> Profile
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Name</span>
            <span className="font-medium text-gray-900">{user?.firstName} {user?.lastName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Email</span>
            <span className="font-medium text-gray-900">{user?.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Role</span>
            <span className="font-medium text-gray-900 capitalize">{user?.role?.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5" /> Language / اللغة
        </h2>
        <div className="flex gap-3">
          <button onClick={() => handleLanguageChange('en')}
            className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${language === 'en' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            English (LTR)
          </button>
          <button onClick={() => handleLanguageChange('ar')}
            className={`flex-1 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${language === 'ar' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            العربية (RTL)
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" /> Security
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">Session</span>
            <span className="font-medium text-gray-900">JWT — 1h access / 7d refresh</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">MFA</span>
            <span className="font-medium text-gray-900">Contact admin to enable</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Encryption</span>
            <span className="font-medium text-gray-900">AES-256 at rest · TLS 1.3 in transit</span>
          </div>
        </div>
      </div>
    </div>
  );
}
