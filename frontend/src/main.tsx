import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { EventProvider } from './contexts/EventContext';
import { ToastProvider } from './components/Toast';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Outermost, so anything below can report success or failure without
        taking the page away from whoever is using it. */}
    <ToastProvider>
      <AuthProvider>
        <EventProvider>
          <App />
        </EventProvider>
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>,
);
