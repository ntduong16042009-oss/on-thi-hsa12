import {
  ActiveExamSession,
  AuthSession,
  Exam,
  ExamAttempt,
  LoginHistoryEntry,
  Question,
  UserAccount,
  WrongQuestionRecord,
} from '../types';
import { INITIAL_EXAMS, INITIAL_QUESTIONS } from '../data/examsData';
import {
  createAuthSession,
  generateSalt,
  isAuthSessionValid,
} from '../utils/authSecurity';

const STORAGE_KEYS = {
  THEME_GLOBAL: 'hsa_master_theme_v1',
  USERS: 'hsa_master_users_v2',
  SUPER_ADMIN_BOOTSTRAPPED: 'hsa_master_super_admin_init_v1',
  LOGIN_HISTORY: 'hsa_master_login_history_v1',
  PERSISTENT_SESSION: 'hsa_master_persistent_session_v2',
  TAB_SESSION: 'hsa_master_tab_session_v2',
  LEGACY_REMEMBERED_V2: 'hsa_master_remembered_accounts_v2',
  LEGACY_REMEMBERED_V1: 'hsa_master_remembered_accounts_v1',
  LEGACY_EXPLICIT_LOGOUT: 'hsa_master_explicit_logout_v2',
  EXAMS: 'hsa_master_exams_v1',
  QUESTIONS: 'hsa_master_questions_v1',
  ATTEMPTS: 'hsa_master_attempts_v1',
  WRONG_RECORDS: 'hsa_master_wrong_records_v1',
  ACTIVE_EXAM_SESSION: 'hsa_master_active_session_v1',
  DEMO_MODE_ENABLED: 'hsa_master_demo_stats_enabled_v1',
};

const LEGACY_DEMO_USER_IDS = new Set([
  'user-student-loi',
  'user-student-huyen',
  'user-admin-hsa',
]);

// Initial Super Admin Account (NO plain-text password in source code; uses first-time password setup flow)
export const INITIAL_SUPER_ADMIN_ACCOUNT: UserAccount = {
  id: 'user-super-admin-dat',
  fullName: 'Nguyễn Văn Đạt',
  username: 'dat020920',
  email: 'datnguyen02092009@gmail.com',
  passwordSalt: generateSalt('super_admin_dat020920'),
  passwordDigest: '', // Empty until first-time password setup is completed by the user
  requiresPasswordSetup: true,
  role: 'super_admin',
  className: '12A03',
  schoolName: 'Trường THPT Yên Lãng',
  academicYear: '2026–2027',
  joinedAt: '2026-09-01',
  status: 'active',
  preferences: { theme: 'light' },
};

function safeGetLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSetLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function safeGetSession<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSetSession<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export const storageService = {
  /**
   * Cleans up legacy remembered-account lists and old demo accounts,
   * and ensures the single Super Admin account (Nguyễn Văn Đạt - dat020920) is initialized once without duplication.
   */
  cleanupAndEnsureSuperAdmin(): UserAccount[] {
    try {
      localStorage.removeItem(STORAGE_KEYS.LEGACY_REMEMBERED_V2);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_REMEMBERED_V1);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_EXPLICIT_LOGOUT);

      const rawStored = safeGetLocal<UserAccount[] | null>(STORAGE_KEYS.USERS, null);
      const filtered = (rawStored || []).filter(
        (u) => u && !LEGACY_DEMO_USER_IDS.has(u.id)
      );

      // Deduplicate by username/email (case-insensitive)
      const seenUsernames = new Set<string>();
      const seenEmails = new Set<string>();
      const deduplicated: UserAccount[] = [];

      for (const acc of filtered) {
        const uKey = acc.username.trim().toLowerCase();
        const eKey = acc.email.trim().toLowerCase();
        if (seenUsernames.has(uKey) || seenEmails.has(eKey)) continue;
        seenUsernames.add(uKey);
        seenEmails.add(eKey);
        deduplicated.push({
          ...acc,
          passwordSalt: acc.passwordSalt || generateSalt(acc.id),
          passwordDigest: acc.passwordDigest || '',
          requiresPasswordSetup:
            acc.requiresPasswordSetup ?? !acc.passwordDigest,
          preferences: acc.preferences || { theme: 'light' },
        });
      }

      // Ensure Super Admin account (dat020920 / datnguyen02092009@gmail.com) exists exactly once
      const hasSuperAdmin = deduplicated.some(
        (u) =>
          u.username.toLowerCase() ===
            INITIAL_SUPER_ADMIN_ACCOUNT.username.toLowerCase() ||
          u.email.toLowerCase() ===
            INITIAL_SUPER_ADMIN_ACCOUNT.email.toLowerCase() ||
          u.id === INITIAL_SUPER_ADMIN_ACCOUNT.id
      );

      let finalUsers = deduplicated;
      if (!hasSuperAdmin) {
        finalUsers = [INITIAL_SUPER_ADMIN_ACCOUNT, ...deduplicated];
      } else {
        // Ensure the existing dat020920 account always retains role: 'super_admin' and active status
        finalUsers = deduplicated.map((u) => {
          if (
            u.username.toLowerCase() ===
              INITIAL_SUPER_ADMIN_ACCOUNT.username.toLowerCase() ||
            u.email.toLowerCase() ===
              INITIAL_SUPER_ADMIN_ACCOUNT.email.toLowerCase()
          ) {
            return {
              ...u,
              role: 'super_admin' as const,
              status: 'active' as const,
            };
          }
          return u;
        });
      }

      safeSetLocal(STORAGE_KEYS.USERS, finalUsers);
      localStorage.setItem(STORAGE_KEYS.SUPER_ADMIN_BOOTSTRAPPED, 'true');

      // Remove any stale session belonging to old demo accounts
      const persistent = safeGetLocal<AuthSession | null>(
        STORAGE_KEYS.PERSISTENT_SESSION,
        null
      );
      if (persistent && LEGACY_DEMO_USER_IDS.has(persistent.userId)) {
        localStorage.removeItem(STORAGE_KEYS.PERSISTENT_SESSION);
      }

      const tabSess = safeGetSession<AuthSession | null>(
        STORAGE_KEYS.TAB_SESSION,
        null
      );
      if (tabSess && LEGACY_DEMO_USER_IDS.has(tabSess.userId)) {
        sessionStorage.removeItem(STORAGE_KEYS.TAB_SESSION);
      }

      return finalUsers;
    } catch {
      return [INITIAL_SUPER_ADMIN_ACCOUNT];
    }
  },

  // Per-account Theme & Global Fallback
  getTheme(userId?: string): 'light' | 'dark' {
    try {
      if (userId) {
        const userTheme = localStorage.getItem(
          `${STORAGE_KEYS.THEME_GLOBAL}_${userId}`
        );
        if (userTheme === 'dark' || userTheme === 'light') return userTheme;
      }
      const saved = localStorage.getItem(STORAGE_KEYS.THEME_GLOBAL);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // ignore
    }
    return 'light';
  },

  setTheme(theme: 'light' | 'dark', userId?: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.THEME_GLOBAL, theme);
      if (userId) {
        localStorage.setItem(`${STORAGE_KEYS.THEME_GLOBAL}_${userId}`, theme);
      }
    } catch {
      // ignore
    }
  },

  // Users Database in LocalStorage (Salted Hash Digests Only - Never Plaintext)
  getUsers(): UserAccount[] {
    return this.cleanupAndEnsureSuperAdmin();
  },

  saveUsers(users: UserAccount[]): void {
    const clean = users.filter((u) => !LEGACY_DEMO_USER_IDS.has(u.id));
    safeSetLocal(STORAGE_KEYS.USERS, clean);
  },

  // Login History in LocalStorage
  getLoginHistory(userId?: string): LoginHistoryEntry[] {
    const all = safeGetLocal<LoginHistoryEntry[]>(STORAGE_KEYS.LOGIN_HISTORY, []);
    if (!userId) return all;
    return all.filter((entry) => entry.userId === userId);
  },

  recordLoginHistory(user: UserAccount): void {
    const all = safeGetLocal<LoginHistoryEntry[]>(STORAGE_KEYS.LOGIN_HISTORY, []);
    const newEntry: LoginHistoryEntry = {
      id: `LOGIN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      loggedInAt: new Date().toISOString(),
    };
    const updated = [newEntry, ...all].slice(0, 100);
    safeSetLocal(STORAGE_KEYS.LOGIN_HISTORY, updated);
  },

  // Session Management (Persistent Session vs Tab Session)
  getActiveAuthSession(): AuthSession | null {
    // 1. Check short-lived tab session in sessionStorage first
    const tabSession = safeGetSession<AuthSession | null>(
      STORAGE_KEYS.TAB_SESSION,
      null
    );
    if (tabSession && isAuthSessionValid(tabSession)) {
      return tabSession;
    }

    // 2. Check persistent Remember Me session in localStorage
    const persistentSession = safeGetLocal<AuthSession | null>(
      STORAGE_KEYS.PERSISTENT_SESSION,
      null
    );
    if (persistentSession && isAuthSessionValid(persistentSession)) {
      return persistentSession;
    }

    return null;
  },

  getCurrentUser(): UserAccount | null {
    const users = this.getUsers();
    const session = this.getActiveAuthSession();

    if (session) {
      const matched = users.find(
        (u) => u.id === session.userId && u.status === 'active'
      );
      if (matched) return matched;
    }

    return null;
  },

  establishUserSession(user: UserAccount, rememberMe: boolean): AuthSession {
    const session = createAuthSession(user, rememberMe);
    try {
      if (rememberMe) {
        safeSetLocal(STORAGE_KEYS.PERSISTENT_SESSION, session);
        sessionStorage.removeItem(STORAGE_KEYS.TAB_SESSION);
      } else {
        safeSetSession(STORAGE_KEYS.TAB_SESSION, session);
        localStorage.removeItem(STORAGE_KEYS.PERSISTENT_SESSION);
      }
      this.recordLoginHistory(user);
    } catch {
      // ignore
    }
    return session;
  },

  logoutCurrentSession(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.PERSISTENT_SESSION);
      sessionStorage.removeItem(STORAGE_KEYS.TAB_SESSION);
    } catch {
      // ignore
    }
  },

  // Questions & Exams
  getQuestions(): Question[] {
    const stored = safeGetLocal<Question[] | null>(STORAGE_KEYS.QUESTIONS, null);
    if (!stored || stored.length < INITIAL_QUESTIONS.length) {
      safeSetLocal(STORAGE_KEYS.QUESTIONS, INITIAL_QUESTIONS);
      return INITIAL_QUESTIONS;
    }
    return stored;
  },

  saveQuestions(questions: Question[]): void {
    safeSetLocal(STORAGE_KEYS.QUESTIONS, questions);
  },

  getExams(): Exam[] {
    const stored = safeGetLocal<Exam[] | null>(STORAGE_KEYS.EXAMS, null);
    if (!stored || stored.length === 0) {
      safeSetLocal(STORAGE_KEYS.EXAMS, INITIAL_EXAMS);
      return INITIAL_EXAMS;
    }
    return stored;
  },

  saveExams(exams: Exam[]): void {
    safeSetLocal(STORAGE_KEYS.EXAMS, exams);
  },

  // Active Exam Session (Strictly Scoped by userId)
  getActiveSession(userId: string): ActiveExamSession | null {
    if (!userId) return null;
    return safeGetLocal<ActiveExamSession | null>(
      `${STORAGE_KEYS.ACTIVE_EXAM_SESSION}_${userId}`,
      null
    );
  },

  saveActiveSession(userId: string, session: ActiveExamSession | null): void {
    if (!userId) return;
    try {
      if (!session) {
        localStorage.removeItem(
          `${STORAGE_KEYS.ACTIVE_EXAM_SESSION}_${userId}`
        );
      } else {
        safeSetLocal(`${STORAGE_KEYS.ACTIVE_EXAM_SESSION}_${userId}`, session);
      }
    } catch {
      // ignore
    }
  },

  // Real Exam Attempts (Strictly Isolated by userId)
  getAllAttempts(): ExamAttempt[] {
    return safeGetLocal<ExamAttempt[]>(STORAGE_KEYS.ATTEMPTS, []);
  },

  getUserAttempts(userId: string): ExamAttempt[] {
    if (!userId) return [];
    return this.getAllAttempts()
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  },

  saveAttempt(attempt: ExamAttempt): void {
    const all = this.getAllAttempts();
    const updated = [attempt, ...all.filter((a) => a.id !== attempt.id)];
    safeSetLocal(STORAGE_KEYS.ATTEMPTS, updated);
  },

  // Wrong Question Records (Strictly Isolated by userId)
  getUserWrongRecords(userId: string): WrongQuestionRecord[] {
    if (!userId) return [];
    return safeGetLocal<WrongQuestionRecord[]>(
      `${STORAGE_KEYS.WRONG_RECORDS}_${userId}`,
      []
    );
  },

  saveUserWrongRecords(userId: string, records: WrongQuestionRecord[]): void {
    if (!userId) return;
    safeSetLocal(`${STORAGE_KEYS.WRONG_RECORDS}_${userId}`, records);
  },

  // Demo Mode Sample Analytics (Scoped by userId)
  isDemoModeEnabled(userId: string): boolean {
    if (!userId) return false;
    return safeGetLocal<boolean>(
      `${STORAGE_KEYS.DEMO_MODE_ENABLED}_${userId}`,
      false
    );
  },

  setDemoModeEnabled(userId: string, enabled: boolean): void {
    if (!userId) return;
    safeSetLocal(`${STORAGE_KEYS.DEMO_MODE_ENABLED}_${userId}`, enabled);
  },

  getDemoAttempts(userId: string): ExamAttempt[] {
    const questions = this.getQuestions();
    const qMap = new Map(questions.map((q) => [q.id, q]));
    const exams = this.getExams();

    const buildDemoAttempt = (
      exam: Exam,
      idSuffix: string,
      completedAt: string,
      durationSeconds: number,
      targetCorrectRatio: number
    ): ExamAttempt => {
      const answers: Record<string, number> = {};
      let correctCount = 0;
      let wrongCount = 0;
      const total = exam.questionIds.length;
      const targetCorrect = Math.round(total * targetCorrectRatio);

      exam.questionIds.forEach((qId, idx) => {
        const q = qMap.get(qId);
        if (!q) return;
        if (idx < targetCorrect) {
          answers[qId] = q.correctAnswer;
          correctCount++;
        } else {
          answers[qId] = (q.correctAnswer + 1) % 4;
          wrongCount++;
        }
      });

      const score =
        Math.round((correctCount / total) * exam.maxScore * 10) / 10;
      const accuracyPercent = Math.round((correctCount / total) * 1000) / 10;

      return {
        id: `DEMO-ATTEMPT-${idSuffix}`,
        examId: exam.id,
        examCode: exam.code,
        examTitle: `${exam.title} [DEMO]`,
        userId,
        startedAt: completedAt,
        completedAt,
        durationSeconds,
        totalQuestions: total,
        correctCount,
        wrongCount,
        unansweredCount: 0,
        score,
        maxScore: exam.maxScore,
        accuracyPercent,
        answers,
        flaggedQuestions: [],
        isDemoData: true,
      };
    };

    return [
      buildDemoAttempt(exams[4], '01', '2026-10-02T14:30:00.000Z', 1620, 0.68),
      buildDemoAttempt(exams[2], '02', '2026-10-09T15:10:00.000Z', 1750, 0.76),
      buildDemoAttempt(exams[3], '03', '2026-10-16T09:20:00.000Z', 1680, 0.80),
      buildDemoAttempt(exams[0], '04', '2026-10-24T20:00:00.000Z', 2140, 0.87),
    ].reverse();
  },

  getDemoWrongRecords(): WrongQuestionRecord[] {
    return [
      {
        questionId: 'Q017',
        wrongCount: 2,
        correctStreak: 0,
        lastAttemptedAt: '2026-10-24T20:00:00.000Z',
        mastered: false,
        isDemoData: true,
      },
      {
        questionId: 'Q038',
        wrongCount: 1,
        correctStreak: 1,
        lastAttemptedAt: '2026-10-24T20:00:00.000Z',
        mastered: false,
        isDemoData: true,
      },
      {
        questionId: 'Q069',
        wrongCount: 2,
        correctStreak: 0,
        lastAttemptedAt: '2026-10-24T20:00:00.000Z',
        mastered: false,
        isDemoData: true,
      },
      {
        questionId: 'Q096',
        wrongCount: 1,
        correctStreak: 0,
        lastAttemptedAt: '2026-10-24T20:00:00.000Z',
        mastered: false,
        isDemoData: true,
      },
      {
        questionId: 'Q101',
        wrongCount: 1,
        correctStreak: 2,
        lastAttemptedAt: '2026-10-24T20:00:00.000Z',
        mastered: true,
        isDemoData: true,
      },
    ];
  },
};
