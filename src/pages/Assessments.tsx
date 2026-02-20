import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { ClipboardCheck, Plus, ChevronRight, CheckCircle2, Clock, FileText, Lock } from 'lucide-react';
import clsx from 'clsx';

interface Assessment {
  id: string;
  assessmentVersion: number;
  status: string;
  overallScore: number | null;
  totalControlsAssessed: number | null;
  criticalGaps: number | null;
  highGaps: number | null;
  createdAt: string;
  finalizedAt: string | null;
  _count?: { responses: number };
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  IN_REVIEW: 'bg-blue-100 text-blue-800',
  FINALIZED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-gray-100 text-gray-800',
};

export default function Assessments() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/assessments').then(r => {
      setAssessments(r.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const createAssessment = async () => {
    setCreating(true);
    try {
      const { data } = await api.post('/assessments');
      toast.success('Assessment created');
      navigate(`/assessments/${data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create assessment');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
          <p className="text-gray-500 mt-1">Manage your PDPL compliance assessments across all 119 controls.</p>
        </div>
        <button onClick={createAssessment} disabled={creating}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
          <Plus className="w-4 h-4" />
          {creating ? 'Creating...' : 'New Assessment'}
        </button>
      </div>

      {assessments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No Assessments Yet</h3>
          <p className="text-gray-500 mt-2 max-w-md mx-auto">
            Create your first PDPL compliance assessment to evaluate your organization against all 119 controls across the three regulatory layers.
          </p>
          <button onClick={createAssessment} disabled={creating}
            className="mt-6 px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
            Start First Assessment
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map(a => (
            <div key={a.id}
              onClick={() => navigate(`/assessments/${a.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                  {a.status === 'FINALIZED' ? <CheckCircle2 className="w-6 h-6 text-green-600" /> :
                   a.status === 'ARCHIVED' ? <Lock className="w-6 h-6 text-gray-400" /> :
                   <FileText className="w-6 h-6 text-primary-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900">Assessment v{a.assessmentVersion}</h3>
                    <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-medium', statusColors[a.status])}>
                      {a.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(a.createdAt).toLocaleDateString()}
                    </span>
                    {a.overallScore != null && (
                      <span className={clsx('font-semibold',
                        a.overallScore >= 80 ? 'text-green-600' : a.overallScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                      )}>
                        {Math.round(Number(a.overallScore))}% Score
                      </span>
                    )}
                    {a.criticalGaps != null && a.criticalGaps > 0 && (
                      <span className="text-red-600 font-medium">{a.criticalGaps} Critical Gaps</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
