import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
              fontFamily: "system-ui, sans-serif",
              background: "#0a0a0a",
              color: "#e4e4e7",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
                Something went wrong.
              </p>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #3f3f46",
                  background: "#18181b",
                  color: "#e4e4e7",
                  cursor: "pointer",
                }}
              >
                Reload
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
