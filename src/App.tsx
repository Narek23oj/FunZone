import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { Background } from './components/Background';
import Login from './pages/auth/Login';
import AdminDashboard from './pages/admin/Dashboard';
import UserDashboard from './pages/user/Dashboard';

const ProtectedRoute = ({ children, requireAdmin }: { children: React.ReactNode, requireAdmin?: boolean }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  
  const isAdminOrSuper = user.role === 'admin' || user.role === 'superadmin';
  
  if (requireAdmin && !isAdminOrSuper) return <Navigate to="/user" />;
  if (!requireAdmin && isAdminOrSuper) return <Navigate to="/admin" />;
  
  return <>{children}</>;
};

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3 }}
    className="min-h-screen w-full"
  >
    {children}
  </motion.div>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location}>
        <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
        <Route path="/admin" element={
          <ProtectedRoute requireAdmin>
            <PageWrapper><AdminDashboard /></PageWrapper>
          </ProtectedRoute>
        } />
        <Route path="/user" element={
          <ProtectedRoute>
            <PageWrapper><UserDashboard /></PageWrapper>
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </AnimatePresence>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <BrowserRouter>
          <Background />
          <Toaster position="top-center" theme="dark" />
          <AnimatedRoutes />
        </BrowserRouter>
      </DataProvider>
    </AuthProvider>
  );
}
