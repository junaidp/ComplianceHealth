import { useEffect, useState } from 'react';
import api from '../lib/api';
import { ScrollText, Filter, Clock, User } from 'lucide-react';

interface LogEntry {
  id: string; action: string; entityType: string | null; entityId: string | null;
  timestamp: string; ipAddress: string;
  user?: { firstName: string; lastName: string; email: string };
  oldValue: any; newValue: any;
}

const actionColors: Record<string, string> = {
  ASSESSMENT_FINALIZED: 'bg-green-100 text-green-800',
  TASK_CLOSED: 'bg-blue-100 text-blue-800',
  EVIDENCE_UPLOADED: 'bg-purple-100 text-purple-800',
  TRAINING_COMPLETED: 'bg-teal-100 text-teal-800',
  TRAINING_MAX_ATTEMPTS_REACHED: 'bg-red-100 text-red-800',
};

export default function AuditLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    const params: any = { page, per_page: 25 };
    if (filterAction) params.action = filterAction;
    if (filterEntity) params.entity_type = filterEntity;
    api.get('/audit-log', { params }).then(r => {
      setLogs(r.data.data || []);
      setTotal(r.data.total || 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchLogs(); }, [page, filterAction, filterEntity]);

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <ScrollText className="w-7 h-7 text-primary-600" /> Audit Log
        </h1>
        <p className="text-gray-500 mt-1">
          Immutable, append-only audit trail. {total} entries. No records can be modified or deleted.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Actions</option>
          <option value="ASSESSMENT_CREATED">Assessment Created</option>
          <option value="ASSESSMENT_FINALIZED">Assessment Finalized</option>
          <option value="RESPONSE_SAVED">Response Saved</option>
          <option value="TASK_STATUS_CHANGED">Task Status Changed</option>
          <option value="TASK_CLOSED">Task Closed</option>
          <option value="EVIDENCE_UPLOADED">Evidence Uploaded</option>
          <option value="TRAINING_COMPLETED">Training Completed</option>
          <option value="PROFILE_UPDATED">Profile Updated</option>
          <option value="USER_LOGIN">User Login</option>
        </select>
        <select value={filterEntity} onChange={e => { setFilterEntity(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Entities</option>
          <option value="assessment">Assessment</option>
          <option value="task">Task</option>
          <option value="control">Control</option>
          <option value="evidence">Evidence</option>
          <option value="training">Training</option>
          <option value="user">User</option>
          <option value="organization">Organization</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ScrollText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No Audit Log Entries</h3>
          <p className="text-gray-500 mt-2">Actions will be logged here as they occur.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Entity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {log.user ? (
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium text-gray-900">{log.user.firstName} {log.user.lastName}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[log.action] || 'bg-gray-100 text-gray-800'}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {log.entityType && <span className="font-mono text-xs">{log.entityType}:{log.entityId?.substring(0, 8)}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-500">Page {page} of {totalPages} ({total} entries)</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50">Previous</button>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
