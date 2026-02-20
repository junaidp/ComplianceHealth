import { useEffect, useState, useRef } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Upload, FileText, Download, Search, Clock, User, Hash } from 'lucide-react';

interface EvidenceFile {
  id: string; controlId: string; filename: string; fileSizeBytes: number;
  sha256Hash: string; description: string; uploadedBy: string; uploadedAt: string;
  uploadedByUser?: { firstName: string; lastName: string };
}

interface Control {
  id: string;
  objectiveEn: string;
}

export default function Evidence() {
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ controlId: '', description: '' });
  const [controlSearch, setControlSearch] = useState('');
  const [showControlDropdown, setShowControlDropdown] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      api.get('/evidence'),
      api.get('/controls'),
    ]).then(([evRes, ctrlRes]) => {
      setFiles(evRes.data.data || []);
      setControls(ctrlRes.data.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filteredControls = controls.filter(c => {
    const s = controlSearch.toLowerCase();
    return !s || c.id.toLowerCase().includes(s) || c.objectiveEn.toLowerCase().includes(s);
  }).slice(0, 15);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !uploadForm.controlId || !uploadForm.description) {
      toast.error('Please fill all fields and select a file');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('controlId', uploadForm.controlId);
      formData.append('description', uploadForm.description);
      await api.post('/evidence/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Evidence uploaded');
      setShowUpload(false);
      setUploadForm({ controlId: '', description: '' });
      if (fileRef.current) fileRef.current.value = '';
      const r = await api.get('/evidence');
      setFiles(r.data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = async (evidenceId: string) => {
    try {
      const { data } = await api.get(`/evidence/${evidenceId}`);
      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      } else {
        window.open(`/api/v1/evidence/${evidenceId}/download`, '_blank');
      }
    } catch {
      toast.error('Download failed');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const filtered = files.filter(f => {
    if (!search) return true;
    const s = search.toLowerCase();
    return f.filename.toLowerCase().includes(s) || f.controlId.toLowerCase().includes(s) || f.description.toLowerCase().includes(s);
  });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Upload className="w-7 h-7 text-primary-600" /> Evidence Vault
          </h1>
          <p className="text-gray-500 mt-1">{files.length} evidence files uploaded. SHA-256 hashed for audit integrity.</p>
        </div>
        <button onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
          <Upload className="w-4 h-4" /> Upload Evidence
        </button>
      </div>

      {showUpload && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Upload Evidence File</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Control ID</label>
              <input value={uploadForm.controlId || controlSearch}
                onChange={e => { setControlSearch(e.target.value); setUploadForm({ ...uploadForm, controlId: '' }); setShowControlDropdown(true); }}
                onFocus={() => setShowControlDropdown(true)}
                placeholder="Search controls... e.g., PDPL-G.1"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
              {showControlDropdown && !uploadForm.controlId && (
                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                  {filteredControls.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500">No controls found</div>
                  ) : filteredControls.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => { setUploadForm({ ...uploadForm, controlId: c.id }); setControlSearch(''); setShowControlDropdown(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 flex items-center gap-2">
                      <span className="font-mono font-medium text-primary-700 shrink-0">{c.id}</span>
                      <span className="text-gray-500 truncate">{c.objectiveEn.substring(0, 60)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (max 100 chars)</label>
              <input value={uploadForm.description} onChange={e => setUploadForm({ ...uploadForm, description: e.target.value })}
                maxLength={100} placeholder="What does this file demonstrate?"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">File (PDF, DOCX, XLSX, PNG, JPG, etc.)</label>
              <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.eml,.txt,.csv,.log"
                className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 file:font-medium file:cursor-pointer" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={handleUpload} disabled={uploading}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search evidence files..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900">No Evidence Files</h3>
          <p className="text-gray-500 mt-2">Upload evidence to support your compliance assessment responses.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(f => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 text-sm truncate">{f.filename}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{f.description}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{f.controlId}</span>
                  <span>{formatBytes(Number(f.fileSizeBytes))}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(f.uploadedAt).toLocaleDateString()}</span>
                  {f.uploadedByUser && <span className="flex items-center gap-1"><User className="w-3 h-3" />{f.uploadedByUser.firstName} {f.uploadedByUser.lastName}</span>}
                </div>
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-300 font-mono">
                  <Hash className="w-3 h-3" /> SHA-256: {f.sha256Hash.substring(0, 16)}...
                </div>
              </div>
              <button onClick={() => downloadFile(f.id)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary-600 transition-colors shrink-0">
                <Download className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
