import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import toast from 'react-hot-toast';

export default function PublicRequest() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    machineCode: searchParams.get('machineCode') || '',
    email: '',
    tier: 'pro',
    message: ''
  });
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.machineCode.trim()) {
      toast.error('Machine Code is required');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      toast.error('Valid email is required');
      return;
    }

    setLoading(true);
    
    try {
      // Add to Firestore
      await addDoc(collection(db, 'licenseRequests'), {
        machineCode: formData.machineCode.trim(),
        email: formData.email.trim().toLowerCase(),
        tier: formData.tier,
        message: formData.message.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      toast.success('✅ Request submitted successfully! We will contact you via email within 24 hours.');
      
      // Reset form
      setFormData({ machineCode: '', email: '', tier: 'pro', message: '' });
      
      // Redirect to landing page after 3 seconds
      setTimeout(() => {
        navigate('/');
      }, 3000);

    } catch (error) {
      console.error('Failed to submit request:', error);
      toast.error('❌ Failed to submit request. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-600 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-8 text-center">
          <h1 className="text-3xl font-bold mb-2">🔐 Request License</h1>
          <p className="text-purple-100">HL-MCK Antidetect Browser</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              💡 <strong>How to get your Machine Code:</strong>
            </p>
            <ol className="text-sm text-blue-700 dark:text-blue-400 mt-2 ml-4 list-decimal space-y-1">
              <li>Open HL-MCK Antidetect Browser app</li>
              <li>Click "Help" → "Machine Code" (or press Ctrl+Shift+M)</li>
              <li>Copy the code and paste it below</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Machine Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="XXXX XXXX XXXX XXXX"
              value={formData.machineCode}
              onChange={(e) => setFormData({ ...formData, machineCode: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
              disabled={loading}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Format: 16 characters with spaces (e.g., F3A2 8B4C 9D1E 7F5A)
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="your.email@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={loading}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              We'll send your license to this email
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              License Tier
            </label>
            <select
              value={formData.tier}
              onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="free">Free (5 profiles max)</option>
              <option value="pro">Pro (Unlimited profiles + API access)</option>
            </select>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Admin will review and approve based on your subscription status
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Message (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Additional notes or special requests..."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Submitting...
              </span>
            ) : (
              '🚀 Submit Request'
            )}
          </button>

          <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Already have a license?{' '}
              <a href="#" onClick={() => navigate('/')} className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium">
                Go to Login
              </a>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
