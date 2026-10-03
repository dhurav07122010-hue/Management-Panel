import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.js';
import { AppLayout } from './layouts/AppLayout.js';
import { Login } from './pages/Login.js';
import { SetupWizard } from './pages/SetupWizard.js';
import { Dashboard } from './pages/Dashboard.js';
import { Console } from './pages/Console.js';
import { Players } from './pages/Players.js';
import { Mods } from './pages/Mods.js';
import { Files } from './pages/Files.js';
import { Backups } from './pages/Backups.js';
import { Geyser } from './pages/Geyser.js';
import { Settings } from './pages/Settings.js';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-xs font-mono">
        Authenticating...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<SetupWizard />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/console" element={<Console />} />
            <Route path="/players" element={<Players />} />
            <Route path="/mods" element={<Mods />} />
            <Route path="/files" element={<Files />} />
            <Route path="/backups" element={<Backups />} />
            <Route path="/geyser" element={<Geyser />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};
