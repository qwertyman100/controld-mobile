import { useState } from 'react';
import { Eye, EyeOff, Wifi, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login, authError } = useAuth();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    await login(token);
    setLoading(false);
  }

  return (
    <div className="min-h-dvh bg-slate-950 dark:bg-slate-950 flex flex-col items-center justify-center p-6">
      {/* Logo / brand */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
          <Wifi className="w-8 h-8 text-green-500" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">ControlD Manager</h1>
          <p className="text-slate-400 text-sm mt-1">Mobile DNS profile manager</p>
        </div>
      </div>

      {/* Login form */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            API Token
          </label>
          <div className="relative">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your API token here"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3.5 pr-12 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
            >
              {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Get your token from{' '}
            <a
              href="https://controld.com/dashboard/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-500 underline underline-offset-2"
            >
              Control D Dashboard → API Tokens
            </a>
          </p>
        </div>

        {authError && (
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-400">{authError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!token.trim() || loading}
          className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl py-3.5 text-base transition-colors flex items-center justify-center gap-2 min-h-[52px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Connecting…
            </>
          ) : (
            'Connect'
          )}
        </button>
      </form>

      {/* Footer note */}
      <p className="text-xs text-slate-600 mt-10 text-center max-w-xs">
        Your token is stored locally on this device only. No account or
        registration required.
      </p>
    </div>
  );
}
