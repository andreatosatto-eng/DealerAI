
import React, { useState, useEffect } from 'react';
import { Upload, File, Check, Star, Loader2, Trash2, Pencil, X, Save, Shield, TrendingUp, Calendar, AlertTriangle, RefreshCcw, Info, Folder, Building2, Zap, Flame } from 'lucide-react';
import { Segment, CTE, IndexType, OfferType, User } from '../types';
import * as API from '../services/mockApi';
import { Container, Section } from './ui/Layouts';

interface Props {
  user: User;
}

const CteManagerTab: React.FC<Props> = ({ user }) => {
  const [ctes, setCtes] = useState<CTE[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Tab State Levels
  const [activeSupplierTab, setActiveSupplierTab] = useState<string>('');
  const [activeSegmentTab, setActiveSegmentTab] = useState<Segment>(Segment.CONSUMER_LUCE);

  // Edit Mode State
  const [editingCte, setEditingCte] = useState<CTE | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchCtes = async () => {
    setLoading(true);
    try {
      const { items } = await API.list_cte(user); // Pass user to filter by visibility
      items.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
      setCtes(items);
      
      // Set default supplier if none selected or if previously selected is no longer available
      if ((!activeSupplierTab || !items.some(i => i.supplier_name === activeSupplierTab)) && items.length > 0) {
        // Group by supplier and pick the one with most docs or just first
        const suppliers = Array.from(new Set(items.map(i => i.supplier_name))).sort();
        if (suppliers.length > 0) setActiveSupplierTab(suppliers[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCtes();
  }, [user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploading(true);
      try {
        const result = await API.upload_cte_pdf(e.target.files[0], user);
        await fetchCtes();
        // Switch to the tab of the newly uploaded/linked CTE
        setActiveSupplierTab(result.extracted_cte_json.supplier_name);
        setActiveSegmentTab(result.extracted_cte_json.segment);
        
        if (result.created_new) {
             alert(`Nuova CTE creata e assegnata alla tua agenzia!`);
        } else {
             alert(`CTE già esistente! È stata abilitata per la tua agenzia.`);
        }
      } catch (err) {
        alert("Errore upload CTE");
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questa CTE?")) {
      await API.delete_cte(id);
      await fetchCtes();
    }
  };

  const handleSetDefault = async (segment: Segment, id: string) => {
    setLoading(true);
    await API.set_default_cte(segment, id, user.agency_id);
    await fetchCtes();
  };

  const handleSaveEdit = async () => {
    if (!editingCte) return;
    setSaving(true);
    try {
      await API.update_cte(editingCte);
      setEditingCte(null);
      await fetchCtes();
      // Ensure we stay on the right tabs
      setActiveSupplierTab(editingCte.supplier_name);
      setActiveSegmentTab(editingCte.segment);
    } catch (e) {
      alert("Errore salvataggio modifiche");
    } finally {
      setSaving(false);
    }
  };

  const isExpired = (cte: CTE) => {
    return new Date(cte.valid_until) < new Date();
  };

  // --- Derived Data for Tabs ---
  const suppliers = Array.from(new Set(ctes.map(c => c.supplier_name))).sort();
  
  // Filter by Supplier first
  const supplierCtes = ctes.filter(c => c.supplier_name === activeSupplierTab);
  
  // Filter by Segment second (Final List)
  const filteredCtes = supplierCtes.filter(c => c.segment === activeSegmentTab);

  // Readable labels for tabs
  const segmentLabels: Record<Segment, string> = {
      [Segment.CONSUMER_LUCE]: 'Casa Luce',
      [Segment.CONSUMER_GAS]: 'Casa Gas',
      [Segment.BUSINESS_LUCE]: 'Biz Luce',
      [Segment.BUSINESS_GAS]: 'Biz Gas',
  };
  
  const segmentIcons: Record<Segment, React.ReactNode> = {
      [Segment.CONSUMER_LUCE]: <Zap className="w-4 h-4" />,
      [Segment.CONSUMER_GAS]: <Flame className="w-4 h-4" />,
      [Segment.BUSINESS_LUCE]: <Zap className="w-4 h-4" />,
      [Segment.BUSINESS_GAS]: <Flame className="w-4 h-4" />,
  };

  return (
    <Container>
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-brand-primary">Archivio Offerte</h2>
           <p className="text-sm text-gray-500">Agenzia: {user.agency_id === 'ag_mt' ? 'MT HQ' : user.agency_id}</p>
        </div>
        
        {/* Compact Upload Button */}
        <div className="relative overflow-hidden group bg-brand-accent hover:bg-teal-500 text-brand-dark px-4 py-2 rounded-lg font-bold shadow-md cursor-pointer flex items-center gap-2 transition-all">
            <Upload className="w-4 h-4" />
            <span className="text-sm">Carica PDF</span>
            <input 
                 type="file" 
                 accept="application/pdf"
                 onChange={handleUpload}
                 disabled={uploading}
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {uploading && <div className="absolute inset-0 bg-white/50 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin"/></div>}
        </div>
      </div>

      {suppliers.length === 0 && !loading ? (
         <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
             <Folder className="w-16 h-16 mx-auto mb-4 text-gray-300" />
             <h3 className="text-lg font-medium text-gray-500">L'archivio è vuoto</h3>
             <p className="text-gray-400">Carica una CTE per iniziare a popolare le cartelle della tua agenzia.</p>
         </div>
      ) : (
        /* ARCHIVE CONTAINER */
        <div className="rounded-2xl shadow-sm overflow-hidden bg-white min-h-[500px] flex flex-col">
            
            {/* LEVEL 1: SUPPLIER TABS */}
            <div className="bg-brand-primary p-2 pb-0 flex overflow-x-auto gap-1">
                {suppliers.map(supplier => {
                    const isActive = activeSupplierTab === supplier;
                    const count = ctes.filter(c => c.supplier_name === supplier).length;
                    return (
                        <button
                            key={supplier}
                            onClick={() => setActiveSupplierTab(supplier)}
                            className={`flex-shrink-0 min-w-[120px] py-3 px-4 rounded-t-xl text-sm font-bold transition-all relative ${
                                isActive 
                                ? 'bg-white text-brand-primary shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-20' 
                                : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                        >
                            <div className="flex items-center gap-2 justify-center">
                                <Building2 className={`w-4 h-4 ${isActive ? 'text-brand-accent' : ''}`} />
                                <span>{supplier}</span>
                            </div>
                            <span className={`text-[10px] font-normal block mt-1 ${isActive ? 'text-gray-400' : 'text-gray-500'}`}>
                                {count} documenti
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* LEVEL 2: SEGMENT TABS (Inside the Supplier Folder) */}
            <div className="bg-white border-b border-gray-200 px-4 pt-4 flex gap-2 overflow-x-auto">
                {Object.values(Segment).map(seg => {
                    const isActive = activeSegmentTab === seg;
                    const count = supplierCtes.filter(c => c.segment === seg).length;
                    return (
                        <button
                            key={seg}
                            onClick={() => setActiveSegmentTab(seg)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-bold border-t border-l border-r transition-all ${
                                isActive 
                                ? 'bg-gray-50 border-gray-200 border-b-transparent text-brand-primary translate-y-[1px] z-10' 
                                : 'bg-transparent border-transparent text-gray-400 hover:bg-gray-50'
                            }`}
                        >
                            {segmentIcons[seg]}
                            <span>{segmentLabels[seg]}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${isActive ? 'bg-brand-accent text-brand-dark' : 'bg-gray-100 text-gray-400'}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
                <div className="flex-1 border-b border-gray-200 transform translate-y-[1px]"></div>
            </div>

            {/* CONTENT BODY */}
            <div className="bg-gray-50 p-6 flex-1 border-l border-r border-b border-gray-200 rounded-b-2xl relative">
                {loading && !uploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-20">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary"/>
                </div>
                ) : (
                <div className="space-y-3 animate-in fade-in duration-300">
                    {filteredCtes.length === 0 && (
                        <div className="text-center py-12 text-gray-400">
                            <Folder className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>Nessuna offerta per {activeSupplierTab}</p>
                            <p className="text-sm font-medium text-gray-500">in {segmentLabels[activeSegmentTab]}</p>
                        </div>
                    )}
                    
                    {filteredCtes.map(cte => {
                    const expired = isExpired(cte);
                    return (
                        <div 
                        key={cte.id} 
                        className={`p-4 rounded-xl border flex flex-col gap-4 transition-all relative group
                            ${cte.is_default ? 'bg-white border-teal-200 ring-2 ring-teal-100 shadow-sm' : 'bg-white border-gray-200 hover:border-brand-accent hover:shadow-md'}
                            ${expired ? 'opacity-90 border-red-200 bg-red-50/50 ring-1 ring-red-100' : ''}
                        `}
                        >
                        <div className="flex justify-between items-start">
                            <div className="flex items-start gap-3">
                            <div className={`mt-1 p-2 rounded-full ${cte.is_default ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-400'}`}>
                                {cte.is_default ? <Star className="w-5 h-5 fill-current" /> : <File className="w-5 h-5" />}
                            </div>
                            <div>
                                <div className="flex gap-2 items-center mb-1 flex-wrap">
                                    {cte.offer_type === OfferType.FIXED 
                                    ? <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1"><Shield className="w-3 h-3"/> Fisso</span>
                                    : <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1"><TrendingUp className="w-3 h-3"/> Variabile</span>
                                    }
                                    {expired && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 border border-red-200"><AlertTriangle className="w-3 h-3"/> OBSOLETA</span>}
                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">{cte.offer_code}</span>
                                </div>
                                <h4 className="font-bold text-lg text-gray-900 leading-tight">{cte.offer_name}</h4>
                                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                    <Calendar className="w-3 h-3"/> Valida fino al: {new Date(cte.valid_until).toLocaleDateString()}
                                </p>
                            </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            {expired && (
                                <button 
                                onClick={() => setEditingCte(cte)}
                                className="px-3 py-1.5 bg-white border border-red-300 text-red-600 text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-red-50 shadow-sm mr-2"
                                >
                                <RefreshCcw className="w-3 h-3"/> Rinnova
                                </button>
                            )}
                            <button onClick={() => setEditingCte(cte)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Modifica"><Pencil className="w-4 h-4" /></button>
                            {!cte.is_default && <button onClick={() => handleDelete(cte.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Elimina"><Trash2 className="w-4 h-4" /></button>}
                            </div>
                        </div>

                        {/* Pricing Details Compact Grid */}
                        <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Quota Fissa</span>
                                <div className="font-mono font-medium text-gray-800">{cte.fixed_fee_value} {cte.fixed_fee_unit}</div>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">F0 / Mono</span>
                                <div className="font-mono font-bold text-gray-800">{cte.f0}</div>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">F1 / Peak</span>
                                <div className="font-mono font-bold text-gray-800">{cte.f1}</div>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">F23 / Off</span>
                                <div className="font-mono font-bold text-gray-800">{cte.f3}</div>
                            </div>
                        </div>
                        
                        {/* Footer Actions */}
                        <div className="flex justify-between items-center mt-1">
                            {!cte.is_default && !expired && (
                                <button onClick={() => handleSetDefault(cte.segment, cte.id)} className="text-xs text-brand-accent font-bold hover:underline">
                                    ★ Imposta come default
                                </button>
                            )}
                            {cte.is_default && <span className="text-xs text-teal-600 font-bold flex items-center gap-1"><Check className="w-3 h-3"/> Default per {segmentLabels[cte.segment]}</span>}
                            
                            {expired && (
                                <span className="text-[10px] text-red-500 font-medium">Auto-cancellazione in 20gg</span>
                            )}
                        </div>
                        </div>
                    );
                    })}
                </div>
                )}
            </div>
        </div>
      )}

      {/* Edit Modal Overlay */}
      {editingCte && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
             <div className="bg-brand-primary p-4 flex justify-between items-center text-white shrink-0">
               <h3 className="font-bold text-lg flex items-center gap-2">
                   <Pencil className="w-5 h-5" /> Modifica Offerta CTE
               </h3>
               <button onClick={() => setEditingCte(null)}><X className="w-5 h-5" /></button>
             </div>
            
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Offerta</label>
                      <input 
                          className="w-full p-2 border rounded font-bold text-gray-800"
                          value={editingCte.offer_name}
                          onChange={e => setEditingCte({...editingCte, offer_name: e.target.value})}
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Codice Offerta</label>
                      <input 
                          className="w-full p-2 border rounded font-mono text-sm"
                          value={editingCte.offer_code}
                          onChange={e => setEditingCte({...editingCte, offer_code: e.target.value})}
                      />
                  </div>
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Scadenza</label>
                      <input 
                          type="date" 
                          className="w-full p-2 border rounded"
                          value={editingCte.valid_until.split('T')[0]}
                          onChange={e => setEditingCte({...editingCte, valid_until: e.target.value})}
                      />
                  </div>
              </div>

              <div className="bg-gray-50 p-4 rounded border border-gray-200">
                  <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-brand-accent"/> Condizioni Economiche
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Quota Fissa (€/anno)</label>
                          <input 
                              type="number" step="0.01"
                              className="w-full p-2 border rounded font-mono"
                              value={editingCte.fixed_fee_value}
                              onChange={e => setEditingCte({...editingCte, fixed_fee_value: parseFloat(e.target.value)})}
                          />
                      </div>
                      <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Prezzo Monorario (F0)</label>
                          <input 
                              type="number" step="0.0001"
                              className="w-full p-2 border rounded font-mono"
                              value={editingCte.f0}
                              onChange={e => setEditingCte({...editingCte, f0: parseFloat(e.target.value)})}
                          />
                      </div>
                      <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Prezzo F1 (Peak)</label>
                          <input 
                              type="number" step="0.0001"
                              className="w-full p-2 border rounded font-mono"
                              value={editingCte.f1}
                              onChange={e => setEditingCte({...editingCte, f1: parseFloat(e.target.value)})}
                          />
                      </div>
                      <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Prezzo F23 (Off-Peak)</label>
                          <input 
                              type="number" step="0.0001"
                              className="w-full p-2 border rounded font-mono"
                              value={editingCte.f3} // Assuming f3 covers F2+F3 or similar logic
                              onChange={e => setEditingCte({...editingCte, f3: parseFloat(e.target.value)})}
                          />
                      </div>
                  </div>
              </div>

              <div className="bg-yellow-50 p-3 rounded border border-yellow-200 text-xs text-yellow-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/>
                  <p>Modificando questi valori, cambierai i calcoli per tutte le analisi future basate su questa offerta. Le analisi passate non verranno ricalcolate.</p>
              </div>

            </div>
            
            <div className="p-4 bg-gray-50 border-t flex justify-end gap-2 shrink-0">
                <button onClick={() => setEditingCte(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded">Annulla</button>
                <button onClick={handleSaveEdit} disabled={saving} className="px-4 py-2 bg-brand-primary text-white font-medium rounded hover:bg-brand-dark flex items-center gap-2 shadow-lg">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salva Modifiche
                </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
};

export default CteManagerTab;
