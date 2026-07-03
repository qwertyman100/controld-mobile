import { useState, useEffect } from 'react';
import {
  Wifi,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ── Step indicator ──────────────────────────────────────────────────────────
// Shows numbered dots for each step with the current step highlighted.
// Only shown on the main guided path (not the shortcut).
function StepDots({ current, total }) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? 'w-6 h-2 bg-green-500'
              : i < current
              ? 'w-2 h-2 bg-green-500/50'
              : 'w-2 h-2 bg-slate-600'
          }`}
        />
      ))}
    </div>
  );
}

// ── Step 1: Welcome ─────────────────────────────────────────────────────────
// Introduces the app and gives the user two paths:
//   - "Get Started" → guided setup flow
//   - "I already have a token" → skip straight to token entry
function StepWelcome({ onGetStarted, onHaveToken }) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* App icon */}
      <div className="w-20 h-20 rounded-3xl bg-green-500/10 border border-green-500/30 flex items-center justify-center mb-6">
        <Wifi className="w-10 h-10 text-green-500" />
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">ControlD Manager</h1>
      <p className="text-slate-400 text-sm mb-6 leading-relaxed max-w-xs">
        A mobile companion for your ControlD account. Manage DNS profiles,
        custom block and bypass rules, and content filters — all from your
        phone.
      </p>

      {/* What you'll need */}
      <div className="w-full bg-slate-800/60 rounded-2xl p-4 mb-8 text-left">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          What you'll need
        </p>
        <div className="flex flex-col gap-2.5">
          {[
            'A ControlD account (free or paid)',
            'A ControlD API token (we\'ll walk you through it)',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
              <span className="text-sm text-slate-300">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Primary CTA */}
      <button
        onClick={onGetStarted}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold rounded-2xl py-4 text-base transition-colors flex items-center justify-center gap-2 mb-3"
      >
        Get Started
        <ChevronRight size={18} />
      </button>

      {/* Shortcut for returning users */}
      <button
        onClick={onHaveToken}
        className="text-sm text-slate-400 hover:text-slate-200 transition-colors py-2"
      >
        I already have a token
      </button>
    </div>
  );
}

// ── Step 2: ControlD account check ─────────────────────────────────────────
// Asks if the user has a ControlD account.
// If not, shows a link to sign up. Once they confirm, moves to token setup.
function StepAccount({ onHasAccount, onBack }) {
  const [signedUp, setSignedUp] = useState(false);

  return (
    <div className="flex flex-col">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 transition-colors self-start"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <h2 className="text-2xl font-bold text-white mb-2">
        Do you have a ControlD account?
      </h2>
      <p className="text-slate-400 text-sm mb-8 leading-relaxed">
        ControlD is the DNS service this app connects to. You'll need a free
        account to get started.
      </p>

      {!signedUp ? (
        <div className="flex flex-col gap-3">
          {/* Has account */}
          <button
            onClick={onHasAccount}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold rounded-2xl py-4 text-base transition-colors"
          >
            Yes, I have an account
          </button>

          {/* No account — show sign-up link */}
          <a
            href="https://controld.com/register"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setSignedUp(true)}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-2xl py-4 text-base transition-colors flex items-center justify-center gap-2"
          >
            Create a free account
            <ExternalLink size={16} />
          </a>
        </div>
      ) : (
        /* After tapping sign-up link, show confirmation button */
        <div className="flex flex-col gap-3">
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-start gap-3 mb-2">
            <CheckCircle2 size={18} className="text-green-500 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-300 leading-relaxed">
              The ControlD sign-up page should have opened in your browser.
              Once you've created your account, tap below to continue.
            </p>
          </div>
          <button
            onClick={onHasAccount}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold rounded-2xl py-4 text-base transition-colors"
          >
            I've created my account
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 3: Token creation guide ────────────────────────────────────────────
// Walks the user through creating an API token in the ControlD dashboard.
// Numbered steps with clear instructions and a direct dashboard link.
function StepTokenGuide({ onReady, onBack }) {
  const steps = [
    {
      num: 1,
      text: 'Open the ControlD dashboard using the button below.',
    },
    {
      num: 2,
      text: 'In the left sidebar, click "API" under your account section.',
    },
    {
      num: 3,
      text: 'Click the "+" button to create a new token.',
    },
    {
      num: 4,
      text: 'Give it a name (e.g. "ControlD Manager") and set permissions to "Write".',
    },
    {
      num: 5,
      text: 'Tap "Add", then copy the token that appears.',
    },
  ];

  return (
    <div className="flex flex-col">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 transition-colors self-start"
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <h2 className="text-2xl font-bold text-white mb-2">
        Create your API token
      </h2>
      <p className="text-slate-400 text-sm mb-6 leading-relaxed">
        An API token is how this app securely connects to your ControlD
        account. Follow these steps to create one:
      </p>

      {/* Numbered steps */}
      <div className="flex flex-col gap-3 mb-6">
        {steps.map((step) => (
          <div key={step.num} className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-green-400">{step.num}</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed pt-1">{step.text}</p>
          </div>
        ))}
      </div>

      {/* Open dashboard button */}
      <a
        href="https://controld.com/dashboard/api"
        target="_blank"
        rel="noopener noreferrer"
        className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-2xl py-4 text-base transition-colors flex items-center justify-center gap-2 mb-3"
      >
        Open ControlD Dashboard
        <ExternalLink size={16} />
      </a>

      <button
        onClick={onReady}
        className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold rounded-2xl py-4 text-base transition-colors flex items-center justify-center gap-2"
      >
        <Copy size={16} />
        I've copied my token
      </button>
    </div>
  );
}

// ── Token detection helper ──────────────────────────────────────────────────
// Returns true if the string looks like an API token rather than a domain or
// random text. Heuristic: long enough, no spaces, no valid domain TLD pattern.
function looksLikeToken(text) {
  if (!text) return false;
  const t = text.trim();
  // Must be at least 20 chars, no whitespace
  if (t.length < 20 || /\s/.test(t)) return false;
  // Must not look like a URL or domain (contains ://, or ends with a known TLD)
  if (t.includes('://')) return false;
  if (/\.[a-z]{2,}$/i.test(t)) return false;
  // Must be alphanumeric with optional dashes, underscores, or dots
  if (!/^[a-zA-Z0-9._-]+$/.test(t)) return false;
  return true;
}

// ── Step 4: Token entry ─────────────────────────────────────────────────────
// Paste/type the API token. Validates against the ControlD API on submit.
// On mount, checks the clipboard for something that looks like a token and
// offers a one-tap "Use from clipboard" button if found.
// Used by both the guided flow and the "I already have a token" shortcut.
function StepEnterToken({ onBack, showBack }) {
  const { login, authError } = useAuth();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clipboardToken, setClipboardToken] = useState(null);

  // Check clipboard on mount for a token-like string
  useEffect(() => {
    if (!navigator.clipboard?.readText) return;
    navigator.clipboard.readText()
      .then((text) => {
        if (looksLikeToken(text)) setClipboardToken(text.trim());
      })
      .catch(() => {}); // Permission denied — degrade silently
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    await login(token);
    setLoading(false);
  }

  return (
    <div className="flex flex-col">
      {showBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 transition-colors self-start"
        >
          <ArrowLeft size={16} />
          Back
        </button>
      )}

      <h2 className="text-2xl font-bold text-white mb-2">
        Paste your API token
      </h2>
      <p className="text-slate-400 text-sm mb-6 leading-relaxed">
        Paste the token you copied from the ControlD dashboard. It will be
        stored securely on this device only.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Clipboard token suggestion — shown if a token-like string is detected */}
        {clipboardToken && !token && (
          <button
            type="button"
            onClick={() => { setToken(clipboardToken); setClipboardToken(null); }}
            className="w-full flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-left transition-colors hover:bg-green-500/20"
          >
            <Copy size={16} className="text-green-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-green-400">Use token from clipboard</p>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {clipboardToken.slice(0, 6)}{'•'.repeat(8)}{clipboardToken.slice(-4)}
              </p>
            </div>
          </button>
        )}

        {/* Token input with show/hide toggle */}
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            maxLength={256}
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

        {/* Auth error display */}
        {authError && (
          <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-400">{authError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!token.trim() || loading}
          className="w-full bg-green-500 hover:bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-2xl py-4 text-base transition-colors flex items-center justify-center gap-2 min-h-[56px]"
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

      {/* Security note */}
      <p className="text-xs text-slate-600 mt-6 text-center leading-relaxed">
        Your token is stored locally on this device only and is never shared
        with anyone other than ControlD's servers.
      </p>
    </div>
  );
}

// ── Main OnboardingFlow component ───────────────────────────────────────────
// Manages step state and renders the appropriate step.
// Two paths:
//   Guided:  welcome → account → token-guide → enter-token
//   Shortcut: welcome → enter-token
export default function OnboardingFlow() {
  // 'welcome' | 'account' | 'token-guide' | 'enter-token'
  const [step, setStep] = useState('welcome');

  // Guided path step index for the dot indicator (0-indexed, 4 total steps)
  const stepIndex = {
    welcome: 0,
    account: 1,
    'token-guide': 2,
    'enter-token': 3,
  };

  // Track whether user took the shortcut ("I already have a token")
  // so we know whether to show a Back button on the token entry step
  const [usedShortcut, setUsedShortcut] = useState(false);

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Step dots — shown on guided path only, not on shortcut */}
        {step !== 'welcome' && step !== 'enter-token-shortcut' && (
          <StepDots
            current={stepIndex[step] ?? 0}
            total={4}
          />
        )}

        {step === 'welcome' && (
          <StepWelcome
            onGetStarted={() => { setUsedShortcut(false); setStep('account'); }}
            onHaveToken={() => { setUsedShortcut(true); setStep('enter-token'); }}
          />
        )}

        {step === 'account' && (
          <StepAccount
            onHasAccount={() => setStep('token-guide')}
            onBack={() => setStep('welcome')}
          />
        )}

        {step === 'token-guide' && (
          <StepTokenGuide
            onReady={() => setStep('enter-token')}
            onBack={() => setStep('account')}
          />
        )}

        {step === 'enter-token' && (
          <StepEnterToken
            onBack={() => usedShortcut ? setStep('welcome') : setStep('token-guide')}
            showBack={true}
          />
        )}
      </div>
    </div>
  );
}
