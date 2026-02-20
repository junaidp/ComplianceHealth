import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, MinusCircle, XCircle, Save, Lock } from 'lucide-react';
import clsx from 'clsx';

interface Control {
  id: string;
  ref: string;
  source: string;
  domainNumber: number;
  domainName: string;
  objectiveEn: string;
  riskLevel: string;
  regArticles: string | null;
  pdplArticles: string | null;
  transferRegArticles: string | null;
  ncaRef: string | null;
  mohPolicyRef: string | null;
  evidenceGuidanceEn: string | null;
  pointsYes: number;
  pointsPartial: number;
  mandatoryForTypes: string[];
}

interface ResponseData {
  controlId: string;
  answer: string;
  naJustification?: string;
  notes?: string;
  pointsEarned: number;
}

interface AssessmentData {
  id: string;
  assessmentVersion: number;
  status: string;
  overallScore: number | null;
  domainScores: Record<string, any> | null;
  responses: ResponseData[];
}

const riskColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  LOW: 'bg-blue-100 text-blue-800 border-blue-200',
};

const answerOptions = [
  { value: 'YES', label: 'Yes — Fully Implemented', icon: CheckCircle2, color: 'border-green-500 bg-green-50 text-green-800' },
  { value: 'PARTIAL', label: 'Partial — In Progress', icon: MinusCircle, color: 'border-yellow-500 bg-yellow-50 text-yellow-800' },
  { value: 'NO', label: 'No — Not Implemented', icon: XCircle, color: 'border-red-500 bg-red-50 text-red-800' },
  { value: 'NA', label: 'N/A — Not Applicable', icon: AlertTriangle, color: 'border-gray-400 bg-gray-50 text-gray-700' },
];

export default function AssessmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [responses, setResponses] = useState<Map<string, { answer: string; naJustification: string; notes: string }>>(new Map());
  const [activeDomain, setActiveDomain] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [aRes, cRes] = await Promise.all([
          api.get(`/assessments/${id}`),
          api.get('/controls/applicable'),
        ]);
        setAssessment(aRes.data);
        setControls(cRes.data.data || cRes.data);
        const resMap = new Map<string, { answer: string; naJustification: string; notes: string }>();
        (aRes.data.responses || []).forEach((r: ResponseData) => {
          resMap.set(r.controlId, { answer: r.answer, naJustification: r.naJustification || '', notes: r.notes || '' });
        });
        setResponses(resMap);
      } catch (err) {
        toast.error('Failed to load assessment');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const domains = [...new Map(controls.map(c => [c.domainNumber, { number: c.domainNumber, name: c.domainName }])).values()]
    .sort((a, b) => a.number - b.number);

  const domainControls = controls.filter(c => c.domainNumber === activeDomain);

  const setAnswer = (controlId: string, answer: string) => {
    const existing = responses.get(controlId) || { answer: '', naJustification: '', notes: '' };
    const updated = new Map(responses);
    updated.set(controlId, { ...existing, answer });
    setResponses(updated);
  };

  const setField = (controlId: string, field: 'naJustification' | 'notes', value: string) => {
    const existing = responses.get(controlId) || { answer: '', naJustification: '', notes: '' };
    const updated = new Map(responses);
    updated.set(controlId, { ...existing, [field]: value });
    setResponses(updated);
  };

  const saveResponses = async () => {
    setSaving(true);
    try {
      const entries = Array.from(responses.entries()).filter(([, v]) => v.answer);
      for (const [controlId, resp] of entries) {
        await api.put(`/assessments/${id}/responses/${controlId}`, {
          answer: resp.answer,
          naJustification: resp.answer === 'NA' ? resp.naJustification : undefined,
          notes: resp.notes || undefined,
        });
      }
      toast.success('Responses saved');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const finalizeAssessment = async () => {
    if (!confirm('Finalize this assessment? This will calculate scores, generate remediation tasks, and lock the assessment.')) return;
    setFinalizing(true);
    try {
      const { data } = await api.post(`/assessments/${id}/finalize`);
      setAssessment(data.assessment || data);
      toast.success(`Assessment finalized! Score: ${Math.round(Number(data.assessment?.overallScore || data.overallScore))}%`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Finalization failed');
    } finally {
      setFinalizing(false);
    }
  };

  const isLocked = assessment?.status === 'FINALIZED' || assessment?.status === 'ARCHIVED';
  const totalAnswered = Array.from(responses.values()).filter(r => r.answer).length;
  const progressPct = controls.length > 0 ? Math.round((totalAnswered / controls.length) * 100) : 0;

  const getDomainProgress = (domainNum: number) => {
    const dc = controls.filter(c => c.domainNumber === domainNum);
    const answered = dc.filter(c => responses.get(c.id)?.answer).length;
    return dc.length > 0 ? Math.round((answered / dc.length) * 100) : 0;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/assessments')} className="p-2 rounded-lg hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Assessment v{assessment?.assessmentVersion}</h1>
            <p className="text-sm text-gray-500">{totalAnswered} of {controls.length} controls answered ({progressPct}%)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isLocked && (
            <>
              <button onClick={saveResponses} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={finalizeAssessment} disabled={finalizing}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
                <Lock className="w-4 h-4" />
                {finalizing ? 'Finalizing...' : 'Finalize'}
              </button>
            </>
          )}
          {isLocked && assessment?.overallScore != null && (
            <div className={clsx('px-4 py-2 rounded-lg font-bold text-lg',
              Number(assessment.overallScore) >= 80 ? 'bg-green-100 text-green-800' :
              Number(assessment.overallScore) >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
            )}>
              {Math.round(Number(assessment.overallScore))}% Score
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Overall Progress</span>
          <span className="text-sm font-semibold text-primary-600">{progressPct}%</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full">
          <div className="h-2.5 bg-primary-600 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="flex gap-6">
        {/* Domain Navigation */}
        <div className="w-72 shrink-0 space-y-1">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">Domains</h3>
          {domains.map(d => {
            const pct = getDomainProgress(d.number);
            return (
              <button key={d.number} onClick={() => setActiveDomain(d.number)}
                className={clsx('w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors',
                  activeDomain === d.number ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                )}>
                <div className="flex items-center justify-between">
                  <span className="truncate">D{d.number}. {d.name}</span>
                  <span className={clsx('text-xs font-medium ml-2 shrink-0',
                    pct === 100 ? 'text-green-600' : pct > 0 ? 'text-primary-600' : 'text-gray-400'
                  )}>{pct}%</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Controls List */}
        <div className="flex-1 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Domain {activeDomain}: {domains.find(d => d.number === activeDomain)?.name}
          </h2>
          {domainControls.map(control => {
            const resp = responses.get(control.id);
            const isMandatory = control.mandatoryForTypes && control.mandatoryForTypes.length > 0;
            return (
              <div key={control.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className={clsx('px-2 py-0.5 rounded text-xs font-semibold border shrink-0', riskColors[control.riskLevel])}>
                    {control.riskLevel}
                  </span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{control.ref} — {control.id}</h4>
                    <p className="text-sm text-gray-700 mt-1">{control.objectiveEn}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {control.regArticles && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{control.regArticles}</span>}
                      {control.pdplArticles && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded">{control.pdplArticles}</span>}
                      {control.ncaRef && <span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded">NCA {control.ncaRef}</span>}
                      {control.mohPolicyRef && <span className="text-xs bg-pink-50 text-pink-700 px-2 py-0.5 rounded">{control.mohPolicyRef}</span>}
                      {control.transferRegArticles && <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded">{control.transferRegArticles}</span>}
                      {isMandatory && <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded font-semibold">MANDATORY</span>}
                    </div>
                    {control.evidenceGuidanceEn && (
                      <p className="text-xs text-gray-500 mt-2">
                        <span className="font-medium">Evidence:</span> {control.evidenceGuidanceEn}
                      </p>
                    )}
                  </div>
                </div>

                {/* Answer Options */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                  {answerOptions.map(opt => {
                    const isNA = opt.value === 'NA';
                    const disabled = isLocked || (isNA && isMandatory);
                    const selected = resp?.answer === opt.value;
                    return (
                      <button key={opt.value} disabled={disabled}
                        onClick={() => setAnswer(control.id, opt.value)}
                        className={clsx(
                          'flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                          selected ? opt.color : 'border-gray-200 text-gray-500 hover:border-gray-300',
                          disabled && 'opacity-40 cursor-not-allowed'
                        )}>
                        <opt.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{opt.label.split('—')[0].trim()}</span>
                      </button>
                    );
                  })}
                </div>

                {/* N/A Justification */}
                {resp?.answer === 'NA' && (
                  <div className="mt-3">
                    <label className="text-xs font-medium text-gray-600">N/A Justification (min 20 chars)</label>
                    <textarea value={resp.naJustification} onChange={e => setField(control.id, 'naJustification', e.target.value)}
                      disabled={isLocked} rows={2} minLength={20}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-50" />
                  </div>
                )}

                {/* Notes */}
                {resp?.answer && resp.answer !== 'NA' && (
                  <div className="mt-3">
                    <label className="text-xs font-medium text-gray-600">Notes (optional)</label>
                    <textarea value={resp.notes || ''} onChange={e => setField(control.id, 'notes', e.target.value)}
                      disabled={isLocked} rows={2}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none disabled:bg-gray-50" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Domain Navigation */}
          <div className="flex items-center justify-between pt-4">
            <button onClick={() => setActiveDomain(Math.max(1, activeDomain - 1))} disabled={activeDomain === 1}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" /> Previous Domain
            </button>
            <button onClick={() => {
              saveResponses();
              setActiveDomain(Math.min(domains.length > 0 ? domains[domains.length - 1].number : 10, activeDomain + 1));
            }} disabled={activeDomain === (domains.length > 0 ? domains[domains.length - 1].number : 10)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-40">
              Save & Next Domain <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
