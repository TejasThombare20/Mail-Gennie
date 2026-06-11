import React from 'react';
import './App.css';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, PrivateRoute, PublicOnlyRoute } from './context/auth-context';
import Loginpage from './pages/login-page';
import DashboardPage from './pages/Dashboard-page';
import SendEmailForm from './components/Send-Email-form';
import Dashboard from './components/Dashboard';
import TemplateList from './pages/Templates-page';
import Templatepage from './pages/Template-page';
import AttachmentPage from './pages/Attachments-page';
import HistoryPage from './pages/History-page';
import SentRecordsPage from './pages/SentRecords-page';
import OutreachPage from './pages/Outreach-page';
import AuthCallbackPage from './pages/AuthCallback-page';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public only — redirects to /dashboard if logged in */}
          <Route path="/login" element={<PublicOnlyRoute><Loginpage /></PublicOnlyRoute>} />
          <Route path="/" element={<PublicOnlyRoute><Loginpage /></PublicOnlyRoute>} />

          {/* Auth callback after Google OAuth */}
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* Public — no auth required */}
          <Route path="/records" element={<SentRecordsPage />} />

          {/* Protected — redirects to /login if not logged in */}
          <Route path='/dashboard' element={<PrivateRoute><DashboardPage /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="send" element={<SendEmailForm />} />
            <Route path="templates" element={<TemplateList />} />
            <Route path="templates/:templateId?" element={<Templatepage />} />
            <Route path="attachments" element={<AttachmentPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="records" element={<SentRecordsPage embedded />} />
            <Route path="outreach/:sessionId" element={<OutreachPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
