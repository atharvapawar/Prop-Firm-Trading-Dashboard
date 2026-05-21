import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props  { children: ReactNode; }
interface State  { error: Error | null; }

/** Class-based error boundary.  Catches any unhandled render error from its
 *  subtree and replaces the page with a safe recovery screen instead of a
 *  blank white void. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div
          className="max-w-lg w-full p-8 rounded-2xl text-center"
          style={{
            background: "rgba(5,14,28,0.95)",
            border: "1px solid rgba(255,45,85,0.35)",
            boxShadow: "0 0 40px rgba(255,45,85,0.12)",
          }}
        >
          {/* Corner marks */}
          <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-[rgba(255,45,85,0.5)]" style={{ borderTopLeftRadius: 2 }} />
          <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-[rgba(255,45,85,0.5)]" style={{ borderTopRightRadius: 2 }} />

          <div className="text-3xl mb-4" style={{ color: "#ff2d55", textShadow: "0 0 20px rgba(255,45,85,0.5)" }}>
            ⚠
          </div>
          <h2
            className="text-sm font-black uppercase tracking-[0.15em] mb-2"
            style={{ color: "#ff2d55" }}
          >
            System Error
          </h2>
          <p className="text-xs text-slate-500 font-mono mb-6 break-all leading-relaxed">
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={this.handleReset}
            className="btn-primary text-xs px-6 py-2"
          >
            Reinitialise Dashboard
          </button>
        </div>
      </div>
    );
  }
}
