// src/App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { AccessibilityProvider, useAccessibility } from './context/AccessibilityContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import AuthLayout from './layouts/AuthLayout';

import VLibrasWidget from './components/VLibrasWidget';
import ASLHelperButton from './components/ASLHelperButton';
import ScreenReaderHelper from './components/ScreenReaderHelper';

import Register from './pages/Register';
import Login from './pages/Login';
import Home from './pages/Home';
import AboutUs from './pages/AboutUs';
import MyAccount from './pages/MyAccount';
import MyNotebooks from './pages/MyNotebooks';
import SubjectPage from './pages/SubjectPage';
import SummaryPage from './pages/SummaryPage';
import QuizzPage from './pages/QuizzPage';
import ProgressPage from './pages/ProgressPage';
import TermsOfUse from './pages/TermsOfUse';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import NotebookPage from './pages/NotebookPage';
import TurmasPage from './pages/TurmasPage';
import TurmaDetailPage from './pages/TurmaDetailPage';
import TasksPage from './pages/TasksPage';
import TaskPage from './pages/TaskPage';
import TaskEditorPage from './pages/TaskEditorPage';
import StudentResultsPage from './pages/StudentResultsPage';
import AttemptViewPage from './pages/AttemptViewPage';
import AgendaPage from './pages/AgendaPage';
import ResultsPage from './pages/ResultsPage';
import FlashcardsPage from './pages/FlashcardsPage';
import FlashcardStudyPage from './pages/FlashcardStudyPage';
import NotFound from './pages/NotFound';
import DesignPreview from './pages/DesignPreview';

const AppContent: React.FC = () => {
  const { isSignLanguageEnabled, isAudioEnabled } = useAccessibility();
  const { i18n } = useTranslation();
  const isPt = i18n.language === 'pt' || i18n.language === 'pt-BR';

  return (
    <Router>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.75rem',
          },
          success: { iconTheme: { primary: 'hsl(var(--success))', secondary: 'hsl(var(--card))' } },
          error: { iconTheme: { primary: 'hsl(var(--destructive))', secondary: 'hsl(var(--card))' } },
        }}
      />

      {/* Widgets globais de acessibilidade */}
      {isSignLanguageEnabled && isPt && <VLibrasWidget />}
      {isSignLanguageEnabled && !isPt && <ASLHelperButton />}
      {isAudioEnabled && <ScreenReaderHelper />}

      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* Entrada: login, cadastro e recuperação de senha */}
        <Route element={<AuthLayout />}>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
        </Route>

        <Route element={<AppLayout />}>
          {/* Páginas públicas de conteúdo */}
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/terms-of-use" element={<TermsOfUse />} />

          {/* Áreas que exigem login */}
          <Route element={<ProtectedRoute />}>
            <Route path="/home" element={<Home />} />
            <Route path="/my-notebooks" element={<MyNotebooks />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/my-account" element={<MyAccount />} />
            <Route path="/subjects/:lessonId" element={<SubjectPage />} />
            <Route path="/summary/:lessonId" element={<SummaryPage />} />
            <Route path="/quizz/:lessonId" element={<QuizzPage />} />
            <Route path="/notebook/:notebookId" element={<NotebookPage />} />
            <Route path="/flashcards" element={<FlashcardsPage />} />
            <Route path="/flashcards/:deckId" element={<FlashcardStudyPage />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/tasks/:taskId" element={<TaskPage />} />
          </Route>

          {/* Só professores */}
          <Route element={<ProtectedRoute roles={['teacher']} />}>
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/classes" element={<TurmasPage />} />
            <Route path="/classes/:turmaId" element={<TurmaDetailPage />} />
            <Route path="/classes/:turmaId/students/:studentId" element={<StudentResultsPage />} />
            <Route path="/tasks/new" element={<TaskEditorPage />} />
            <Route path="/tasks/:taskId/edit" element={<TaskEditorPage />} />
            <Route path="/results/attempts/:attemptId" element={<AttemptViewPage />} />
          </Route>
        </Route>

        {import.meta.env.DEV && <Route path="/design" element={<DesignPreview />} />}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <AccessibilityProvider>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </AccessibilityProvider>
  );
}

export default App;
