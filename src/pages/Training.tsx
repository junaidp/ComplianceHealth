import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { GraduationCap, Clock, CheckCircle2, XCircle, Play, Award, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface TrainingModule {
  id: string; title: string; description: string; targetRoles: string[];
  controlsAddressed: string[]; durationMinutes: number; passScore: number; maxAttempts: number;
  isAssigned: boolean;
  userRecord: { score: number | null; passed: boolean | null; attempts: number; completedAt: string | null; expiresAt: string | null } | null;
}

interface QuizQuestion {
  question: string; options: string[]; correctAnswer: number;
}

export default function Training() {
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean; results: any[] } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/training/modules').then(r => {
      setModules(r.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const startModule = async (moduleId: string) => {
    try {
      const { data } = await api.post(`/training/modules/${moduleId}/start`);
      if (data.module?.questions) {
        setQuizQuestions(data.module.questions);
        setAnswers(new Array(data.module.questions.length).fill(null));
        setQuizResult(null);
        setActiveModule(moduleId);
      } else {
        toast.error('Module has no quiz questions configured');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to start module');
    }
  };

  const submitQuiz = async () => {
    if (answers.some(a => a === null)) {
      toast.error('Please answer all questions');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post(`/training/modules/${activeModule}/submit`, { answers });
      setQuizResult(data);
      if (data.passed) {
        toast.success(`Passed! Score: ${data.score}%`);
      } else {
        toast.error(`Score: ${data.score}%. Need ${modules.find(m => m.id === activeModule)?.passScore || 80}% to pass.`);
      }
      const r = await api.get('/training/modules');
      setModules(r.data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

  if (activeModule && quizQuestions.length > 0) {
    const mod = modules.find(m => m.id === activeModule);
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{mod?.title}</h1>
            <p className="text-gray-500 mt-1">{quizQuestions.length} questions · {mod?.passScore}% to pass</p>
          </div>
          <button onClick={() => { setActiveModule(null); setQuizResult(null); }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
            Back to Modules
          </button>
        </div>

        {quizResult && (
          <div className={clsx('rounded-xl border-2 p-6 text-center',
            quizResult.passed ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50')}>
            {quizResult.passed ? <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" /> : <XCircle className="w-12 h-12 text-red-600 mx-auto mb-3" />}
            <h2 className="text-xl font-bold">{quizResult.passed ? 'Congratulations! You Passed!' : 'Not Yet — Try Again'}</h2>
            <p className="text-lg mt-2">Score: <span className="font-bold">{quizResult.score}%</span></p>
          </div>
        )}

        <div className="space-y-4">
          {quizQuestions.map((q, qi) => (
            <div key={qi} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="font-medium text-gray-900 mb-3">{qi + 1}. {q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const isSelected = answers[qi] === oi;
                  const showResult = quizResult !== null;
                  const isCorrect = oi === q.correctAnswer;
                  return (
                    <button key={oi} disabled={showResult}
                      onClick={() => { const newA = [...answers]; newA[qi] = oi; setAnswers(newA); }}
                      className={clsx('w-full text-left px-4 py-3 rounded-lg border-2 text-sm transition-all',
                        showResult && isCorrect && 'border-green-500 bg-green-50',
                        showResult && isSelected && !isCorrect && 'border-red-500 bg-red-50',
                        !showResult && isSelected && 'border-primary-500 bg-primary-50',
                        !showResult && !isSelected && 'border-gray-200 hover:border-gray-300',
                        showResult && !isSelected && !isCorrect && 'border-gray-200 opacity-60'
                      )}>
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {!quizResult && (
          <div className="flex justify-end">
            <button onClick={submitQuiz} disabled={submitting}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <GraduationCap className="w-7 h-7 text-primary-600" /> Training Portal
        </h1>
        <p className="text-gray-500 mt-1">12 PDPL compliance training modules. Gap-driven assignments. 80% pass score required.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map(m => {
          const hasCompleted = m.userRecord?.passed === true;
          const isExpired = m.userRecord?.expiresAt && new Date(m.userRecord.expiresAt) < new Date();
          const attemptsUsed = m.userRecord?.attempts || 0;
          const maxedOut = attemptsUsed >= m.maxAttempts && !hasCompleted;
          return (
            <div key={m.id} className={clsx('bg-white rounded-xl border border-gray-200 p-5 flex flex-col',
              m.isAssigned && !hasCompleted && 'ring-2 ring-primary-200')}>
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs font-mono text-gray-400">{m.id}</span>
                {hasCompleted && !isExpired && <span className="flex items-center gap-1 text-xs font-medium text-green-600"><CheckCircle2 className="w-3.5 h-3.5" /> Passed</span>}
                {hasCompleted && isExpired && <span className="flex items-center gap-1 text-xs font-medium text-orange-600"><AlertTriangle className="w-3.5 h-3.5" /> Expired</span>}
                {maxedOut && <span className="flex items-center gap-1 text-xs font-medium text-red-600"><XCircle className="w-3.5 h-3.5" /> Max Attempts</span>}
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">{m.title}</h3>
              <p className="text-xs text-gray-500 mt-1 flex-1">{m.description}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{m.durationMinutes} min</span>
                <span>{m.passScore}% to pass</span>
                <span>{attemptsUsed}/{m.maxAttempts} attempts</span>
              </div>
              {m.userRecord?.score != null && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500">Last score</span>
                    <span className="font-medium">{Math.round(Number(m.userRecord.score))}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div className={clsx('h-1.5 rounded-full', Number(m.userRecord.score) >= m.passScore ? 'bg-green-500' : 'bg-red-400')}
                      style={{ width: `${Number(m.userRecord.score)}%` }} />
                  </div>
                </div>
              )}
              <button onClick={() => startModule(m.id)} disabled={maxedOut}
                className={clsx('mt-4 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  hasCompleted && !isExpired ? 'border border-green-300 text-green-700 hover:bg-green-50' :
                  maxedOut ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
                  'bg-primary-600 text-white hover:bg-primary-700')}>
                {hasCompleted && !isExpired ? <><Award className="w-4 h-4" /> Review</> :
                 maxedOut ? 'Contact Manager' :
                 <><Play className="w-4 h-4" /> {attemptsUsed > 0 ? 'Retry' : 'Start'}</>}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
