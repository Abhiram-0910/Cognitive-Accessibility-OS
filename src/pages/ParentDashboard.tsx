/**
 * ParentDashboard — Kids Module
 * Ported from: _legacy_repo_to_port/Frontend/src/components/ManageChildAccounts.js
 *
 * Functional parity checklist — ALL features preserved:
 * ✅ fetchChildAccounts on mount via parent_id (Supabase auth)
 * ✅ Create new child: name, age, PIN form
 * ✅ Show/hide PIN toggle (Lucide Eye/EyeOff)
 * ✅ Field validation: all fields required
 * ✅ Success + error message display per submit
 * ✅ Existing child accounts list shown BY DEFAULT
 * ✅ "Add Child" button toggles the create form (isCreating state)
 * ✅ Each child card shows "Play Quiz" + "Play Spelling" with childAge passed to game
 * ✅ Loading / error states
 * ✅ Logout handler
 *
 * Styling: Tailwind + Framer Motion. Zero CSS file imports.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye, EyeOff, LogOut, Plus, User, Baby, Loader2,
  Gamepad2, ChevronDown, X
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChildAccount {
  id: string;
  child_name: string;
  age: number;
  is_active: boolean;
}

interface NewChildForm {
  name: string;
  age: string;
  pin: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ParentDashboard() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');

  // Derive parent user from Supabase auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setUsername(data.user?.email ?? '');
    });
  }, []);

  const [childAccounts, setChildAccounts] = useState<ChildAccount[]>([]);
  const [newChild, setNewChild] = useState<NewChildForm>({ name: '', age: '', pin: '' });
  const [loading, setLoading]             = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [fetchError, setFetchError]       = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage]   = useState('');
  const [showPassword, setShowPassword]   = useState(false);

  // ── UI toggle — show child list by default; create form appears on "Add Child" ──
  const [isCreating, setIsCreating] = useState(false);

  // ── Fetch child accounts ───────────────────────────────────────────────────
  const fetchChildAccounts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setFetchError('');
    try {
      const { data, error } = await supabase
        .from('child_profiles')
        .select('id, child_name, age, is_active')
        .eq('parent_id', userId)
        .order('child_name', { ascending: true });

      if (error) throw error;
      setChildAccounts(data ?? []);
      // Auto-show list if children exist; auto-open form if empty (onboarding)
      if (data && data.length > 0) setIsCreating(false);
      else setIsCreating(true);
    } catch {
      setFetchError('Failed to fetch child accounts.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { if (userId) fetchChildAccounts(); }, [userId, fetchChildAccounts]);

  // ── Form handling ──────────────────────────────────────────────────────────
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setNewChild(prev => ({ ...prev, [id]: value }));
  };

  const handleCreateAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!newChild.name || !newChild.age || !newChild.pin) {
      setErrorMessage('All fields are required.');
      return;
    }
    if (!userId) {
      setErrorMessage('Session expired. Please refresh.');
      return;
    }

    setSubmitLoading(true);
    try {
      // NOTE: pin_hash should be hashed server-side in production.
      // Stored as plaintext here for hackathon demo purposes only.
      const { data, error } = await supabase
        .from('child_profiles')
        .insert({
          parent_id: userId,
          child_name: newChild.name,
          age: parseInt(newChild.age, 10),
          pin_hash: newChild.pin,
          is_active: true,
        })
        .select('id, child_name, age, is_active');

      if (error) throw error;
      setChildAccounts(prev => [...prev, ...(data ?? [])]);
      setNewChild({ name: '', age: '', pin: '' });
      setSuccessMessage(`${newChild.name}'s account created!`);
      setIsCreating(false); // collapse form, show the updated list
    } catch (err: unknown) {
      console.error('[ParentDashboard] createAccount error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to create child account.';
      setErrorMessage(msg);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // Navigate to a game, passing child profile info (including age for Gemini)
  const launchGame = (child: ChildAccount, gameRoute: '/kids/quiz' | '/kids/spelling') => {
    navigate(gameRoute, {
      state: {
        username: child.child_name,
        gameName: gameRoute === '/kids/quiz' ? 'Crack the Quiz' : 'Drag & Spell',
        childAge: child.age,  // ← passed to Gemini for age-calibrated content
      },
    });
  };

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 backdrop-blur-md bg-white/5 border-b border-white/10 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Baby className="w-5 h-5 text-purple-400" />
          <span className="font-bold text-lg">Parent Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/50">
            <span className="text-purple-300 font-semibold">{username}</span>
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* ── Section header + Add Child toggle ─────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-bold">
              {childAccounts.length > 0
                ? `${childAccounts.length} Child Account${childAccounts.length > 1 ? 's' : ''}`
                : 'No accounts yet'}
            </h2>
          </div>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              setIsCreating(c => !c);
              setSuccessMessage('');
              setErrorMessage('');
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition
              ${isCreating
                ? 'bg-white/10 text-white/60 hover:bg-white/15'
                : 'bg-gradient-to-r from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/30'}`}
          >
            {isCreating
              ? <><X className="w-4 h-4" /> Cancel</>
              : <><Plus className="w-4 h-4" /> Add Child</>}
          </motion.button>
        </div>

        {/* ── Success banner ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="px-4 py-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-sm"
            >
              ✓ {successMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Create Child Form (collapsible) ────────────────────────────────── */}
        <AnimatePresence>
          {isCreating && (
            <motion.div
              key="create-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-1">
                  <Plus className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-bold">Create Child Account</h3>
                </div>

                <form onSubmit={handleCreateAccount} className="flex flex-col gap-4">
                  {/* Name */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="name" className="text-sm text-white/50 font-medium">Name</label>
                    <input
                      type="text" id="name" value={newChild.name}
                      onChange={handleInputChange} placeholder="Child's name"
                      className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-white/25 focus:outline-none focus:border-purple-400 transition"
                    />
                  </div>

                  {/* Age */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="age" className="text-sm text-white/50 font-medium">Age</label>
                    <input
                      type="number" id="age" value={newChild.age}
                      onChange={handleInputChange} placeholder="Child's age"
                      min={1} max={18}
                      className="px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-white/25 focus:outline-none focus:border-purple-400 transition"
                    />
                    <p className="text-[11px] text-white/30">Used to calibrate game difficulty with AI ✨</p>
                  </div>

                  {/* PIN with toggle */}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="pin" className="text-sm text-white/50 font-medium">PIN / Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'} id="pin" value={newChild.pin}
                        onChange={handleInputChange} placeholder="Set a PIN or password"
                        className="w-full px-4 py-2.5 pr-10 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-white/25 focus:outline-none focus:border-purple-400 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Error */}
                  <AnimatePresence>
                    {errorMessage && (
                      <motion.p
                        key="error"
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-rose-400 text-sm"
                      >
                        ✕ {errorMessage}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    disabled={submitLoading}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-violet-600 font-bold shadow-lg shadow-purple-500/30 disabled:opacity-50 transition"
                  >
                    {submitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Create Account
                  </motion.button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Child Accounts List ─────────────────────────────────────────────── */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
          {loading ? (
            <div className="flex items-center gap-2 text-white/30 py-4">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading accounts…
            </div>
          ) : fetchError ? (
            <p className="text-rose-400">{fetchError}</p>
          ) : childAccounts.length === 0 ? (
            <div className="text-center py-8 flex flex-col items-center gap-3">
              <Baby className="w-10 h-10 text-white/20" />
              <p className="text-white/40 text-sm">No child accounts yet.</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setIsCreating(true)}
                className="px-5 py-2 rounded-xl bg-purple-500/30 hover:bg-purple-500/50 text-purple-300 text-sm font-semibold transition"
              >
                + Create First Account
              </motion.button>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {childAccounts.map((child, i) => (
                <motion.li
                  key={child.id ?? i}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3
                             px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-400/30 transition"
                >
                  {/* Left: avatar + name + age */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-sm shrink-0">
                      {child.child_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold leading-tight">{child.child_name}</p>
                      <p className="text-xs text-white/40">Age {child.age} · {child.is_active ? 'Active' : 'Inactive'}</p>
                    </div>
                  </div>

                  {/* Right: game launch buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => launchGame(child, '/kids/quiz')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/40
                                 text-violet-300 text-xs font-semibold transition"
                    >
                      <Gamepad2 className="w-3.5 h-3.5" /> Quiz
                    </button>
                    <button
                      onClick={() => launchGame(child, '/kids/spelling')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/40
                                 text-amber-300 text-xs font-semibold transition"
                    >
                      <Gamepad2 className="w-3.5 h-3.5" /> Spelling
                    </button>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}
