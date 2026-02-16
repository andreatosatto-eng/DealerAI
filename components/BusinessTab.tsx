
import React, { useState, useEffect } from 'react';
import { Customer, User, Property, ExtractedBill } from '../types';
import * as API from '../services/mockApi';
import { Container } from './ui/Layouts';
import { Building2, Search, Zap, Flame, Home, UserCheck, Briefcase, Smartphone, Leaf, Car, Plus, X, UploadCloud, Loader2, AlertCircle, ArrowLeftRight, ArrowRight, Edit, Save, MapPin, Camera, FileText, Wand2, Trash2, GitMerge, ArrowUpRight } from 'lucide-react';

interface Props {
  user: User;
}

const BusinessTab: React.FC<Props> = ({ user }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCustId, setExpandedCustId] = useState<string | null>(null);

  // Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  // Ambiguous Property State for Upload
  const [ambiguousState, setAmbiguousState] = useState<{
      extractedData: ExtractedBill;
      existingCustomerId: string;
      existingProperties: Property[];
  } | null>(null);

  // Conflict State for Property Transfer
  const [conflictState, setConflictState] = useState<{
      extractedData: ExtractedBill;
      conflictOwner: Customer;
      conflictProperty: Property;
  } | null>(null);

  // Modals
  const [editingProperty, setEditingProperty] = useState<{ customer: Customer, property: Partial<Property> } | null>(null);

  // Merge Modal State
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [mergeSourceId, setMergeSourceId] = useState<string>('');

  const fetchCustomers = () => {
    setLoading(true);
    API.get_customers(user.agency_id).then(async (data) => {
      const comps = data.filter(c => c.type === 'COMPANY');
      setCustomers(comps);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchCustomers();
  }, [user.agency_id]);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newFiles = Array.from(e.target.files);
          setSelectedFiles(prev => [...prev, ...newFiles]);
      }
  };

  const removeFile = (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) return;
    
    setIsUploading(true);
    try {
        const result = await API.analyze_bill(selectedFiles, user);
        
        if (result.status === 'CONFLICT_EXISTING_OWNER') {
            setConflictState({
                extractedData: result.extracted_data,
                conflictOwner: result.conflict_owner!,
                conflictProperty: result.conflict_property!
            });
            setShowUploadModal(false);
            return;
        }

        if (result.status === 'AMBIGUOUS_PROPERTY') {
            setAmbiguousState({
                extractedData: result.extracted_data,
                existingCustomerId: result.existing_customer_id!,
                existingProperties: result.existing_properties!
            });
            setShowUploadModal(false);
            return;
        }

        // Success Path
        await fetchCustomers();
        setShowUploadModal(false);
        setSelectedFiles([]);
        setSearch(result.customer_data!.fiscal_code);
        alert(`Analisi completata! Azienda: ${result.customer_data!.company_name}`);
    } catch (err) {
        console.error(err);
        alert("Errore durante l'analisi dei documenti.");
    } finally {
        setIsUploading(false);
    }
  };

  const handlePropertySelection = async (propertyId: string | 'NEW') => {
      if (!ambiguousState) return;
      setIsUploading(true);
      try {
          const { customer } = await API.save_analyzed_bill(
              ambiguousState.extractedData,
              user,
              ambiguousState.existingCustomerId,
              propertyId
          );
          setAmbiguousState(null);
          await fetchCustomers();
          setSearch(customer.company_name!);
      } catch (e) {
          alert("Errore nel salvataggio.");
      } finally {
          setIsUploading(false);
      }
  };

  const handleTransfer = async () => {
      if (!conflictState) return;
      setIsUploading(true);
      try {
          const { newCustomer } = await API.transfer_property(
              conflictState.extractedData,
              user,
              conflictState.conflictOwner,
              conflictState.conflictProperty
          );
          setConflictState(null);
          await fetchCustomers();
          setSearch(newCustomer.company_name!);
          alert("Subentro aziendale completato!");
      } catch (e) {
          alert("Errore nel trasferimento sede.");
      } finally {
          setIsUploading(false);
      }
  };

  const handleSaveProperty = async () => {
      if (!editingProperty) return;
      const { customer, property } = editingProperty;
      
      let updatedProps = [...customer.properties];
      if (property.id) {
          updatedProps = updatedProps.map(p => p.id === property.id ? { ...p, ...property } as Property : p);
      } else {
          const newProp: Property = {
              id: `prop_${Date.now()}`,
              status: 'ACTIVE',
              address: property.address || '',
              city: property.city || '',
              is_resident: false, // Usually false for businesses
              electricity: undefined,
              gas: undefined,
              ...property
          } as Property;
          updatedProps.push(newProp);
      }

      await API.update_customer({ ...customer, properties: updatedProps });
      setEditingProperty(null);
      fetchCustomers();
  };

  // DELETE ACTIONS
  const handleDeleteCustomer = async (id: string, name: string) => {
      if (confirm(`Sei sicuro di voler eliminare l'azienda ${name}?`)) {
          setLoading(true);
          await API.delete_customer(id);
          await fetchCustomers();
          setLoading(false);
      }
  };

  const handleDeleteProperty = async (customerId: string, propertyId: string) => {
      if (confirm("Sei sicuro di voler rimuovere questa sede?")) {
          setLoading(true);
          await API.delete_property(customerId, propertyId);
          await fetchCustomers();
          setLoading(false);
      }
  };

  // MERGE ACTIONS
  const handleMerge = async () => {
      if (!mergeTargetId || !mergeSourceId) return;
      if (mergeTargetId === mergeSourceId) {
          alert("Devi selezionare due aziende diverse.");
          return;
      }
      
      const targetName = customers.find(c => c.id === mergeTargetId)?.company_name;
      const sourceName = customers.find(c => c.id === mergeSourceId)?.company_name;

      if (confirm(`Confermi di voler unire ${sourceName} dentro ${targetName}? \nL'azienda ${sourceName} verrà eliminata e i suoi dati (sedi, bollette) spostati.`)) {
          setLoading(true);
          try {
              await API.merge_customers(mergeTargetId, mergeSourceId);
              setShowMergeModal(false);
              setMergeTargetId('');
              setMergeSourceId('');
              await fetchCustomers();
              alert("Unione aziende completata.");
          } catch (e) {
              alert("Errore durante l'unione.");
          } finally {
              setLoading(false);
          }
      }
  };

  const filtered = customers.filter(c => {
    const lowerSearch = search.toLowerCase();
    const nameMatch = c.company_name?.toLowerCase().includes(lowerSearch);
    const cfMatch = c.fiscal_code.toLowerCase().includes(lowerSearch);
    const podMatch = c.properties.some(p => p.electricity?.code?.toLowerCase().includes(lowerSearch) || p.gas?.code?.toLowerCase().includes(lowerSearch));
    return nameMatch || cfMatch || podMatch;
  });

  return (
    <Container>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
           <h2 className="text-2xl font-bold text-brand-primary">Aziende Clienti</h2>
           <p className="text-sm text-gray-500">Gestione Business</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setShowMergeModal(true)}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm"
            >
                <GitMerge className="w-5 h-5" />
                <span className="hidden md:inline">Unisci Duplicati</span>
            </button>
            <button 
                onClick={() => { setShowUploadModal(true); setSelectedFiles([]); }}
                className="bg-brand-primary hover:bg-brand-dark text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5"
            >
                <Plus className="w-5 h-5" />
                <span>Nuovo Cliente</span>
            </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 sticky top-20 z-20">
        <div className="relative">
           <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
           <input 
             type="text" 
             placeholder="Cerca Ragione Sociale, P.IVA, POD o PDR..." 
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-accent"
           />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Caricamento aziende...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
           {filtered.map(cust => (
             <div key={cust.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all">
               <div className="p-6 cursor-pointer" onClick={() => setExpandedCustId(expandedCustId === cust.id ? null : cust.id)}>
                 <div className="flex items-start justify-between">
                     <div className="flex items-start gap-4">
                        <div className="p-3 rounded-full bg-blue-100 text-blue-600"><Building2 className="w-6 h-6" /></div>
                        <div><h3 className="font-bold text-lg text-gray-800">{cust.company_name}</h3><div className="text-sm text-gray-500 font-mono">{cust.fiscal_code}</div></div>
                     </div>
                     {expandedCustId === cust.id && (
                         <button 
                             onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(cust.id, cust.company_name || '') }}
                             className="text-gray-300 hover:text-red-500 p-2"
                             title="Elimina Azienda"
                         >
                             <Trash2 className="w-5 h-5" />
                         </button>
                     )}
                 </div>
               </div>

               {expandedCustId === cust.id && (
                   <div className="bg-gray-50 border-t border-gray-100 p-4 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                                <MapPin className="w-4 h-4" /> Sedi Operative
                            </h4>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setEditingProperty({ customer: cust, property: { status: 'ACTIVE' } }); }}
                                className="text-xs flex items-center gap-1 bg-white border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-100 text-brand-primary font-bold"
                            >
                                <Plus className="w-3 h-3" /> Aggiungi Sede
                            </button>
                        </div>
                        <div className="grid gap-2">
                            {cust.properties.map(prop => (
                                <div key={prop.id} className={`bg-white p-3 rounded border flex justify-between items-center ${prop.status === 'SOLD' ? 'opacity-60 bg-gray-100' : ''}`}>
                                    <div className="flex flex-col gap-1 w-full mr-4">
                                        <div className="flex items-center gap-3">
                                            <Building2 className="w-5 h-5 text-gray-400" />
                                            <div>
                                                <div className="font-bold text-sm">{prop.address}</div>
                                                <div className="text-xs text-gray-500">{prop.city}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 ml-8 mt-1">
                                            {prop.electricity && <span className="text-[10px] font-mono bg-yellow-100 text-yellow-800 px-1.5 rounded border border-yellow-200">POD: {prop.electricity.code}</span>}
                                            {prop.gas && <span className="text-[10px] font-mono bg-orange-100 text-orange-800 px-1.5 rounded border border-orange-200">PDR: {prop.gas.code}</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => setEditingProperty({ customer: cust, property: prop })}
                                            className="p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-100 rounded"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteProperty(cust.id, prop.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                   </div>
               )}
             </div>
           ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-brand-primary p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg">Nuova Bolletta Business</h3>
                    <button onClick={() => setShowUploadModal(false)}><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 relative group mb-4">
                        <input 
                            type="file" 
                            accept="image/*,application/pdf"
                            onChange={handleFileSelection}
                            multiple
                            disabled={isUploading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center gap-2 pointer-events-none">
                            {isUploading ? (
                                <Loader2 className="w-10 h-10 text-brand-accent animate-spin" />
                            ) : (
                                <UploadCloud className="w-10 h-10 text-gray-400" />
                            )}
                            <span className="text-gray-600 font-medium">Trascina o Carica</span>
                            <span className="text-xs text-gray-400">(Supporto multi-selezione)</span>
                        </div>
                    </div>

                    {selectedFiles.length > 0 && (
                        <div className="mb-4">
                            <h4 className="text-sm font-bold text-gray-700 mb-2">Documenti selezionati ({selectedFiles.length}):</h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {selectedFiles.map((file, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm border border-gray-200">
                                        <div className="flex items-center gap-2 truncate">
                                            <FileText className="w-4 h-4 text-brand-primary"/>
                                            <span className="truncate max-w-[200px]">{file.name}</span>
                                        </div>
                                        <button onClick={() => removeFile(idx)} className="text-red-500 hover:bg-red-100 p-1 rounded">
                                            <X className="w-4 h-4"/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button 
                        onClick={handleAnalyze}
                        disabled={selectedFiles.length === 0 || isUploading}
                        className="w-full py-3 bg-brand-primary disabled:bg-gray-300 text-white font-bold rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all"
                    >
                        {isUploading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" /> Analisi con IA in corso...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-5 h-5" /> Avvia Analisi con IA
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* EDIT PROPERTY MODAL */}
      {editingProperty && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-brand-primary p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <Building2 className="w-5 h-5" />
                          {editingProperty.property.id ? 'Modifica Sede' : 'Nuova Sede'}
                      </h3>
                      <button onClick={() => setEditingProperty(null)}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Indirizzo Sede</label>
                          <input 
                              className="w-full p-2 border rounded" 
                              placeholder="Via Roma 1"
                              value={editingProperty.property.address || ''} 
                              onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, address: e.target.value}})} 
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Città</label>
                              <input 
                                  className="w-full p-2 border rounded" 
                                  placeholder="Milano"
                                  value={editingProperty.property.city || ''} 
                                  onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, city: e.target.value}})} 
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stato Sede</label>
                              <select 
                                  className="w-full p-2 border rounded"
                                  value={editingProperty.property.status || 'ACTIVE'}
                                  onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, status: e.target.value as any}})}
                              >
                                  <option value="ACTIVE">Attiva</option>
                                  <option value="SOLD">Chiusa/Trasferita</option>
                                  <option value="OBSOLETE">Storico</option>
                              </select>
                          </div>
                      </div>

                      <div className="pt-4 flex justify-end gap-2 border-t">
                          <button onClick={() => setEditingProperty(null)} className="px-4 py-2 text-gray-500 font-bold">Annulla</button>
                          <button onClick={handleSaveProperty} className="px-4 py-2 bg-brand-primary text-white font-bold rounded flex items-center gap-2">
                              <Save className="w-4 h-4"/> Salva Sede
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* MERGE MODAL */}
      {showMergeModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-brand-primary p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <GitMerge className="w-5 h-5" />
                          Unisci Duplicati (Fusione)
                      </h3>
                      <button onClick={() => setShowMergeModal(false)}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <p className="text-sm text-gray-600 mb-4">
                          Questa operazione sposterà tutte le sedi e bollette dall' "Azienda Duplicata" all' "Azienda Principale", ed eliminerà il duplicato.
                      </p>
                      
                      <div>
                          <label className="block text-xs font-bold text-green-700 uppercase mb-1">1. Azienda Principale (Mantiene i dati)</label>
                          <select 
                              className="w-full p-3 border-2 border-green-100 bg-green-50 rounded-lg focus:outline-none focus:border-green-500"
                              value={mergeTargetId}
                              onChange={(e) => setMergeTargetId(e.target.value)}
                          >
                              <option value="">-- Seleziona --</option>
                              {customers.filter(c => c.id !== mergeSourceId).map(c => (
                                  <option key={c.id} value={c.id}>{c.company_name} ({c.fiscal_code})</option>
                              ))}
                          </select>
                      </div>

                      <div className="flex justify-center">
                          <ArrowUpRight className="w-6 h-6 text-gray-300" />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-red-700 uppercase mb-1">2. Azienda Duplicata (Verrà eliminata)</label>
                          <select 
                              className="w-full p-3 border-2 border-red-100 bg-red-50 rounded-lg focus:outline-none focus:border-red-500"
                              value={mergeSourceId}
                              onChange={(e) => setMergeSourceId(e.target.value)}
                          >
                              <option value="">-- Seleziona --</option>
                              {customers.filter(c => c.id !== mergeTargetId).map(c => (
                                  <option key={c.id} value={c.id}>{c.company_name} ({c.fiscal_code})</option>
                              ))}
                          </select>
                      </div>

                      <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                          <button onClick={() => setShowMergeModal(false)} className="px-4 py-2 text-gray-500 font-bold">Annulla</button>
                          <button onClick={handleMerge} disabled={!mergeTargetId || !mergeSourceId} className="px-4 py-2 bg-brand-primary disabled:bg-gray-300 text-white font-bold rounded flex items-center gap-2 shadow-lg">
                              <GitMerge className="w-4 h-4"/> Esegui Unione
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* AMBIGUOUS PROPERTY MODAL */}
      {ambiguousState && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-brand-primary p-5 text-white">
                  <h3 className="text-xl font-bold flex items-center gap-2"><AlertCircle className="w-6 h-6" /> Sede esistente?</h3>
              </div>
              <div className="p-6">
                  <div className="space-y-3 mb-6">
                      {ambiguousState.existingProperties.map(prop => (
                          <div key={prop.id} onClick={() => handlePropertySelection(prop.id)} className="p-3 border rounded-lg hover:border-brand-accent cursor-pointer">
                              <div className="font-bold">{prop.address}</div>
                          </div>
                      ))}
                  </div>
                  <button onClick={() => handlePropertySelection('NEW')} className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-bold">+ Nuova Sede</button>
                  <button onClick={() => setAmbiguousState(null)} className="w-full mt-4 text-xs text-gray-400 underline">Annulla</button>
              </div>
           </div>
        </div>
      )}

      {/* CONFLICT MODAL (VOLTURA AZIENDALE) */}
      {conflictState && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border-2 border-orange-500">
              <div className="bg-orange-500 p-5 text-white">
                  <h3 className="text-xl font-bold flex items-center gap-2"><ArrowLeftRight className="w-6 h-6" /> Conflitto Sede / POD</h3>
              </div>
              <div className="p-6">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                      <h4 className="text-xs font-bold text-orange-800 uppercase mb-2">Attuale Intestatario Sede:</h4>
                      <p className="font-bold text-gray-800 text-lg">{conflictState.conflictOwner.company_name}</p>
                      <p className="text-sm text-gray-600 font-mono mb-2">{conflictState.conflictOwner.fiscal_code}</p>
                      <p className="text-xs text-gray-500">Indirizzo: {conflictState.conflictProperty.address}</p>
                  </div>
                  <button onClick={handleTransfer} className="w-full p-4 bg-brand-primary text-white rounded-lg font-bold flex items-center justify-between shadow-lg">
                      <span>Esegui Subentro Aziendale</span><ArrowRight className="w-6 h-6" />
                  </button>
                  <button onClick={() => setConflictState(null)} className="w-full mt-4 text-xs text-gray-400 underline">Annulla</button>
              </div>
           </div>
        </div>
      )}
    </Container>
  );
};

export default BusinessTab;
