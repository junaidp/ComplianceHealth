import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { ListTodo, Filter, ChevronDown, Clock, Bot, User } from 'lucide-react';
import clsx from 'clsx';

interface Task {
  id: string;
  controlId: string;
  title: string;
  gapType: string;
  riskLevel: string;
  status: string;
  deadline: string;
  notes: string | null;
  aiGuidance: string | null;
  owner?: { firstName: string; lastName: string; email: string } | null;
  control?: { ref: string; objectiveEn: string; domainName: string };
}

const statusOptions = ['OPEN', 'IN_PROGRESS', 'UNDER_REVIEW', 'CLOSED', 'DEFERRED'];
const riskOptions = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const statusColors: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  UNDER_REVIEW: 'bg-blue-100 text-blue-800',
  CLOSED: 'bg-green-100 text-green-800',
  DEFERRED: 'bg-gray-100 text-gray-800',
};

const riskColors: Record<string, string> = {
  CRITICAL: 'text-red-600', HIGH: 'text-orange-600', MEDIUM: 'text-yellow-600', LOW: 'text-blue-600',
};

export default function Remediation() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRisk, setFilterRisk] = useState('');
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);

  const fetchTasks = () => {
    const params: any = {};
    if (filterStatus) params.status = filterStatus;
    if (filterRisk) params.risk_level = filterRisk;
    api.get('/remediation/tasks', { params }).then(r => {
      setTasks(r.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchTasks(); }, [filterStatus, filterRisk]);

  const updateStatus = async (taskId: string, status: string) => {
    try {
      await api.put(`/remediation/tasks/${taskId}/status`, { status });
      toast.success(`Task status updated to ${status}`);
      fetchTasks();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Status update failed');
    }
  };

  const generateAI = async (taskId: string) => {
    setGeneratingAI(taskId);
    try {
      const { data } = await api.post('/ai/remediation-guidance', { taskId });
      toast.success(data.cached ? 'Guidance loaded from cache' : 'AI guidance generated');
      fetchTasks();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to generate AI guidance');
    } finally {
      setGeneratingAI(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }

  const overdueTasks = tasks.filter(t => ['OPEN', 'IN_PROGRESS'].includes(t.status) && new Date(t.deadline) < new Date());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <ListTodo className="w-7 h-7 text-primary-600" />
          Remediation Tracker
        </h1>
        <p className="text-gray-500 mt-1">
          {tasks.length} total tasks · {overdueTasks.length} overdue
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">All Statuses</option>
            {statusOptions.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Risk Levels</option>
          {riskOptions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Tasks */}
      {tasks.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ListTodo className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No Remediation Tasks</h3>
          <p className="text-gray-500 mt-2">Complete an assessment to auto-generate remediation tasks from gaps.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => {
            const isExpanded = expandedTask === task.id;
            const isOverdue = ['OPEN', 'IN_PROGRESS'].includes(task.status) && new Date(task.deadline) < new Date();
            return (
              <div key={task.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={clsx('text-xs font-bold', riskColors[task.riskLevel])}>{task.riskLevel}</span>
                        <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', statusColors[task.status])}>
                          {task.status.replace('_', ' ')}
                        </span>
                        {task.gapType === 'GAP' && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded">Full Gap</span>}
                        {task.gapType === 'PARTIAL' && <span className="text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded">Partial</span>}
                        {isOverdue && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded font-semibold">OVERDUE</span>}
                      </div>
                      <h3 className="font-semibold text-gray-900 mt-1">{task.controlId} — {task.title}</h3>
                      {task.control && <p className="text-sm text-gray-500 mt-0.5">{task.control.domainName}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(task.deadline).toLocaleDateString()}
                        </div>
                        {task.owner && (
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            <User className="w-3 h-3" />
                            {task.owner.firstName} {task.owner.lastName}
                          </div>
                        )}
                      </div>
                      <ChevronDown className={clsx('w-5 h-5 text-gray-400 transition-transform', isExpanded && 'rotate-180')} />
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 p-5 bg-gray-50 space-y-4">
                    {task.control && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Control Objective</p>
                        <p className="text-sm text-gray-600 mt-1">{task.control.objectiveEn}</p>
                      </div>
                    )}

                    {/* Status Actions */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Update Status</p>
                      <div className="flex flex-wrap gap-2">
                        {statusOptions.filter(s => s !== task.status).map(s => (
                          <button key={s} onClick={() => updateStatus(task.id, s)}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:bg-white transition-colors">
                            → {s.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* AI Guidance */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <Bot className="w-4 h-4 text-primary-600" /> AI Remediation Guidance
                        </p>
                        <button onClick={() => generateAI(task.id)} disabled={generatingAI === task.id}
                          className="text-xs text-primary-600 font-medium hover:underline disabled:opacity-50">
                          {generatingAI === task.id ? 'Generating...' : task.aiGuidance ? 'Regenerate' : 'Generate'}
                        </button>
                      </div>
                      {task.aiGuidance ? (
                        <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-80 overflow-y-auto">
                          {task.aiGuidance}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Click "Generate" for AI-powered remediation guidance.</p>
                      )}
                    </div>

                    {task.notes && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Notes</p>
                        <p className="text-sm text-gray-600 mt-1">{task.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
