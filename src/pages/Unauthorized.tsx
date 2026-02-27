import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldX, ArrowLeft, Home } from 'lucide-react';

/**
 * Unauthorized.tsx
 * Shown when a user attempts to access a route outside their role scope.
 * Logs the intrusion attempt to console and redirects to their correct dashboard.
 */
export const Unauthorized: React.FC = () => {
  const navigate = useNavigate();

  React.useEffect(() => {
    console.warn('[RBAC] ⚠ Unauthorized route access attempt logged.');
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-950/20 to-slate-900 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="max-w-md w-full bg-white/5 backdrop-blur-xl border border-red-500/20 rounded-3xl p-10 text-center"
      >
        <motion.div
          initial={{ rotate: -10 }}
          animate={{ rotate: 0 }}
          transition={{ type: 'spring', damping: 10 }}
          className="w-20 h-20 mx-auto mb-6 bg-red-500/10 rounded-2xl flex items-center justify-center"
        >
          <ShieldX className="w-10 h-10 text-red-400" />
        </motion.div>

        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Access Restricted</h1>
        <p className="text-sm text-white/50 leading-relaxed mb-8">
          Your account role doesn't have permission to access this page.
          If you believe this is an error, please contact your administrator.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white/80 rounded-xl text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Home className="w-4 h-4" /> Home
          </button>
        </div>
      </motion.div>
    </div>
  );
};
