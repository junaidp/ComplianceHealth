import { useState } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Bot, Send, FileText, Sparkles } from 'lucide-react';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'analyze' | 'policy'>('chat');
  const [analyzeForm, setAnalyzeForm] = useState({ documentText: '', controlId: '' });
  const [policyForm, setPolicyForm] = useState({ controlId: '' });
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [policyResult, setPolicyResult] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post('/ai/training-chat', { question: input.trim() });
      const assistantMsg: Message = { role: 'assistant', content: data.answer, timestamp: new Date() };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to get response');
      const errorMsg: Message = { role: 'assistant', content: 'Sorry, I was unable to process your question. Please try again.', timestamp: new Date() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const analyzeDocument = async () => {
    if (!analyzeForm.documentText || !analyzeForm.controlId) {
      toast.error('Please provide document text and control ID');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/ai/analyze-document', analyzeForm);
      setAnalysisResult(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const generatePolicy = async () => {
    if (!policyForm.controlId) {
      toast.error('Please provide a control ID');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/ai/policy-template', policyForm);
      setPolicyResult(data.template);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Policy generation failed');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'chat' as const, label: 'Q&A Chatbot', icon: Bot },
    { id: 'analyze' as const, label: 'Document Analyzer', icon: FileText },
    { id: 'policy' as const, label: 'Policy Generator', icon: Sparkles },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <Bot className="w-7 h-7 text-primary-600" /> AI Compliance Assistant
        </h1>
        <p className="text-gray-500 mt-1">
          AI-powered tools for PDPL compliance guidance, document analysis, and policy template generation.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={clsx('flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1 justify-center',
              activeTab === tab.id ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700')}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chat Tab */}
      {activeTab === 'chat' && (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ height: '500px' }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="font-semibold text-gray-900">PDPL Compliance Q&A</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                  Ask questions about PDPL, Implementing Regulations, NCA ECC, or MoH Data Governance Policy.
                  I'll provide answers with specific Regulation article citations.
                </p>
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  {['What triggers a mandatory DPIA?', 'How long to respond to a DSR?', 'What are the 9 DPA clauses?',
                    'When is DPO mandatory?'].map(q => (
                    <button key={q} onClick={() => { setInput(q); }}
                      className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium hover:bg-primary-100 transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={clsx('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={clsx('max-w-[80%] rounded-xl px-4 py-3 text-sm',
                  msg.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800')}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  <p className={clsx('text-xs mt-1', msg.role === 'user' ? 'text-primary-200' : 'text-gray-400')}>
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {loading && activeTab === 'chat' && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl px-4 py-3">
                  <div className="flex gap-1"><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" /><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} /><span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} /></div>
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 p-4">
            <div className="flex gap-3">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask a PDPL compliance question..."
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
              <button onClick={sendMessage} disabled={loading || !input.trim()}
                className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors">
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">AI-Suggested — Review by DPO Required. This is not legal advice.</p>
          </div>
        </div>
      )}

      {/* Document Analyzer Tab */}
      {activeTab === 'analyze' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Document Analyzer</h3>
          <p className="text-sm text-gray-500">Paste document text and specify the control ID to check if the document satisfies the control requirement.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Control ID</label>
            <input value={analyzeForm.controlId} onChange={e => setAnalyzeForm({ ...analyzeForm, controlId: e.target.value })}
              placeholder="e.g., PDPL-G.1" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Text</label>
            <textarea value={analyzeForm.documentText} onChange={e => setAnalyzeForm({ ...analyzeForm, documentText: e.target.value })}
              rows={8} placeholder="Paste the document content here..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <button onClick={analyzeDocument} disabled={loading}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
            {loading ? 'Analyzing...' : 'Analyze Document'}
          </button>
          {analysisResult && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <h4 className="font-medium text-gray-900 mb-2">Analysis Result</h4>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{analysisResult}</div>
              <p className="text-xs text-gray-400 mt-3">AI-Suggested — Review by DPO Required. This is not legal advice.</p>
            </div>
          )}
        </div>
      )}

      {/* Policy Generator Tab */}
      {activeTab === 'policy' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Policy Template Generator</h3>
          <p className="text-sm text-gray-500">Generate a draft policy or procedure template for a specific control, customized for your organization profile.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Control ID</label>
            <input value={policyForm.controlId} onChange={e => setPolicyForm({ controlId: e.target.value })}
              placeholder="e.g., PDPL-G.7 (Privacy Notice), PDPL-T.1 (DPA), PDPL-T.9 (TRA)"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <button onClick={generatePolicy} disabled={loading}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
            {loading ? 'Generating...' : 'Generate Template'}
          </button>
          {policyResult && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
              <h4 className="font-medium text-gray-900 mb-2">Generated Policy Template</h4>
              <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-96 overflow-y-auto">{policyResult}</div>
              <p className="text-xs text-gray-400 mt-3">AI-Suggested — Review by DPO Required. This is not legal advice.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
