import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import ProgramDirectorDashboard from './pages/ProgramDirectorDashboard';
import FieldManagerDashboard from './pages/FieldManagerDashboard';
import FODashboard from './pages/FODashboard';
import RHPDashboard from './pages/RHPDashboard';
import RegisterRHP from './pages/RegisterRHP';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Protected Super Admin Dashboard Route */}
        <Route 
          path="/admin-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Protected Program Director Dashboard Route */}
        <Route 
          path="/pd-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'program_director']}>
              <ProgramDirectorDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Protected Field Manager Dashboard Route */}
        <Route 
          path="/fm-dashboard" 
          element={
            <ProtectedRoute allowedRoles={['super_admin', 'field_manager']}>
              <FieldManagerDashboard />
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

        {/* Public RHP Registration Route */}
        <Route path="/register-rhp" element={<RegisterRHP />} />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
