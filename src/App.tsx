import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActiveExamSession,
  AppView,
  AuthSession,
  Exam,
  ExamAttempt,
  Question,
  UserAccount,
  WrongQuestionRecord,
} from './types';
import { storageService } from './services/storageService';
import {
  gradeExamSubmission,
  updateWrongRecordsFromAttempt,
} from './utils/examEngine';
import { MainLayout } from './layouts/MainLayout';
import { IntroScreen } from './pages/IntroScreen';
import { HomePage } from './pages/HomePage';
import { AuthPages } from './pages/AuthPages';
import { StudentDashboard } from './pages/StudentDashboard';
import { ExamDetailPage, ExamLibraryPage } from './pages/ExamLibraryPage';
import { ExamRoomPage } from './pages/ExamRoomPage';
import { ExamResultPage } from './pages/ExamResultPage';
import { QuestionBankPage } from './pages/QuestionBankPage';
import { PracticeCenterPage } from './pages/PracticeCenterPage';
import { HistoryAndStatsPage, UserProfilePage } from './pages/HistoryAndStatsPage';
import { AboutProductPage } from './pages/AboutProductPage';
import { AdminPortalPage } from './pages/AdminPortalPage';

const PROTECTED_AUTH_VIEWS: AppView[] = ['dashboard', 'profile'];

const VALID_URL_VIEWS = new Set<AppView>([
  'intro',
  'home',
  'login',
  'register',
  'dashboard',
  'exams',
  'exam-detail',
  'exam-room',
  'exam-result',
  'question-bank',
  'practice',
  'wrong-practice',
  'wrong-analysis',
  'history',
  'statistics',
  'profile',
  'about',
  'admin',
]);

function resolveInitialView(): AppView {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return 'home';

    const rawHash = window.location.hash.replace(/^#\/?/, '').trim() as AppView;
    if (rawHash && VALID_URL_VIEWS.has(rawHash)) {
      return rawHash;
    }

    const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '').trim() as AppView;
    if (rawPath && VALID_URL_VIEWS.has(rawPath)) {
      return rawPath;
    }
  } catch {
    // ignore in restricted environments
  }
  return 'intro';
}

export default function App() {
  // Support ?autostart=1, #view hash, or /view pathname for seamless reload on Vercel
  const [currentView, setCurrentView] = useState<AppView>(resolveInitialView);

  const [users, setUsers] = useState<UserAccount[]>(() => storageService.getUsers());
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() =>
    storageService.getCurrentUser()
  );
  const [authSession, setAuthSession] = useState<AuthSession | null>(() =>
    storageService.getActiveAuthSession()
  );

  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    storageService.getTheme(currentUser?.id)
  );
  const [profileSection, setProfileSection] = useState<
    'info' | 'security' | 'settings'
  >('info');
  const [globalToastMessage, setGlobalToastMessage] = useState<string | null>(
    null
  );
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [exams, setExams] = useState<Exam[]>(() => storageService.getExams());
  const [questions, setQuestions] = useState<Question[]>(() =>
    storageService.getQuestions()
  );

  // Strict per-account data isolation key
  const activeUserId = currentUser?.id || 'guest-student';

  const [userAttempts, setUserAttempts] = useState<ExamAttempt[]>(() =>
    storageService.getUserAttempts(activeUserId)
  );
  const [wrongRecords, setWrongRecords] = useState<WrongQuestionRecord[]>(() =>
    storageService.getUserWrongRecords(activeUserId)
  );
  const [activeSession, setActiveSession] = useState<ActiveExamSession | null>(() =>
    storageService.getActiveSession(activeUserId)
  );
  const [demoModeEnabled, setDemoModeEnabled] = useState<boolean>(() =>
    storageService.isDemoModeEnabled(activeUserId)
  );

  const [selectedExamId, setSelectedExamId] = useState<string>(() => exams[0]?.id || '');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  const showGlobalToast = useCallback((msg: string) => {
    setGlobalToastMessage(msg);
    window.setTimeout(() => {
      setGlobalToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  // Sync Dark mode class on <html> and save per-account theme preference
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    storageService.setTheme(theme, currentUser?.id);
  }, [theme, currentUser?.id]);

  // Reload isolated per-user data and theme whenever currentUser changes
  useEffect(() => {
    const uid = currentUser?.id || 'guest-student';
    setUserAttempts(storageService.getUserAttempts(uid));
    setWrongRecords(storageService.getUserWrongRecords(uid));
    setActiveSession(storageService.getActiveSession(uid));
    setDemoModeEnabled(storageService.isDemoModeEnabled(uid));
    setTheme(storageService.getTheme(currentUser?.id));
    setSelectedAttemptId(null);
  }, [currentUser]);

  // Guard protected views (Dashboard & Profile) when logged out, including browser Back button
  useEffect(() => {
    if (!currentUser && PROTECTED_AUTH_VIEWS.includes(currentView)) {
      setAuthNotice(
        'Vui lòng đăng nhập tài khoản để truy cập vào Dashboard học sinh và Hồ sơ cá nhân.'
      );
      setCurrentView('login');
    }
  }, [currentUser, currentView]);

  // Sync browser history state & hash changes so Back/Forward and refresh work on Vercel
  useEffect(() => {
    const handleHistoryChange = () => {
      const activeUser = storageService.getCurrentUser();
      if (!activeUser) {
        setCurrentUser(null);
        setAuthSession(null);
      }
      const nextView = resolveInitialView();
      if (!activeUser && PROTECTED_AUTH_VIEWS.includes(nextView)) {
        setCurrentView('login');
      } else if (nextView !== 'intro' || window.location.hash === '#intro') {
        setCurrentView(nextView);
      }
    };
    window.addEventListener('popstate', handleHistoryChange);
    window.addEventListener('hashchange', handleHistoryChange);
    return () => {
      window.removeEventListener('popstate', handleHistoryChange);
      window.removeEventListener('hashchange', handleHistoryChange);
    };
  }, []);

  const demoAttempts = useMemo(
    () => storageService.getDemoAttempts(activeUserId),
    [activeUserId, exams, questions]
  );
  const demoWrongRecords = useMemo(() => storageService.getDemoWrongRecords(), []);

  const handleNavigate = useCallback(
    (view: AppView) => {
      if (!currentUser && PROTECTED_AUTH_VIEWS.includes(view)) {
        setAuthNotice(
          'Vui lòng đăng nhập tài khoản để truy cập vào Dashboard cá nhân.'
        );
        setCurrentView('login');
        try {
          window.history.pushState({ view: 'login' }, '', '#login');
        } catch {
          // ignore
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      setAuthNotice(null);
      setCurrentView(view);
      try {
        window.history.pushState({ view }, '', `#${view}`);
      } catch {
        // ignore in restricted iframe environments
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentUser]
  );

  const handleNavigateProfileSection = useCallback(
    (section: 'info' | 'security' | 'settings') => {
      setProfileSection(section);
      handleNavigate('profile');
    },
    [handleNavigate]
  );

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleToggleDemoMode = (enabled: boolean) => {
    setDemoModeEnabled(enabled);
    storageService.setDemoModeEnabled(activeUserId, enabled);
  };

  const handleAuthenticateUser = useCallback(
    (user: UserAccount, rememberMe: boolean) => {
      const session = storageService.establishUserSession(user, rememberMe);
      const refreshedUsers = storageService.getUsers();
      const refreshedCurrent =
        refreshedUsers.find((u) => u.id === user.id) || user;
      setUsers(refreshedUsers);
      setCurrentUser(refreshedCurrent);
      setAuthSession(session);
      setAuthNotice(null);
      setCurrentView('dashboard');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  const handleConfirmLogout = useCallback(() => {
    storageService.logoutCurrentSession();
    setCurrentUser(null);
    setAuthSession(null);
    setAuthNotice(null);
    setCurrentView('login');
    try {
      window.history.replaceState({ view: 'login' }, '', '#login');
    } catch {
      // ignore
    }
    showGlobalToast('Bạn đã đăng xuất tài khoản thành công.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [showGlobalToast]);

  const handleSwitchAccount = useCallback(() => {
    storageService.logoutCurrentSession();
    setCurrentUser(null);
    setAuthSession(null);
    setAuthNotice(
      'Đã kết thúc phiên hiện tại. Vui lòng đăng nhập tài khoản bạn muốn chuyển sang.'
    );
    setCurrentView('login');
    try {
      window.history.replaceState({ view: 'login' }, '', '#login');
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Start or resume an exam
  const handleStartExam = useCallback(
    (examId: string) => {
      const targetExam = exams.find((e) => e.id === examId) || exams[0];
      if (!targetExam) return;

      // Check if an existing unfinished session for this exact exam & user is still within time
      if (
        activeSession &&
        activeSession.userId === activeUserId &&
        activeSession.examId === targetExam.id &&
        activeSession.endsAt > Date.now()
      ) {
        setSelectedExamId(targetExam.id);
        setCurrentView('exam-room');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const now = Date.now();
      const newSession: ActiveExamSession = {
        examId: targetExam.id,
        examCode: targetExam.code,
        examTitle: targetExam.title,
        userId: activeUserId,
        startedAt: now,
        endsAt: now + targetExam.durationMinutes * 60 * 1000,
        currentQuestionIndex: 0,
        answers: {},
        flaggedQuestions: [],
        lastSavedAt: now,
      };

      setActiveSession(newSession);
      storageService.saveActiveSession(activeUserId, newSession);
      setSelectedExamId(targetExam.id);
      setCurrentView('exam-room');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [exams, activeSession, activeUserId]
  );

  const handleUpdateActiveSession = useCallback(
    (updated: ActiveExamSession) => {
      setActiveSession(updated);
      storageService.saveActiveSession(activeUserId, updated);
    },
    [activeUserId]
  );

  // Submit & grade exam
  const handleSubmitExam = useCallback(
    (finalSession: ActiveExamSession) => {
      const targetExam =
        exams.find((e) => e.id === finalSession.examId) || exams[0];
      if (!targetExam) return;

      const questionsMap = new Map(questions.map((q) => [q.id, q]));
      const grade = gradeExamSubmission(
        targetExam,
        questionsMap,
        finalSession.answers
      );

      const nowMs = Date.now();
      const durationSecs = Math.max(
        1,
        Math.min(
          targetExam.durationMinutes * 60,
          Math.round((nowMs - finalSession.startedAt) / 1000)
        )
      );

      const completedIso = new Date(nowMs).toISOString();
      const newAttempt: ExamAttempt = {
        id: `ATT-${nowMs}`,
        examId: targetExam.id,
        examCode: targetExam.code,
        examTitle: targetExam.title,
        userId: activeUserId,
        startedAt: new Date(finalSession.startedAt).toISOString(),
        completedAt: completedIso,
        durationSeconds: durationSecs,
        totalQuestions: grade.totalQuestions,
        correctCount: grade.correctCount,
        wrongCount: grade.wrongCount,
        unansweredCount: grade.unansweredCount,
        score: grade.score,
        maxScore: grade.maxScore,
        accuracyPercent: grade.accuracyPercent,
        answers: finalSession.answers,
        flaggedQuestions: finalSession.flaggedQuestions,
      };

      storageService.saveAttempt(newAttempt);
      const nextAttempts = storageService.getUserAttempts(activeUserId);
      setUserAttempts(nextAttempts);

      // Update wrong question records isolated for activeUserId
      const updatedWrong = updateWrongRecordsFromAttempt(
        wrongRecords,
        targetExam.questionIds,
        questionsMap,
        finalSession.answers,
        completedIso
      );
      setWrongRecords(updatedWrong);
      storageService.saveUserWrongRecords(activeUserId, updatedWrong);

      // Clear active session
      setActiveSession(null);
      storageService.saveActiveSession(activeUserId, null);

      setSelectedAttemptId(newAttempt.id);
      setCurrentView('exam-result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [exams, questions, activeUserId, wrongRecords]
  );

  // Record a single-question practice answer to update wrong records
  const handleRecordPracticeAnswer = useCallback(
    (questionId: string, selectedOption: number) => {
      const questionsMap = new Map(questions.map((q) => [q.id, q]));
      const updated = updateWrongRecordsFromAttempt(
        wrongRecords,
        [questionId],
        questionsMap,
        { [questionId]: selectedOption },
        new Date().toISOString()
      );
      setWrongRecords(updated);
      storageService.saveUserWrongRecords(activeUserId, updated);
    },
    [questions, wrongRecords, activeUserId]
  );

  // Render full-bleed Intro Screen when currentView === 'intro'
  if (currentView === 'intro') {
    return <IntroScreen onNavigate={handleNavigate} />;
  }

  const selectedExam =
    exams.find((e) => e.id === selectedExamId) || exams[0];

  const allAvailableAttempts = [...userAttempts, ...demoAttempts];
  const selectedAttempt =
    allAvailableAttempts.find((a) => a.id === selectedAttemptId) ||
    userAttempts[0] ||
    demoAttempts[0];

  const unmasteredWrongCount =
    wrongRecords.filter((r) => !r.mastered).length ||
    (userAttempts.length === 0 && demoModeEnabled
      ? demoWrongRecords.filter((r) => !r.mastered).length
      : 0);

  return (
    <MainLayout
      currentView={currentView}
      currentUser={currentUser}
      theme={theme}
      unmasteredWrongCount={unmasteredWrongCount}
      globalToastMessage={globalToastMessage}
      onDismissToast={() => setGlobalToastMessage(null)}
      onNavigate={handleNavigate}
      onNavigateProfileSection={handleNavigateProfileSection}
      onConfirmLogout={handleConfirmLogout}
      onSwitchAccount={handleSwitchAccount}
      onToggleTheme={handleToggleTheme}
    >
      {currentView === 'home' && (
        <HomePage
          exams={exams}
          totalQuestionsCount={questions.length}
          userAttempts={userAttempts}
          wrongRecords={wrongRecords}
          activeSession={activeSession}
          onNavigate={handleNavigate}
          onSelectExam={(examId) => {
            setSelectedExamId(examId);
            handleNavigate('exam-detail');
          }}
          onStartExam={handleStartExam}
          onResumeActiveExam={() => {
            if (activeSession) {
              setSelectedExamId(activeSession.examId);
              handleNavigate('exam-room');
            }
          }}
          onViewAttemptResult={(attemptId) => {
            setSelectedAttemptId(attemptId);
            handleNavigate('exam-result');
          }}
        />
      )}

      {(currentView === 'login' || currentView === 'register') && (
        <AuthPages
          mode={currentView}
          users={users}
          authNotice={authNotice}
          onSwitchMode={(m) => handleNavigate(m)}
          onLoginSuccess={(loggedInUser, rememberMe) => {
            handleAuthenticateUser(loggedInUser, rememberMe);
          }}
          onRegisterSuccess={(newUser, rememberMe) => {
            const nextUsers = [...users, newUser];
            setUsers(nextUsers);
            storageService.saveUsers(nextUsers);
            handleAuthenticateUser(newUser, rememberMe);
            showGlobalToast(
              `Chào mừng ${newUser.fullName}! Tài khoản @${newUser.username} đã được khởi tạo thành công.`
            );
          }}
          onUpdateUserAccount={(updatedUser) => {
            const nextUsers = users.map((u) =>
              u.id === updatedUser.id ? updatedUser : u
            );
            setUsers(nextUsers);
            storageService.saveUsers(nextUsers);
          }}
          onNavigate={handleNavigate}
        />
      )}

      {currentView === 'dashboard' && currentUser && (
        <StudentDashboard
          user={currentUser}
          exams={exams}
          questions={questions}
          realAttempts={userAttempts}
          realWrongRecords={wrongRecords}
          demoModeEnabled={demoModeEnabled}
          demoAttempts={demoAttempts}
          demoWrongRecords={demoWrongRecords}
          activeSession={activeSession}
          onToggleDemoMode={handleToggleDemoMode}
          onNavigate={handleNavigate}
          onSelectExam={(examId) => {
            setSelectedExamId(examId);
            handleNavigate('exam-detail');
          }}
          onResumeActiveExam={() => {
            if (activeSession) {
              setSelectedExamId(activeSession.examId);
              handleNavigate('exam-room');
            }
          }}
          onViewAttemptResult={(attemptId) => {
            setSelectedAttemptId(attemptId);
            handleNavigate('exam-result');
          }}
        />
      )}

      {currentView === 'exams' && (
        <ExamLibraryPage
          exams={exams}
          userAttempts={userAttempts}
          onSelectExamDetail={(examId) => {
            setSelectedExamId(examId);
            handleNavigate('exam-detail');
          }}
          onStartExamDirect={handleStartExam}
        />
      )}

      {currentView === 'exam-detail' && selectedExam && (
        <ExamDetailPage
          exam={selectedExam}
          previousAttempts={userAttempts.filter((a) => a.examId === selectedExam.id)}
          onBack={() => handleNavigate('exams')}
          onStartExam={handleStartExam}
          onViewAttemptResult={(attemptId) => {
            setSelectedAttemptId(attemptId);
            handleNavigate('exam-result');
          }}
        />
      )}

      {currentView === 'exam-room' && selectedExam && activeSession && (
        <ExamRoomPage
          exam={selectedExam}
          questions={questions}
          session={activeSession}
          onUpdateSession={handleUpdateActiveSession}
          onSubmitExam={handleSubmitExam}
          onExitRoom={() => handleNavigate(currentUser ? 'dashboard' : 'exams')}
        />
      )}

      {(currentView === 'exam-result' || currentView === 'wrong-analysis') &&
        selectedAttempt && (
          <ExamResultPage
            attempt={selectedAttempt}
            exam={exams.find((e) => e.id === selectedAttempt.examId)}
            questions={questions}
            onNavigate={handleNavigate}
            onRetakeExam={handleStartExam}
          />
        )}

      {currentView === 'question-bank' && (
        <QuestionBankPage questions={questions} />
      )}

      {(currentView === 'practice' || currentView === 'wrong-practice') && (
        <PracticeCenterPage
          key={currentView}
          initialMode={currentView === 'wrong-practice' ? 'wrong' : 'topic'}
          questions={questions}
          wrongRecords={wrongRecords}
          demoWrongRecords={demoWrongRecords}
          isShowingDemo={userAttempts.length === 0 && demoModeEnabled}
          onRecordPracticeAnswer={handleRecordPracticeAnswer}
          onNavigate={handleNavigate}
        />
      )}

      {(currentView === 'history' || currentView === 'statistics') && (
        <HistoryAndStatsPage
          initialTab={currentView}
          exams={exams}
          questions={questions}
          realAttempts={userAttempts}
          demoAttempts={demoAttempts}
          demoModeEnabled={demoModeEnabled}
          onToggleDemoMode={handleToggleDemoMode}
          onViewAttemptResult={(attemptId) => {
            setSelectedAttemptId(attemptId);
            handleNavigate('exam-result');
          }}
          onNavigate={handleNavigate}
        />
      )}

      {currentView === 'profile' && currentUser && (
        <UserProfilePage
          user={currentUser}
          initialSection={profileSection}
          theme={theme}
          realAttempts={userAttempts}
          onUpdateProfile={(updatedUser) => {
            const nextUsers = users.map((u) =>
              u.id === updatedUser.id ? updatedUser : u
            );
            setUsers(nextUsers);
            storageService.saveUsers(nextUsers);
            setCurrentUser(updatedUser);
          }}
          onToggleTheme={handleToggleTheme}
          onRequestLogout={handleConfirmLogout}
        />
      )}

      {currentView === 'about' && (
        <AboutProductPage onNavigate={handleNavigate} />
      )}

      {currentView === 'admin' && (
        <AdminPortalPage
          currentUser={currentUser}
          exams={exams}
          questions={questions}
          users={users}
          allAttempts={storageService.getAllAttempts()}
          loginHistory={storageService.getLoginHistory()}
          onSaveExams={(nextExams) => {
            setExams(nextExams);
            storageService.saveExams(nextExams);
          }}
          onSaveQuestions={(nextQuestions) => {
            setQuestions(nextQuestions);
            storageService.saveQuestions(nextQuestions);
          }}
          onSaveUsers={(nextUsers) => {
            setUsers(nextUsers);
            storageService.saveUsers(nextUsers);
            if (currentUser) {
              const updatedSelf = nextUsers.find((u) => u.id === currentUser.id);
              if (updatedSelf) setCurrentUser(updatedSelf);
            }
          }}
          onNavigateToLogin={() => handleNavigate('login')}
        />
      )}
    </MainLayout>
  );
}
