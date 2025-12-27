
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { 
  Copy, Plus, Trash2, User, AlertCircle, RefreshCw, Wand2, Sparkles, Loader2, 
  X, FileText, Globe, Zap, Languages, CloudUpload, ClipboardPaste, 
  Download, Upload, Users, Layers, Search, Briefcase, Phone, Network, 
  BrainCircuit, FileSignature, LayoutPanelLeft
} from 'lucide-react';
import * as gemini from './geminiService';
import { 
  RAW_PIC_DATA, 
  RAW_SEGMENT_DATA, 
  CUSTOMER_OPTIONS, 
  SERVICE_OPTIONS 
} from './constants';
import { 
  TabInfo, ReportData, ImpactStatus, PicEntry, SegmentEntry, UpdateEntry 
} from './types';

const createEmptyReport = (): ReportData => ({
  siteA: '',
  siteB: '',
  ttNumber: '',
  impactList: [],
  occurTime: '',
  dispatchTime: '',
  pic: '',
  segmentPM: '',
  rootcause: '',
  cutPoint: '',
  updates: [{ time: '', text: '', textEn: '' }],
  impactCustomers: []
});

const App: React.FC = () => {
  const [tabs, setTabs] = useState<TabInfo[]>([
    { id: Date.now(), title: 'Laporan 1', isUjb: false, data: createEmptyReport() }
  ]);
  const [activeTabId, setActiveTabId] = useState<number>(tabs[0].id);
  const [aiInput, setAiInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [previewLang, setPreviewLang] = useState<'ID' | 'EN'>('ID');

  const [showPicSelector, setShowPicSelector] = useState(false);
  const [picData, setPicData] = useState<PicEntry[]>([]);
  const [showSegmentSelector, setShowSegmentSelector] = useState(false);
  const [segmentData, setSegmentData] = useState<SegmentEntry[]>([]);

  const [isSuggestingRCA, setIsSuggestingRCA] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  const audioCtx = useRef<AudioContext | null>(null);

  // Initialize data
  useEffect(() => {
    const parsedPics = RAW_PIC_DATA.split('\n').map(line => {
      const parts = line.split('\t').map(s => s.trim());
      return parts.length >= 2 ? { region: parts[0], role: parts[1], name: parts[2] || '', phone: parts[3] || '' } : null;
    }).filter((x): x is PicEntry => x !== null);
    setPicData(parsedPics);

    const parsedSegments = RAW_SEGMENT_DATA.split('\n').map(line => {
      const parts = line.split('\t').map(s => s.trim());
      return parts.length >= 3 ? { segmentId: parts[0], region: parts[1], pic: parts[2] } : null;
    }).filter((x): x is SegmentEntry => x !== null);
    setSegmentData(parsedSegments);
  }, []);

  const playSound = (type: 'click' | 'success' | 'pop' | 'delete' = 'click') => {
    if (!audioCtx.current) audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    switch(type) {
      case 'click':
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(); osc.stop(now + 0.1);
        break;
      case 'success':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(); osc.stop(now + 0.2);
        break;
      case 'pop':
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(); osc.stop(now + 0.05);
        break;
      case 'delete':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.2);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(); osc.stop(now + 0.2);
        break;
    }
  };

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);
  const report = activeTab.data;

  const updateActiveTabData = useCallback((newData: Partial<ReportData>) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, data: { ...t.data, ...newData } } : t));
  }, [activeTabId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    updateActiveTabData({ [name]: value });
  };

  const setTimeNow = (field: 'occurTime' | 'dispatchTime') => {
    const now = new Date();
    const ts = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    updateActiveTabData({ [field]: ts });
    playSound('click');
  };

  const addUpdateRow = () => {
    playSound('pop');
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    updateActiveTabData({ updates: [...report.updates, { time: hhmm, text: '', textEn: '' }] });
  };

  const processAiExtraction = async () => {
    if (!aiInput.trim()) return;
    setIsProcessing(true);
    try {
      const result = await gemini.extractReportData(aiInput);
      updateActiveTabData(result);
      setAiInput('');
      playSound('success');
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const runSuggestRCA = async () => {
    setIsSuggestingRCA(true);
    try {
      const context = JSON.stringify({ updates: report.updates, impacts: report.impactList });
      const result = await gemini.suggestRootCause(context);
      if (result.rootcause) updateActiveTabData({ rootcause: result.rootcause });
      playSound('success');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSuggestingRCA(false);
    }
  };

  const generateFullOutput = useCallback((lang: 'ID' | 'EN') => {
    const statusIcons = { 'UP': '✅', 'DOWN': '❌', 'ON CHECK': '⌛' };
    const updatesStr = report.updates.map(u => `${u.time} ${lang === 'EN' && u.textEn ? u.textEn : u.text}`).filter(s => s.trim()).join('\n');
    const impactsStr = report.impactList.length > 0 ? `\nImpact List:\n` + report.impactList.map(i => `- ${i.name} (${statusIcons[i.status as keyof typeof statusIcons]})`).join('\n') : "";
    
    return `*[MANDAU] ${report.siteA || '___'} <> ${report.siteB || '___'} [TT :${report.ttNumber || '___'}]*
Occur Time = ${report.occurTime || '-'}
Dispatch Time = ${report.dispatchTime || '-'}${impactsStr}
PIC = ${report.pic || '-'}
Segment PM = ${report.segmentPM || '-'}
Root Cause = ${report.rootcause || '-'}
Cut Point = ${report.cutPoint || '-'}

Status Updates:
${updatesStr || '(No updates yet)'}`;
  }, [report]);

  const copyToClipboard = () => {
    const text = generateFullOutput(previewLang);
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    playSound('success');
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="flex h-screen bg-[#F3F3F3] overflow-hidden select-none">
      {/* Sidebar Nav */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-200">
            <Zap size={20} />
          </div>
          <h1 className="font-black text-xl tracking-tight text-slate-800">SmartReport</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-1 py-2 no-scrollbar">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Laporan Aktif</div>
          {tabs.map(tab => (
            <div 
              key={tab.id}
              onClick={() => { setActiveTabId(tab.id); playSound('click'); }}
              className={`group flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all ${activeTabId === tab.id ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <FileText size={16} className={activeTabId === tab.id ? 'text-blue-600' : 'text-slate-400'} />
              <span className="text-sm font-bold truncate flex-1">{tab.data.ttNumber || tab.title}</span>
              {tabs.length > 1 && (
                <button onClick={(e) => { e.stopPropagation(); setTabs(prev => prev.filter(t => t.id !== tab.id)); playSound('delete'); }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button onClick={() => { 
            const newTab = { id: Date.now(), title: `Laporan ${tabs.length + 1}`, isUjb: false, data: createEmptyReport() };
            setTabs([...tabs, newTab]);
            setActiveTabId(newTab.id);
            playSound('pop');
          }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all">
            <Plus size={16} />
            <span className="text-sm font-bold">Laporan Baru</span>
          </button>
        </div>

        <div className="p-4 border-t border-slate-100 space-y-2">
          <button className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 hover:bg-black transition-all shadow-lg shadow-slate-200">
            <CloudUpload size={14} /> SYNC CLOUD
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#F8F9FA]">
        {/* Header Bar */}
        <header className="h-16 bg-white/80 winui-blur border-b border-slate-200 flex items-center justify-between px-8 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-tighter ${activeTab.isUjb ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
              {activeTab.isUjb ? 'MODE UJB' : 'MODE REGULAR'}
            </div>
            <h2 className="font-bold text-slate-700 truncate max-w-xs">{activeTab.data.siteA || 'New Incident'}</h2>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setTabs(prev => prev.map(t => t.id === activeTabId ? {...t, isUjb: !t.isUjb} : t))} className={`p-2 transition-colors ${activeTab.isUjb ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`} title="Toggle UJB Mode"><Globe size={20} /></button>
             <button onClick={() => playSound('click')} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><RefreshCw size={20} /></button>
             <div className="w-px h-6 bg-slate-200 mx-1"></div>
             <button className="p-2 text-slate-400 hover:text-red-500 transition-colors" onClick={() => { updateActiveTabData(createEmptyReport()); playSound('delete'); }}><Trash2 size={20} /></button>
          </div>
        </header>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 no-scrollbar">
          
          {/* AI Magic Extraction */}
          <section className="bg-white rounded-3xl border border-slate-200 p-1 shadow-sm">
            <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-50">
               <Sparkles size={16} className="text-indigo-500 animate-pulse" />
               <span className="text-xs font-black text-slate-400 uppercase tracking-widest">AI Auto-Extract</span>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <textarea 
                value={aiInput} 
                onChange={e => setAiInput(e.target.value)}
                placeholder="Paste raw email or chat log here..." 
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-medium outline-none focus:bg-white focus:border-indigo-200 transition-all min-h-[100px] resize-none"
              />
              <div className="flex justify-end">
                <button 
                  onClick={processAiExtraction}
                  disabled={isProcessing || !aiInput.trim()}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 flex items-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  PROCESS WITH GEMINI
                </button>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-12">
            {/* Form Side */}
            <div className="space-y-8">
              {/* Site Info Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6">
                <div className="flex items-center gap-3 mb-2">
                   <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg"><AlertCircle size={18} /></div>
                   <h3 className="font-black text-slate-800">Incident Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Site A</label>
                     <input name="siteA" value={report.siteA} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-300" placeholder="Source Site" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Site B</label>
                     <input name="siteB" value={report.siteB} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:bg-white focus:border-blue-300" placeholder="Dest Site" />
                   </div>
                   <div className="col-span-full space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase ml-1">TT Number</label>
                     <input name="ttNumber" value={report.ttNumber} onChange={handleInputChange} className="w-full bg-slate-900 text-white border-none rounded-xl px-4 py-3 text-sm font-mono tracking-wider outline-none" placeholder="INC-000000" />
                   </div>
                   <div className="space-y-2">
                     <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Occur Time</label>
                        <button onClick={() => setTimeNow('occurTime')} className="text-[9px] font-black text-blue-600 hover:underline">NOW</button>
                     </div>
                     <input name="occurTime" value={report.occurTime} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none" placeholder="DD/MM/YYYY HH:mm" />
                   </div>
                   <div className="space-y-2">
                     <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Dispatch Time</label>
                        <button onClick={() => setTimeNow('dispatchTime')} className="text-[9px] font-black text-blue-600 hover:underline">NOW</button>
                     </div>
                     <input name="dispatchTime" value={report.dispatchTime} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none" placeholder="DD/MM/YYYY HH:mm" />
                   </div>
                </div>
              </div>

              {/* Maintenance Info */}
              <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6">
                 <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                       <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg"><BrainCircuit size={18} /></div>
                       <h3 className="font-black text-slate-800">Field & Maintenance</h3>
                    </div>
                    <button 
                      onClick={runSuggestRCA}
                      disabled={isSuggestingRCA}
                      className="text-[10px] font-black text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-all flex items-center gap-2"
                    >
                      {isSuggestingRCA ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} SUGGEST RCA
                    </button>
                 </div>
                 <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase ml-1">PIC & Contact</label>
                       <div className="relative">
                          <input name="pic" value={report.pic} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none pr-10" placeholder="Name (Phone) - Region" />
                          <button onClick={() => setShowPicSelector(true)} className="absolute right-3 top-3 text-slate-300 hover:text-blue-500"><Search size={18} /></button>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Segment PM</label>
                        <div className="relative">
                           <input name="segmentPM" value={report.segmentPM} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none pr-10" placeholder="ID Segment" />
                           <button onClick={() => setShowSegmentSelector(true)} className="absolute right-3 top-3 text-slate-300 hover:text-emerald-500"><Network size={18} /></button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Cut Point</label>
                        <input name="cutPoint" value={report.cutPoint} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none" placeholder="Location Details" />
                      </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Root Cause</label>
                       <textarea name="rootcause" value={report.rootcause} onChange={handleInputChange} className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-bold outline-none resize-none" placeholder="Incident root cause analysis..." rows={2} />
                    </div>
                 </div>
              </div>

              {/* Log Updates */}
              <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                   <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-green-50 text-green-600 rounded-lg"><RefreshCw size={18} /></div>
                      <h3 className="font-black text-slate-800">Log Updates</h3>
                   </div>
                   <button onClick={addUpdateRow} className="p-2 bg-slate-100 text-slate-400 hover:text-blue-600 rounded-lg transition-all"><Plus size={18} /></button>
                </div>
                <div className="space-y-6">
                   {report.updates.map((update, idx) => (
                     <div key={idx} className="flex gap-4 group">
                        <input 
                          value={update.time} 
                          onChange={e => {
                            const newUpdates = [...report.updates];
                            newUpdates[idx].time = e.target.value;
                            updateActiveTabData({ updates: newUpdates });
                          }}
                          className="w-16 h-10 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black text-center outline-none focus:bg-white focus:border-blue-300 shrink-0" 
                          placeholder="HH:mm" 
                        />
                        <div className="flex-1">
                           <textarea 
                             value={update.text}
                             onChange={e => {
                               const newUpdates = [...report.updates];
                               newUpdates[idx].text = e.target.value;
                               updateActiveTabData({ updates: newUpdates });
                             }}
                             className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:bg-white focus:border-blue-300 resize-none" 
                             placeholder="Activity summary..." 
                             rows={1}
                           />
                        </div>
                        <button 
                          onClick={() => {
                            updateActiveTabData({ updates: report.updates.filter((_, i) => i !== idx) });
                            playSound('delete');
                          }}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 self-start transition-all shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                     </div>
                   ))}
                </div>
              </div>
            </div>

            {/* Preview Side */}
            <div className="space-y-8 h-fit xl:sticky xl:top-8">
               <div className="bg-slate-900 rounded-[2.5rem] p-4 shadow-2xl border-[10px] border-slate-800 flex flex-col min-h-[600px]">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50 shrink-0">
                     <div>
                        <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Real-time Preview</div>
                        <div className="text-white font-black text-sm">{previewLang === 'ID' ? 'Indonesian Mode' : 'English Mode'}</div>
                     </div>
                     <div className="flex gap-2">
                        <button onClick={() => setPreviewLang(prev => prev === 'ID' ? 'EN' : 'ID')} className="p-2.5 bg-slate-800 text-slate-400 rounded-xl hover:text-white transition-all"><Languages size={18} /></button>
                        <button onClick={copyToClipboard} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${copySuccess ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                           {copySuccess ? 'COPIED!' : 'COPY REPORT'}
                        </button>
                     </div>
                  </div>
                  <div className="flex-1 p-8 overflow-y-auto no-scrollbar select-text">
                     <pre className="text-blue-50/80 font-mono text-sm leading-relaxed whitespace-pre-wrap selection:bg-blue-500/30">
                        {generateFullOutput(previewLang)}
                     </pre>
                  </div>
                  <div className="p-4 bg-slate-800/20 rounded-b-[2rem] flex justify-center gap-1 shrink-0">
                     <button onClick={async () => {
                       setIsGeneratingSummary(true);
                       try {
                         const result = await gemini.generateSummary(JSON.stringify(report));
                         setSummaryText(result.summary);
                         setShowSummaryModal(true);
                       } finally {
                         setIsGeneratingSummary(false);
                       }
                     }} className="w-full py-4 bg-indigo-600/10 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                        {isGeneratingSummary ? <Loader2 size={12} className="animate-spin" /> : <FileSignature size={12} />}
                        Generate Executive Summary
                     </button>
                  </div>
               </div>

               {/* Mode Selection Quick Actions */}
               <div className="grid grid-cols-2 gap-4 pb-4">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col gap-4 shadow-sm hover:border-blue-200 transition-all cursor-pointer">
                     <div className="p-2 bg-blue-50 text-blue-600 rounded-xl w-fit"><Download size={20} /></div>
                     <div>
                        <h4 className="font-black text-sm text-slate-800">Export JSON</h4>
                        <p className="text-[10px] font-bold text-slate-400">Save project state locally</p>
                     </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col gap-4 shadow-sm hover:border-indigo-200 transition-all cursor-pointer">
                     <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl w-fit"><Upload size={20} /></div>
                     <div>
                        <h4 className="font-black text-sm text-slate-800">Import JSON</h4>
                        <p className="text-[10px] font-bold text-slate-400">Recall previous session</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </main>

      {/* Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-8 backdrop-blur-md animate-in fade-in zoom-in duration-200">
           <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh] border border-white/20 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-600 rounded-2xl text-white"><FileSignature size={24} /></div>
                    <div>
                       <h3 className="text-xl font-black text-slate-800">Executive Summary</h3>
                       <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">AI Generated Response</p>
                    </div>
                 </div>
                 <button onClick={() => setShowSummaryModal(false)} className="p-2 text-slate-400 hover:text-slate-800 transition-colors"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 bg-slate-50/50 select-text">
                 <pre className="whitespace-pre-wrap font-sans text-sm text-slate-600 leading-relaxed font-semibold">
                    {summaryText}
                 </pre>
              </div>
              <div className="p-8 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                 <button onClick={() => setShowSummaryModal(false)} className="px-6 py-3 rounded-2xl text-xs font-black text-slate-400 hover:bg-slate-50 transition-colors">DISMISS</button>
                 <button 
                  onClick={() => { navigator.clipboard.writeText(summaryText); playSound('success'); }}
                  className="px-8 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black hover:bg-indigo-700 shadow-xl shadow-indigo-100 flex items-center gap-2 transition-all"
                 >
                    <Copy size={14} /> COPY SUMMARY
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* PIC Selector Modal */}
      {showPicSelector && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-8 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[70vh] border border-slate-200 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0">
                 <h3 className="text-lg font-black text-slate-800">Select PIC Database</h3>
                 <button onClick={() => setShowPicSelector(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
              </div>
              <div className="p-8 overflow-y-auto space-y-4 no-scrollbar">
                 {picData.map((pic, i) => (
                   <button 
                    key={i} 
                    onClick={() => { updateActiveTabData({ pic: `${pic.name} (${pic.phone}) - ${pic.region}` }); setShowPicSelector(false); playSound('success'); }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                   >
                     <div className="p-2 bg-slate-100 rounded-xl text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all"><User size={20} /></div>
                     <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 truncate">{pic.name}</div>
                        <div className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-tight">{pic.region} • {pic.role}</div>
                     </div>
                     <div className="text-xs font-mono text-blue-600 font-bold shrink-0">{pic.phone}</div>
                   </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* Segment Selector Modal */}
      {showSegmentSelector && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-8 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[70vh] border border-slate-200 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex justify-between items-center shrink-0">
                 <h3 className="text-lg font-black text-slate-800">Select Segment PM</h3>
                 <button onClick={() => setShowSegmentSelector(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
              </div>
              <div className="p-8 overflow-y-auto space-y-4 no-scrollbar">
                 {segmentData.map((seg, i) => (
                   <button 
                    key={i} 
                    onClick={() => { updateActiveTabData({ segmentPM: seg.segmentId }); setShowSegmentSelector(false); playSound('success'); }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
                   >
                     <div className="p-2 bg-slate-100 rounded-xl text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition-all"><Network size={20} /></div>
                     <div className="flex-1 min-w-0">
                        <div className="font-mono font-bold text-slate-800 truncate text-xs">{seg.segmentId}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase truncate">{seg.region}</div>
                     </div>
                     <div className="text-xs font-bold text-emerald-600 shrink-0">{seg.pic}</div>
                   </button>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
