
import React, { useState, useEffect } from 'react';
import { User, CanvasOffer, TelephonyOperator, CanvasOfferType } from '../types';
import * as API from '../services/mockApi';
import { Container } from './ui/Layouts';
import { Plus, Trash2, Smartphone, Router, Signal, Save, X, Ban, Radio, Building2, UploadCloud, Loader2, Link, Layers, Tablet, Pencil } from 'lucide-react';

interface Props {
  user: User;
}

const CanvasManagerTab: React.FC<Props> = ({ user }) => {
  const [operators, setOperators] = useState<TelephonyOperator[]>([]);
  const [offers, setOffers] = useState<CanvasOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAddingOffer, setIsAddingOffer] = useState(false);
  const [isAddingOperator, setIsAddingOperator] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Filter State
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<CanvasOfferType>('MOBILE');

  // New Operator Form
  const [newOperator, setNewOperator] = useState({ name: '', color: '#333333' });

  // New/Edit Offer Form State
  const [editingOffer, setEditingOffer] = useState<Partial<CanvasOffer> | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [ops, offs] = await Promise.all([
        API.list_operators(),
        API.list_canvas(user)
    ]);
    setOperators(ops);
    setOffers(offs);
    
    // Select first operator if none selected or if previously selected is no longer available
    if ((!selectedOperatorId || !ops.find(o => o.id === selectedOperatorId)) && ops.length > 0) {
        setSelectedOperatorId(ops[0].id);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleCeaseOffer = async (id: string) => {
      if(confirm('Sei sicuro di voler cessare questa offerta? Rimarrà nello storico ma non sarà più proposta.')) {
          await API.cease_canvas_offer(id);
          fetchData();
      }
  };

  const handleSaveOffer = async () => {
      if(!editingOffer?.name || editingOffer?.monthly_price === undefined) {
          alert("Compila i campi obbligatori");
          return;
      }
      
      const op = operators.find(o => o.id === selectedOperatorId);
      if(!op) return;

      const offerPayload: CanvasOffer = {
          ...editingOffer,
          operator_id: op.id,
          operator_name: op.name,
          status: editingOffer.status || 'ACTIVE',
      } as CanvasOffer;

      if (editingOffer.id) {
          // Update
          await API.update_canvas(offerPayload);
      } else {
          // Create
          await API.create_canvas(offerPayload);
      }

      setEditingOffer(null);
      setIsAddingOffer(false);
      fetchData();
  };

  const handleCreateOperator = async () => {
      if(!newOperator.name) return;
      await API.create_operator(newOperator.name, newOperator.color);
      setIsAddingOperator(false);
      setNewOperator({ name: '', color: '#333333' });
      fetchData();
  };

  const startNewOffer = () => {
      setEditingOffer({
          type: activeCategory, // Default to current tab
          target_segment: 'CONSUMER',
          visible_to_agency_ids: [user.agency_id],
          status: 'ACTIVE'
      });
      setIsAddingOffer(true);
  };

  const startEditOffer = (offer: CanvasOffer) => {
      setEditingOffer({ ...offer });
      setIsAddingOffer(true);
  };

  const handleUploadCanvas = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setIsUploading(true);
          try {
              const file = e.target.files[0];
              const result = await API.upload_canvas_file(file, user);
              await fetchData();
              alert(`Canvas importato con successo!\nGestore rilevato: ${result.operatorName}\nOfferte create: ${result.count}`);
          } catch (err) {
              console.error(err);
              alert("Errore durante l'importazione del Canvas.");
          } finally {
              setIsUploading(false);
              e.target.value = '';
          }
      }
  };

  const handleUrlImport = async () => {
      if (!urlInput) return;
      setIsUploading(true);
      try {
          const result = await API.upload_canvas_url(urlInput, user);
          await fetchData();
          alert(`Canvas importato con successo!\nGestore rilevato: ${result.operatorName}\nOfferte create: ${result.count}`);
          setUrlInput('');
      } catch (err) {
          console.error(err);
          alert("Errore durante l'importazione da URL. Assicurati che il link sia pubblico e diretto.");
      } finally {
          setIsUploading(false);
      }
  };

  const activeOffers = offers.filter(o => 
      o.operator_id === selectedOperatorId && o.type === activeCategory
  );
  
  const selectedOperator = operators.find(o => o.id === selectedOperatorId);

  const categories: { id: CanvasOfferType, label: string, icon: React.ReactNode }[] = [
      { id: 'MOBILE', label: 'Mobile', icon: <Smartphone className="w-4 h-4"/> },
      { id: 'FIXED', label: 'Fibra (Wired)', icon: <Router className="w-4 h-4"/> },
      { id: 'FWA', label: 'FWA (Wireless)', icon: <Signal className="w-4 h-4"/> },
      { id: 'CONVERGENCE', label: 'Convergenza', icon: <Layers className="w-4 h-4"/> },
      { id: 'SMARTPHONE', label: 'Smartphone', icon: <Tablet className="w-4 h-4"/> },
  ];

  return (
    <Container>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
           <h2 className="text-2xl font-bold text-brand-primary">Canvas Offerte</h2>
           <p className="text-sm text-gray-500">Gestione Listino per Gestore</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
            {/* URL & Upload Buttons */}
            <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-1 shadow-sm">
                <input 
                    type="text" 
                    placeholder="URL PDF/IMG..." 
                    className="text-xs p-1 outline-none w-32"
                    value={urlInput}
                    onChange={e => setUrlInput(e.target.value)}
                />
                <button onClick={handleUrlImport} disabled={isUploading || !urlInput} className="p-1.5 bg-gray-100 hover:bg-brand-accent text-gray-600 rounded">
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Link className="w-4 h-4"/>}
                </button>
            </div>
            <div className="relative">
                <button disabled={isUploading} className="bg-brand-accent hover:bg-teal-500 text-brand-dark px-3 py-2 rounded-lg font-bold flex items-center gap-2 text-xs uppercase shadow-sm">
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <UploadCloud className="w-4 h-4"/>} {isUploading ? 'Analisi...' : 'Importa File'}
                </button>
                <input type="file" accept="application/pdf,image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleUploadCanvas} disabled={isUploading} />
            </div>
            <div className="w-px h-8 bg-gray-300 mx-1"></div>
            <button onClick={() => setIsAddingOperator(true)} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg font-bold flex items-center gap-2 text-xs uppercase">
                <Building2 className="w-4 h-4"/> Gestore
            </button>
            <button onClick={startNewOffer} className="bg-brand-primary text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-dark" disabled={operators.length === 0}>
                <Plus className="w-5 h-5"/> Offerta
            </button>
        </div>
      </div>

      {/* 1. OPERATOR TABS */}
      <div className="bg-white border-b border-gray-200 px-4 pt-4 flex gap-2 overflow-x-auto rounded-t-xl">
          {operators.map(op => {
              const isActive = selectedOperatorId === op.id;
              return (
                  <button
                      key={op.id}
                      onClick={() => setSelectedOperatorId(op.id)}
                      className={`flex items-center gap-2 px-5 py-3 rounded-t-lg text-sm font-bold border-t border-l border-r transition-all min-w-[120px] justify-center relative ${isActive ? 'bg-gray-50 border-gray-200 border-b-transparent text-gray-800 translate-y-[1px] z-10' : 'bg-transparent border-transparent text-gray-400 hover:bg-gray-50'}`}
                  >
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: op.color_hex }}></div>
                      <span>{op.name}</span>
                      {isActive && <div className="absolute top-0 left-0 w-full h-1 bg-brand-accent rounded-t-lg"></div>}
                  </button>
              );
          })}
          {operators.length === 0 && <div className="p-4 text-gray-400 text-sm">Nessun gestore configurato.</div>}
      </div>

      {/* 2. CATEGORY TABS */}
      <div className="bg-gray-50 px-4 pt-2 border-b border-gray-200 flex gap-1 overflow-x-auto">
          {categories.map(cat => {
              const isActive = activeCategory === cat.id;
              return (
                  <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-bold transition-all whitespace-nowrap ${isActive ? 'bg-white text-brand-primary border border-gray-200 border-b-white translate-y-[1px]' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                      {cat.icon} {cat.label}
                  </button>
              );
          })}
      </div>

      {/* 3. CONTENT BODY */}
      <div className="bg-white p-6 border-l border-r border-b border-gray-200 rounded-b-2xl min-h-[400px]">
          
          {/* Operator Creation (Unchanged) */}
          {isAddingOperator && (
              <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 mb-6 flex gap-4 items-end animate-in fade-in">
                  <div className="flex-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Nome Gestore</label>
                      <input className="w-full border p-2 rounded" placeholder="Es. Starlink" value={newOperator.name} onChange={e => setNewOperator({...newOperator, name: e.target.value})} />
                  </div>
                  <div>
                      <label className="text-xs font-bold text-gray-500 uppercase">Colore</label>
                      <input type="color" className="w-full h-10 border p-1 rounded cursor-pointer" value={newOperator.color} onChange={e => setNewOperator({...newOperator, color: e.target.value})} />
                  </div>
                  <button onClick={handleCreateOperator} className="px-4 py-2 bg-brand-dark text-white font-bold rounded flex items-center gap-2 h-10"><Save className="w-4 h-4"/> Salva</button>
                  <button onClick={() => setIsAddingOperator(false)} className="px-4 py-2 text-gray-500 font-bold h-10">Annulla</button>
              </div>
          )}

          {/* Create/Edit Offer Modal */}
          {isAddingOffer && editingOffer && selectedOperator && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 relative">
                      <button onClick={() => { setIsAddingOffer(false); setEditingOffer(null); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
                      
                      <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 text-xl">
                          {editingOffer.id ? <Pencil className="w-5 h-5 text-brand-accent"/> : <Plus className="w-5 h-5 text-brand-accent"/>}
                          {editingOffer.id ? 'Modifica Offerta' : 'Nuova Offerta'}
                          <span className="text-sm font-normal text-gray-500 ml-2">per {selectedOperator.name}</span>
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                          <div className="col-span-2">
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Offerta / Modello Device</label>
                              <input className="w-full border p-2 rounded" placeholder="Es. Power Unlimited o iPhone 15" value={editingOffer.name || ''} onChange={e => setEditingOffer({...editingOffer, name: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo</label>
                              <select className="w-full border p-2 rounded" value={editingOffer.type} onChange={e => setEditingOffer({...editingOffer, type: e.target.value as any})}>
                                  <option value="MOBILE">Mobile (SIM)</option>
                                  <option value="FIXED">Fisso (Fibra/ADSL)</option>
                                  <option value="FWA">FWA (Wireless)</option>
                                  <option value="CONVERGENCE">Convergenza</option>
                                  <option value="SMARTPHONE">Smartphone (Rate)</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Target</label>
                              <select className="w-full border p-2 rounded" value={editingOffer.target_segment} onChange={e => setEditingOffer({...editingOffer, target_segment: e.target.value as any})}>
                                  <option value="CONSUMER">Consumer (Privati)</option>
                                  <option value="BUSINESS">Business (P.IVA)</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                  {editingOffer.type === 'SMARTPHONE' ? 'Rata Mensile (€)' : 'Canone Mensile (€)'}
                              </label>
                              <input type="number" step="0.01" className="w-full border p-2 rounded" value={editingOffer.monthly_price ?? ''} onChange={e => setEditingOffer({...editingOffer, monthly_price: parseFloat(e.target.value)})} />
                          </div>
                          
                          {/* Dynamic Fields */}
                          {editingOffer.type === 'SMARTPHONE' ? (
                              <>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Anticipo (€)</label>
                                    <input type="number" className="w-full border p-2 rounded" value={editingOffer.upfront_cost ?? 0} onChange={e => setEditingOffer({...editingOffer, upfront_cost: parseFloat(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Numero Rate (Mesi)</label>
                                    <input type="number" className="w-full border p-2 rounded" value={editingOffer.installment_count ?? 30} onChange={e => setEditingOffer({...editingOffer, installment_count: parseFloat(e.target.value)})} />
                                </div>
                              </>
                          ) : (
                              <>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Giga / Velocità</label>
                                      <input 
                                        className="w-full border p-2 rounded" 
                                        placeholder="Es. 100GB o 2.5Gbps" 
                                        value={editingOffer.technology || editingOffer.data_gb?.toString() || ''} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            const num = parseFloat(val);
                                            const dataGb = val.toUpperCase() === 'UNLIMITED' ? 'UNLIMITED' : (isNaN(num) ? undefined : num);
                                            setEditingOffer({...editingOffer, technology: val, data_gb: dataGb});
                                        }} 
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Minuti</label>
                                      <input 
                                        className="w-full border p-2 rounded" 
                                        placeholder="Es. UNLIMITED" 
                                        value={editingOffer.minutes?.toString() || ''} 
                                        onChange={e => {
                                            const val = e.target.value;
                                            const num = parseFloat(val);
                                            const mins = val.toUpperCase() === 'UNLIMITED' ? 'UNLIMITED' : (isNaN(num) ? undefined : num);
                                            setEditingOffer({...editingOffer, minutes: mins});
                                        }} 
                                      />
                                  </div>
                              </>
                          )}
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Costo Attivazione (€)</label>
                              <input type="number" className="w-full border p-2 rounded" value={editingOffer.activation_fee ?? 0} onChange={e => setEditingOffer({...editingOffer, activation_fee: parseFloat(e.target.value)})} />
                          </div>
                      </div>
                      
                      <div className="flex justify-end gap-2 border-t pt-4">
                          <button onClick={() => { setIsAddingOffer(false); setEditingOffer(null); }} className="px-4 py-2 text-gray-500 font-bold">Annulla</button>
                          <button onClick={handleSaveOffer} className="px-6 py-2 bg-brand-primary text-white font-bold rounded shadow-sm flex items-center gap-2 hover:bg-brand-dark transition-colors">
                              <Save className="w-4 h-4"/> Salva Offerta
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {/* OFFERS GRID */}
          {loading ? <div className="text-center py-10">Caricamento...</div> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeOffers.length === 0 && (
                      <div className="col-span-full text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">
                          Nessuna offerta in questa categoria.
                          <br/><span className="text-xs">Usa "Analisi" per importare o "+" per creare manualmente.</span>
                      </div>
                  )}

                  {activeOffers.map(offer => {
                      const isCeased = offer.status === 'CEASED';
                      return (
                      <div key={offer.id} className={`bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all relative group flex flex-col justify-between ${isCeased ? 'border-gray-200 opacity-60 bg-gray-50' : 'border-gray-200'}`}>
                          <div>
                              <div className="flex justify-between items-start mb-2">
                                  <div className="flex items-center gap-2">
                                      <div className={`p-2 rounded-full ${isCeased ? 'bg-gray-200' : 'bg-brand-accent/10'}`}>
                                          {offer.type === 'MOBILE' && <Smartphone className={`w-5 h-5 ${isCeased ? 'text-gray-400' : 'text-brand-primary'}`}/>}
                                          {offer.type === 'FIXED' && <Router className={`w-5 h-5 ${isCeased ? 'text-gray-400' : 'text-brand-primary'}`}/>}
                                          {offer.type === 'FWA' && <Signal className={`w-5 h-5 ${isCeased ? 'text-gray-400' : 'text-brand-primary'}`}/>}
                                          {offer.type === 'CONVERGENCE' && <Layers className={`w-5 h-5 ${isCeased ? 'text-gray-400' : 'text-purple-600'}`}/>}
                                          {offer.type === 'SMARTPHONE' && <Tablet className={`w-5 h-5 ${isCeased ? 'text-gray-400' : 'text-blue-600'}`}/>}
                                      </div>
                                      <div>
                                          <div className={`font-bold leading-tight ${isCeased ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{offer.name}</div>
                                          <div className="text-xs text-gray-500">{offer.target_segment}</div>
                                      </div>
                                  </div>
                                  <div className="flex gap-1">
                                      {!isCeased && (
                                          <button onClick={() => startEditOffer(offer)} className="text-gray-300 hover:text-blue-500 transition-colors" title="Modifica">
                                              <Pencil className="w-4 h-4" />
                                          </button>
                                      )}
                                      {!isCeased && (
                                          <button onClick={() => handleCeaseOffer(offer.id)} className="text-gray-300 hover:text-red-500 transition-colors" title="Cessa Offerta">
                                              <Ban className="w-4 h-4" />
                                          </button>
                                      )}
                                  </div>
                                  {isCeased && <span className="text-[10px] bg-gray-200 text-gray-500 px-2 py-1 rounded font-bold">CESSATA</span>}
                              </div>
                              
                              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-end">
                                  <div>
                                      <div className="text-[10px] text-gray-400 uppercase font-bold">Incluso</div>
                                      <div className="text-sm font-medium text-gray-700">
                                          {offer.type === 'SMARTPHONE' ? (
                                              <span>Anticipo: {offer.upfront_cost}€</span>
                                          ) : (
                                              offer.data_gb ? (offer.data_gb === 'UNLIMITED' ? 'Giga Illimitati' : `${offer.data_gb} GB`) : offer.technology
                                          )}
                                      </div>
                                  </div>
                                  <div className="text-right">
                                      <div className={`text-2xl font-bold ${isCeased ? 'text-gray-400' : 'text-brand-primary'}`}>
                                          {offer.type === 'SMARTPHONE' ? `+${offer.monthly_price.toFixed(2)}` : offer.monthly_price.toFixed(2)} €
                                      </div>
                                      <div className="text-[10px] text-gray-400">
                                          {offer.type === 'SMARTPHONE' ? `x ${offer.installment_count} rate` : '/ mese'}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  )})}
              </div>
          )}
      </div>
    </Container>
  );
};

export default CanvasManagerTab;
