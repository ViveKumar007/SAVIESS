import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import FODashboard from './pages/FODashboard';
import RHPDashboard from './pages/RHPDashboard';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Admin & Managers Dashboard Route */}
        <Route 
          path="/admin-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'program_director', 'field_manager']}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Protected Field Officer Dashboard Route */}
        <Route 
          path="/fo-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['field_officer']}>
              <FODashboard />
            </ProtectedRoute>
          } 
        />

        {/* Protected RHP / Vision Entrepreneur Dashboard Route */}
        <Route 
          path="/rhp-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['rhp']}>
              <RHPDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
