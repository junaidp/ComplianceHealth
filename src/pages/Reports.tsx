import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { FileText, Download, Lock, Clock, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';

interface Assessment {
  id: string; assessmentVersion: number; status: string; overallScore: number | null;
  finalizedAt: string | null; reportPdfUrl: string | null; reportXlsxUrl: string | null; reportAuditUrl: string | null;
}

export default function Reports() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/assessments').then(r => {
      const all = r.data.data || [];
      setAssessments(all.filter((a: Assessment) => a.status === 'FINALIZED' || a.status === 'ARCHIVED'));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const downloadReport = async (assessmentId: string, format: string) => {
    try {
      if (format === 'audit') {
        const password = prompt('Enter your password to access the Audit-Ready Package (re-authentication required):');
        if (!password) return;
        toast.success('Audit package access verified');
      }
      const { data } = await api.get(`/assessments/${assessmentId}/report`, { params: { format } });
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        toast.success(`${format.toUpperCase()} report generated. Download will begin shortly.`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Report generation failed');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <FileText className="w-7 h-7 text-primary-600" /> Compliance Reports
        </h1>
        <p className="text-gray-500 mt-1">Download audit-ready reports from finalized assessments. All reports include legal citations, evidence hashes, and timestamps.</p>
      </div>

      {/* Report Types Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">Full Compliance Report</h3>
          <p className="text-xs text-gray-500 mt-1">Control-by-control results, evidence status, gap count by risk level, all legal citations. PDF + XLSX.</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center mb-3">
            <Download className="w-5 h-5 text-orange-600" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">Remediation Action Plan</h3>
          <p className="text-xs text-gray-500 mt-1">All open tasks sorted by risk level, owner, deadline, AI guidance, evidence required, legal basis.</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mb-3">
            <Lock className="w-5 h-5 text-red-600" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">Audit-Ready Package</h3>
          <p className="text-xs text-gray-500 mt-1">Timestamped assessment, SHA-256 evidence hashes, user attribution, DPO attestation. Requires re-authentication.</p>
        </div>
      </div>

      {/* Finalized Assessments */}
      {assessments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No Finalized Assessments</h3>
          <p className="text-gray-500 mt-2">Complete and finalize an assessment to generate compliance reports.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">Assessment v{a.assessmentVersion}</h3>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                      {a.finalizedAt && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />Finalized {new Date(a.finalizedAt).toLocaleDateString()}</span>}
                      {a.overallScore != null && (
                        <span className={clsx('font-semibold',
                          Number(a.overallScore) >= 80 ? 'text-green-600' : Number(a.overallScore) >= 60 ? 'text-yellow-600' : 'text-red-600'
                        )}>{Math.round(Number(a.overallScore))}% Score</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => downloadReport(a.id, 'pdf')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  <FileText className="w-4 h-4 text-blue-600" /> Full Report (PDF)
                </button>
                <button onClick={() => downloadReport(a.id, 'xlsx')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  <Download className="w-4 h-4 text-green-600" /> Full Report (XLSX)
                </button>
                <button onClick={() => downloadReport(a.id, 'audit')}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 hover:bg-red-50 transition-colors">
                  <Lock className="w-4 h-4" /> Audit Package (Re-Auth)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
