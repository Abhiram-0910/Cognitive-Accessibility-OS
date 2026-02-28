import React from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useCognitiveStore } from '../stores/cognitiveStore';

export default function Settings() {
  const navigate = useNavigate();
  const { permissionsGranted, setPermissionsGranted } = useCognitiveStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#f6f7f8] font-display text-slate-800 p-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-slate-400 hover:text-slate-700 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl font-semibold text-sm hover:bg-red-100 transition-colors"
        >
          <span className="material-symbols-outlined text-base">logout</span>
          Logout
        </button>
      </header>

      <div className="max-w-2xl space-y-6">
        {/* Biometrics */}
        <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#197fe6]">sensors</span>
            Biometric Sensors
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Camera & Microphone</p>
              <p className="text-xs text-slate-500 mt-0.5">Required for real-time cognitive load tracking</p>
            </div>
            <button
              onClick={() => setPermissionsGranted(!permissionsGranted)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                permissionsGranted
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100'
                  : 'bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100'
              }`}
            >
              {permissionsGranted ? '✓ Enabled' : 'Enable'}
            </button>
          </div>
        </section>

        {/* Audio */}
        <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#197fe6]">headphones</span>
            Audio & Focus
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Focus Audio (40 Hz Alpha Binaural)</p>
                <p className="text-xs text-slate-500 mt-0.5">Control via the dashboard audio player widget</p>
              </div>
              <Link to="/acoustic-sandbox" className="px-4 py-2 rounded-xl text-sm font-semibold bg-teal-50 text-teal-700 border border-teal-100 hover:bg-teal-100 transition-all">
                Open Sandbox
              </Link>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">Crisis Mode (432 Hz Grounding)</p>
                <p className="text-xs text-slate-500 mt-0.5">Activates automatically when cognitive load &gt; 90</p>
              </div>
              <span className="text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">Auto</span>
            </div>
          </div>
        </section>

        {/* Reading */}
        <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">chrome_reader_mode</span>
            Reading Mode
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Lexical Anchor Formatting</p>
              <p className="text-xs text-slate-500 mt-0.5">Open PDF, DOCX, or TXT files with focus formatting</p>
            </div>
            <Link to="/reading" className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 transition-all">
              Open Reading Mode
            </Link>
          </div>
        </section>

        {/* Extension */}
        <section className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-500">extension</span>
            Browser Extension
          </h2>
          <p className="text-sm text-slate-600 mb-3">
            The NeuroAdaptive OS Chrome extension must be loaded manually in Developer Mode.
          </p>
          <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
            <li>Open Chrome → <code className="bg-slate-100 px-1 rounded">chrome://extensions/</code></li>
            <li>Enable <strong>Developer Mode</strong></li>
            <li>Click <strong>Load Unpacked</strong> → select <code className="bg-slate-100 px-1 rounded">extension/</code> folder</li>
            <li>Press <kbd className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-xs">Ctrl+Shift+F</kbd> on any site to activate Cognitive Flashlight</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
