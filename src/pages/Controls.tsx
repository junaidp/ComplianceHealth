import { useEffect, useState } from 'react';
import api from '../lib/api';
import { Shield, Search, Filter } from 'lucide-react';
import clsx from 'clsx';

interface Control {
  id: string; ref: string; source: string; domainNumber: number; domainName: string;
  objectiveEn: string; riskLevel: string; regArticles: string | null; pdplArticles: string | null;
  transferRegArticles: string | null; ncaRef: string | null; mohPolicyRef: string | null;
  evidenceGuidanceEn: string | null; pointsYes: number; pointsPartial: number;
}

const riskColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800', HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800', LOW: 'bg-blue-100 text-blue-800',
};
const sourceColors: Record<string, string> = {
  PDPL: 'bg-indigo-100 text-indigo-800', NCA_ECC: 'bg-teal-100 text-teal-800', MOH: 'bg-pink-100 text-pink-800',
};

export default function Controls() {
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterRisk, setFilterRisk] = useState('');
  const [filterDomain, setFilterDomain] = useState('');

  useEffect(() => {
    api.get('/controls').then(r => { setControls(r.data.data || r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = controls.filter(c => {
    if (filterSource && c.source !== filterSource) return false;
    if (filterRisk && c.riskLevel !== filterRisk) return false;
    if (filterDomain && c.domainNumber !== parseInt(filterDomain)) return false;
    if (search) {
      const s = search.toLowerCase();
      return c.id.toLowerCase().includes(s) || c.objectiveEn.toLowerCase().includes(s) || c.ref.toLowerCase().includes(s);
    }
    return true;
  });

  const domains = [...new Map(controls.map(c => [c.domainNumber, c.domainName])).entries()].sort((a, b) => a[0] - b[0]);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Shield className="w-7 h-7 text-primary-600" /> Control Library
        </h1>
        <p className="text-gray-500 mt-1">{controls.length} controls across PDPL, NCA ECC, and MoH frameworks.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search controls..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
        </div>
        <Filter className="w-4 h-4 text-gray-400" />
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Sources</option>
          <option value="PDPL">PDPL</option><option value="NCA_ECC">NCA ECC</option><option value="MOH">MoH</option>
        </select>
        <select value={filterRisk} onChange={e => setFilterRisk(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Risk Levels</option>
          <option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
        </select>
        <select value={filterDomain} onChange={e => setFilterDomain(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">All Domains</option>
          {domains.map(([num, name]) => <option key={num} value={num}>D{num}. {name}</option>)}
        </select>
      </div>

      <p className="text-sm text-gray-500">{filtered.length} controls shown</p>

      <div className="space-y-2">
        {filtered.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-1 shrink-0 items-center w-20">
                <span className={clsx('px-2 py-0.5 rounded text-xs font-semibold', riskColors[c.riskLevel])}>{c.riskLevel}</span>
                <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', sourceColors[c.source])}>{c.source}</span>
                <span className="text-xs text-gray-400">D{c.domainNumber}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-gray-900 text-sm">{c.id} — {c.ref}</h4>
                <p className="text-sm text-gray-700 mt-1">{c.objectiveEn}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {c.regArticles && <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{c.regArticles}</span>}
                  {c.pdplArticles && <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">{c.pdplArticles}</span>}
                  {c.ncaRef && <span className="text-xs bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded">NCA {c.ncaRef}</span>}
                  {c.mohPolicyRef && <span className="text-xs bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded">{c.mohPolicyRef}</span>}
                  {c.transferRegArticles && <span className="text-xs bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded">{c.transferRegArticles}</span>}
                </div>
                {c.evidenceGuidanceEn && <p className="text-xs text-gray-400 mt-2">Evidence: {c.evidenceGuidanceEn}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">Points</p>
                <p className="text-sm font-semibold text-gray-900">{c.pointsYes} / {c.pointsPartial}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
