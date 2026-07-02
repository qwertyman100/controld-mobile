import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// React error boundaries MUST be class components — getDerivedStateFromError /
// componentDidCatch have no hooks equivalent. This catches render-time throws in
// the wrapped subtree and shows a fallback instead of a blank white screen
// (an uncaught render error unmounts the whole tree → white page). It's placed
// around the page content and keyed by page in App.jsx, so navigating to another
// tab remounts it and clears the error — the user recovers without a full reload.
export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Surface it — without this the throw is swallowed and only the fallback shows.
    console.error('Screen crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[50vh]">
          <AlertTriangle className="w-9 h-9 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Something went wrong on this screen.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Switch tabs to keep going, or reload the app.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 text-green-500 font-medium text-sm"
          >
            <RefreshCw size={14} /> Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
