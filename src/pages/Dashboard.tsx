import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import {
  Shield, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  ClipboardCheck, ListTodo, GraduationCap, ArrowRight
} from 'lucide-react';
import clsx from 'clsx';

interface DashboardData {
  currentScore: number | null;
  domainScores: Record<string, any> | null;
  criticalGaps: number;
  highGaps: number;
  mediumGaps: number;
  lowGaps: number;
  trend: { version: number; score: number; date: string }[];
  draftProgress: { id: string; responsesCount: number } | null;
  tasks: Record<string, number>;
}

interface KPIData {
  taskCompletionRate: number;
  trainingCompletionRate: number;
  totalTasks: number;
  closedTasks: number;
  openTasks: number;
  totalUsers: number;
  recentActivity: { action: string; entityType: string; user: { firstName: string; lastName: string }; timestamp: string }[];
}

function ScoreRing({ score }: { score: number }) {
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="160" height="160" className="-rotate-90">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle cx="80" cy="80" r={radius} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-gray-900">{score}%</span>
        <span className="text-xs text-gray-500">Compliance</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashRes, kpiRes] = await Promise.all([
          api.get('/dashboard/compliance-score'),
          api.get('/dashboard/kpis'),
        ]);
        setData(dashRes.data);
        setKpis(kpiRes.data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const gapTotal = (data?.criticalGaps || 0) + (data?.highGaps || 0) + (data?.mediumGaps || 0) + (data?.lowGaps || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Welcome back, {user?.firstName}. Here's your PDPL compliance overview.
        </p>
      </div>

      {/* Score + Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Score Card */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center">
          {data?.currentScore != null ? (
            <ScoreRing score={Math.round(data.currentScore)} />
          ) : (
            <div className="text-center py-6">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No assessment yet</p>
              <Link to="/assessments" className="text-sm text-primary-600 font-medium hover:underline mt-2 inline-block">
                Start Assessment →
              </Link>
            </div>
          )}
        </div>

        {/* Gap Stats */}
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={AlertTriangle} label="Critical Gaps" value={data?.criticalGaps || 0}
            color="red" subtext="Immediate action" />
          <StatCard icon={AlertTriangle} label="High Gaps" value={data?.highGaps || 0}
            color="orange" subtext="Within 60 days" />
          <StatCard icon={Clock} label="Open Tasks" value={data?.tasks?.OPEN || 0}
            color="blue" subtext={`${data?.tasks?.overdue || 0} overdue`} />
          <StatCard icon={CheckCircle2} label="Tasks Closed" value={data?.tasks?.CLOSED || 0}
            color="green" subtext={`${kpis?.taskCompletionRate || 0}% completion`} />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction icon={ClipboardCheck} title="Run Assessment"
          description="Start or continue your compliance assessment across all 119 controls."
          href="/assessments" color="primary" />
        <QuickAction icon={ListTodo} title="Remediation Tasks"
          description={`${(data?.tasks?.OPEN || 0) + (data?.tasks?.IN_PROGRESS || 0)} tasks need attention. ${data?.tasks?.overdue || 0} overdue.`}
          href="/remediation" color="warning" />
        <QuickAction icon={GraduationCap} title="Training Portal"
          description={`${kpis?.trainingCompletionRate || 0}% staff training completion rate.`}
          href="/training" color="success" />
      </div>

      {/* Gap Breakdown + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gap Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Gap Breakdown</h3>
          {gapTotal > 0 ? (
            <div className="space-y-3">
              <GapBar label="Critical" count={data?.criticalGaps || 0} total={gapTotal} color="bg-red-500" />
              <GapBar label="High" count={data?.highGaps || 0} total={gapTotal} color="bg-orange-500" />
              <GapBar label="Medium" count={data?.mediumGaps || 0} total={gapTotal} color="bg-yellow-500" />
              <GapBar label="Low" count={data?.lowGaps || 0} total={gapTotal} color="bg-blue-500" />
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4">Complete an assessment to see gap breakdown.</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          {kpis?.recentActivity && kpis.recentActivity.length > 0 ? (
            <div className="space-y-3">
              {kpis.recentActivity.slice(0, 6).map((a, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 truncate">
                      <span className="font-medium">{a.user.firstName} {a.user.lastName}</span>
                      {' '}{a.action.toLowerCase().replace(/_/g, ' ')}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {new Date(a.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 py-4">No recent activity.</p>
          )}
        </div>
      </div>

      {/* Compliance Trend */}
      {data?.trend && data.trend.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            Compliance Trend
          </h3>
          <div className="flex items-end gap-4 h-40">
            {data.trend.map((t, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-gray-900">{t.score}%</span>
                <div className="w-full bg-gray-100 rounded-t-md relative" style={{ height: '120px' }}>
                  <div
                    className={clsx('absolute bottom-0 w-full rounded-t-md transition-all',
                      t.score >= 80 ? 'bg-green-500' : t.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                    )}
                    style={{ height: `${t.score}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">v{t.version}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, subtext }: {
  icon: any; label: string; value: number; color: string; subtext: string;
}) {
  const colors: Record<string, string> = {
    red: 'bg-red-50 text-red-600', orange: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center mb-3', colors[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="text-xs text-gray-400 mt-1">{subtext}</p>
    </div>
  );
}

function QuickAction({ icon: Icon, title, description, href, color }: {
  icon: any; title: string; description: string; href: string; color: string;
}) {
  const colors: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-600 group-hover:bg-primary-100',
    warning: 'bg-orange-50 text-orange-600 group-hover:bg-orange-100',
    success: 'bg-green-50 text-green-600 group-hover:bg-green-100',
  };
  return (
    <Link to={href} className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all flex items-start gap-4">
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors', colors[color])}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          {title}
          <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
        </h3>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
    </Link>
  );
}

function GapBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-600 w-16">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5">
        <div className={clsx('h-2.5 rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-semibold text-gray-900 w-8 text-right">{count}</span>
    </div>
  );
}
