import { useEffect, useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Building2, Save, AlertCircle } from 'lucide-react';

const orgTypes = [
  { value: 'government_hospital', label: 'Government Hospital' },
  { value: 'private_hospital', label: 'Private Hospital' },
  { value: 'clinic_small', label: 'Clinic (Small)' },
  { value: 'clinic_large', label: 'Clinic (Large)' },
  { value: 'insurer', label: 'Health Insurer' },
  { value: 'pharma', label: 'Pharmaceutical Company' },
  { value: 'health_tech', label: 'Health Tech Provider' },
  { value: 'other', label: 'Other' },
];

const regions = [
  'Riyadh', 'Makkah', 'Madinah', 'Eastern Province', 'Asir', 'Tabuk',
  'Hail', 'Northern Borders', 'Jazan', 'Najran', 'Al Bahah', 'Al Jawf', 'Qassim',
];

const regulatoryBodies = [
  { value: 'moh', label: 'Ministry of Health (MoH)' },
  { value: 'saudi_health_council', label: 'Saudi Health Council' },
  { value: 'sama', label: 'SAMA' },
  { value: 'cohi', label: 'Council of Health Insurance (CoHI)' },
  { value: 'nca', label: 'National Cybersecurity Authority (NCA)' },
];

interface OrgProfile {
  name: string; orgType: string; bedCount: number | null; staffSize: number | null;
  regionsOfOperation: string[]; processesMinors: boolean; crossBorderTransfers: boolean;
  usesCloud: string; conductsResearch: boolean; usesAiOrAutomatedDecisions: boolean;
  continuousMonitoring: boolean; dpoAppointed: boolean; dpoName: string; dpoEmail: string;
  applicableRegulatoryBodies: string[]; onboardingCompleted: boolean;
}

export default function Organization() {
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/organizations/profile').then(r => {
      setProfile(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleChange = (field: string, value: any) => {
    if (!profile) return;
    setProfile({ ...profile, [field]: value });
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await api.put('/organizations/profile', profile);
      toast.success('Organization profile saved');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }

  if (!profile) {
    return <div className="text-center py-12 text-gray-500">Unable to load organization profile.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Building2 className="w-7 h-7 text-primary-600" />
            Organization Profile
          </h1>
          <p className="text-gray-500 mt-1">Configure your organization profile. This drives which controls apply to your assessment.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors">
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {!profile.dpoAppointed && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">DPO Not Appointed — CRITICAL Gap</p>
            <p className="text-sm text-red-700 mt-1">A Data Protection Officer is MANDATORY for all healthcare organizations under Reg. Art. 32(1)(c). Health data is always classified as sensitive personal data.</p>
          </div>
        </div>
      )}

      {/* Basic Info */}
      <Section title="Basic Information">
        <Field label="Organization Name">
          <input value={profile.name} onChange={e => handleChange('name', e.target.value)}
            className="input-field" />
        </Field>
        <Field label="Organization Type">
          <select value={profile.orgType} onChange={e => handleChange('orgType', e.target.value)} className="input-field bg-white">
            {orgTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Bed Count">
            <input type="number" value={profile.bedCount || ''} onChange={e => handleChange('bedCount', e.target.value ? parseInt(e.target.value) : null)}
              className="input-field" placeholder="For hospitals/clinics" />
          </Field>
          <Field label="Staff Size">
            <input type="number" value={profile.staffSize || ''} onChange={e => handleChange('staffSize', e.target.value ? parseInt(e.target.value) : null)}
              className="input-field" />
          </Field>
        </div>
        <Field label="Regions of Operation">
          <div className="flex flex-wrap gap-2">
            {regions.map(r => (
              <label key={r} className="flex items-center gap-1.5 text-sm bg-gray-50 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-gray-100">
                <input type="checkbox" checked={profile.regionsOfOperation.includes(r)}
                  onChange={e => {
                    const updated = e.target.checked
                      ? [...profile.regionsOfOperation, r]
                      : profile.regionsOfOperation.filter(x => x !== r);
                    handleChange('regionsOfOperation', updated);
                  }}
                  className="rounded" />
                {r}
              </label>
            ))}
          </div>
        </Field>
      </Section>

      {/* Branching Rule Flags */}
      <Section title="Compliance Profile (Branching Rules)">
        <p className="text-sm text-gray-500 mb-4">These flags determine which of the 119 controls apply to your organization.</p>
        <div className="space-y-4">
          <Toggle label="Processes data of minors (&lt;18) or incapacitated individuals?"
            sublabel="Activates guardian consent, DPIA Trigger 3, and related controls."
            value={profile.processesMinors} onChange={v => handleChange('processesMinors', v)} />
          <Toggle label="Transfers personal data outside KSA?"
            sublabel="Activates cross-border transfer controls (T.5–T.9), SDAIA SCCs, Transfer Risk Assessment."
            value={profile.crossBorderTransfers} onChange={v => handleChange('crossBorderTransfers', v)} />
          <Field label="Uses cloud services?">
            <select value={profile.usesCloud} onChange={e => handleChange('usesCloud', e.target.value)} className="input-field bg-white">
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="partial">Partially</option>
            </select>
          </Field>
          <Toggle label="Conducts health research or statistical analysis?"
            sublabel="Activates Domain 9 — Sectoral & Special Processing controls."
            value={profile.conductsResearch} onChange={v => handleChange('conductsResearch', v)} />
          <Toggle label="Uses AI/ML or automated decision-making on personal data?"
            sublabel="Activates DPIA Triggers 5+6, explicit consent for automated decisions."
            value={profile.usesAiOrAutomatedDecisions} onChange={v => handleChange('usesAiOrAutomatedDecisions', v)} />
          <Toggle label="Continuously monitors individuals (e.g., patient monitoring systems)?"
            sublabel="Activates DPIA Trigger 4, DPO Trigger B."
            value={profile.continuousMonitoring} onChange={v => handleChange('continuousMonitoring', v)} />
        </div>
      </Section>

      {/* DPO */}
      <Section title="Data Protection Officer (DPO)">
        <Toggle label="DPO formally appointed?"
          sublabel="MANDATORY for all healthcare organizations — Reg. Art. 32(1)(c). Health data = sensitive data = mandatory DPO."
          value={profile.dpoAppointed} onChange={v => handleChange('dpoAppointed', v)} />
        {profile.dpoAppointed && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Field label="DPO Name">
              <input value={profile.dpoName || ''} onChange={e => handleChange('dpoName', e.target.value)} className="input-field" />
            </Field>
            <Field label="DPO Email">
              <input type="email" value={profile.dpoEmail || ''} onChange={e => handleChange('dpoEmail', e.target.value)} className="input-field" />
            </Field>
          </div>
        )}
      </Section>

      {/* Regulatory Bodies */}
      <Section title="Applicable Regulatory Bodies">
        <div className="space-y-2">
          {regulatoryBodies.map(rb => (
            <label key={rb.value} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={profile.applicableRegulatoryBodies.includes(rb.value)}
                onChange={e => {
                  const updated = e.target.checked
                    ? [...profile.applicableRegulatoryBodies, rb.value]
                    : profile.applicableRegulatoryBodies.filter(x => x !== rb.value);
                  handleChange('applicableRegulatoryBodies', updated);
                }}
                className="rounded" />
              <span className="text-sm font-medium text-gray-700">{rb.label}</span>
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ label, sublabel, value, onChange }: { label: string; sublabel?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50">
      <button onClick={() => onChange(!value)}
        className={`relative mt-0.5 w-11 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-primary-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
      <div>
        <p className="text-sm font-medium text-gray-900" dangerouslySetInnerHTML={{ __html: label }} />
        {sublabel && <p className="text-xs text-gray-500 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}
