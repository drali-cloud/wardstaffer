import {StrictMode, Component, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends Component<{children: ReactNode}, {error: any}> {
  constructor(props: any) { super(props); this.state = {error: null}; }
  static getDerivedStateFromError(error: any) { return {error}; }
  render() {
    if (this.state.error) return <div style={{padding: '20px', color: 'red'}}><h1>Critical Error</h1><pre>{this.state.error.message}</pre><pre>{this.state.error.stack}</pre></div>;
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
