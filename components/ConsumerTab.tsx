
import React, { useState, useEffect } from 'react';
import { Customer, User, Opportunity, CommodityDetails, ExtractedBill, Property } from '../types';
import * as API from '../services/mockApi';
import { Container } from './ui/Layouts';
import { User as UserIcon, Building2, Search, MapPin, Calendar, Zap, Flame, Home, Plus, X, UploadCloud, Loader2, ArrowUpRight, Edit, Save, Trash2, Users, History, PiggyBank, TrendingDown, Settings, Smartphone, Leaf, Car, AlertCircle, ArrowLeftRight, ArrowRight, Camera, FileText, Wand2, GitMerge } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  user: User;
}

const ConsumerTab: React.FC<Props> = ({ user }) => {
  const [families, setFamilies] = useState<Record<string, Customer[]>>({});
  const [flatCustomers, setFlatCustomers] = useState<Customer[]>([]); // Useful for merge search
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false); // New state for modal actions
  const [search, setSearch] = useState('');
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);

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
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingProperty, setEditingProperty] = useState<{ customer: Customer, property: Partial<Property> } | null>(null);
  
  // Merge Modal State
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [mergeSourceId, setMergeSourceId] = useState<string>('');
  const [mergeMode, setMergeMode] = useState<'MERGE' | 'LINK'>('LINK'); // Default to Link family

  const fetchFamilies = () => {
    setLoading(true);
    API.get_families(user.agency_id)
        .then(async (data) => {
            setFamilies(data);
            const flat: Customer[] = [];
            Object.values(data).forEach(arr => flat.push(...arr));
            setFlatCustomers(flat);
        })
        .catch(err => console.error("Error fetching families:", err))
        .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFamilies();
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
        await fetchFamilies();
        setShowUploadModal(false);
        setSelectedFiles([]);
        const name = result.customer_data!.last_name || result.customer_data!.company_name;
        alert(`Analisi completata! Cliente ${name} aggiornato/creato.`);
        setSearch(name || '');
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
          await fetchFamilies();
          setSearch(customer.last_name || customer.fiscal_code);
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
          await fetchFamilies();
          setSearch(newCustomer.last_name || newCustomer.fiscal_code);
          alert("Voltura completata con successo!");
      } catch (e) {
          alert("Errore nel trasferimento.");
      } finally {
          setIsUploading(false);
      }
  };

  const handleSaveCustomer = async () => {
      if (!editingCustomer) return;
      await API.update_customer(editingCustomer);
      setEditingCustomer(null);
      fetchFamilies();
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
              is_resident: property.is_resident || false,
              electricity: undefined,
              gas: undefined,
              ...property
          } as Property;
          updatedProps.push(newProp);
      }

      await API.update_customer({ ...customer, properties: updatedProps });
      setEditingProperty(null);
      fetchFamilies();
  };

  // DELETE ACTIONS
  const handleDeleteCustomer = async (id: string, name: string) => {
      if (confirm(`Sei sicuro di voler eliminare definitivamente il cliente ${name}?`)) {
          setLoading(true);
          await API.delete_customer(id);
          await fetchFamilies();
          setLoading(false);
      }
  };

  const handleDeleteProperty = async (customerId: string, propertyId: string) => {
      if (confirm("Sei sicuro di voler rimuovere questo immobile?")) {
          setLoading(true);
          await API.delete_property(customerId, propertyId);
          await fetchFamilies();
          setLoading(false);
      }
  };

  // MERGE / LINK ACTIONS
  const handleMerge = async () => {
      if (!mergeTargetId || !mergeSourceId) return;
      if (mergeTargetId === mergeSourceId) {
          alert("Devi selezionare due clienti diversi.");
          return;
      }
      
      const targetName = flatCustomers.find(c => c.id === mergeTargetId)?.last_name;
      const sourceName = flatCustomers.find(c => c.id === mergeSourceId)?.last_name;

      setActionLoading(true); // Start specific loading

      try {
          if (mergeMode === 'MERGE') {
              // MERGE MODE
              if (confirm(`ATTENZIONE: Fusione Duplicati.\n\nIl cliente "${sourceName}" VERRÀ ELIMINATO e i suoi immobili passeranno a "${targetName}".\n\nConfermi?`)) {
                  await API.merge_customers(mergeTargetId, mergeSourceId);
                  alert("Fusione completata.");
                  setShowMergeModal(false);
                  setMergeTargetId('');
                  setMergeSourceId('');
                  await fetchFamilies();
              }
          } else {
              // LINK MODE
              // Removed native confirm to avoid blocking UI feel, action is safe/reversible
              await API.link_to_family(mergeTargetId, mergeSourceId);
              // alert("Famiglia creata con successo."); // Optional: remove alert for smoother flow
              setShowMergeModal(false);
              setMergeTargetId('');
              setMergeSourceId('');
              await fetchFamilies();
          }
      } catch (e) {
          console.error(e);
          alert("Si è verificato un errore durante l'operazione. Riprova.");
      } finally {
          setActionLoading(false);
      }
  };

  const filteredFamilies = (Object.entries(families) as [string, Customer[]][]).filter(([key, members]) => {
      const lowerSearch = search.toLowerCase();
      return members.some(m => 
        m.last_name?.toLowerCase().includes(lowerSearch) || 
        m.first_name?.toLowerCase().includes(lowerSearch) ||
        m.fiscal_code.toLowerCase().includes(lowerSearch) ||
        m.properties.some(p => p.electricity?.code?.toLowerCase().includes(lowerSearch) || p.gas?.code?.toLowerCase().includes(lowerSearch))
      );
  });

  return (
    <Container>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
           <h2 className="text-2xl font-bold text-brand-primary">Nuclei Famigliari</h2>
           <p className="text-sm text-gray-500">Gestione Consumer</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setShowMergeModal(true)}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm"
            >
                <GitMerge className="w-5 h-5" />
                <span className="hidden md:inline">Unisci / Famiglia</span>
            </button>
            <button 
            onClick={() => { setShowUploadModal(true); setSelectedFiles([]); }}
            className="bg-brand-primary hover:bg-brand-dark text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5"
            >
                <Plus className="w-5 h-5" />
                <span>Nuovo</span>
            </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 sticky top-20 z-20">
        <div className="relative">
           <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
           <input 
             type="text" 
             placeholder="Cerca famiglia, POD o PDR..." 
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-accent"
           />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Caricamento famiglie...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
           {filteredFamilies.map(([familyKey, members]) => {
             const head = members.find(m => m.is_family_head) || members[0];
             const familyName = `Famiglia ${head.last_name}`;
             const isExpanded = expandedFamilyId === familyKey;

             return (
             <div key={familyKey} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all">
               <div className="p-6 cursor-pointer" onClick={() => setExpandedFamilyId(isExpanded ? null : familyKey)}>
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-teal-100 p-3 rounded-full text-teal-700"><Users className="w-6 h-6" /></div>
                        <div>
                            <h3 className="font-bold text-lg text-gray-800">{familyName}</h3>
                            <p className="text-sm text-gray-500">{members.length} Membri • Capofamiglia: {head.first_name}</p>
                        </div>
                    </div>
                 </div>
               </div>

               {isExpanded && (
                   <div className="bg-gray-50 border-t border-gray-100 p-4 space-y-4">
                       {members.map(member => (
                           <div key={member.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm relative group">
                               <div className="flex justify-between items-start mb-4 border-b pb-2">
                                   <div className="flex items-center gap-2">
                                       <UserIcon className="w-4 h-4 text-gray-400" />
                                       <span className="font-bold text-gray-800">{member.first_name} {member.last_name}</span>
                                       <span className="text-xs text-gray-400 font-mono ml-2">{member.fiscal_code}</span>
                                       {member.is_family_head && <span className="text-[10px] bg-teal-100 text-teal-800 px-2 rounded-full">CAPOFAMIGLIA</span>}
                                   </div>
                                   <div className="flex gap-2">
                                      <button 
                                          className="text-xs text-brand-primary font-bold hover:underline flex items-center gap-1"
                                          onClick={() => setEditingProperty({ customer: member, property: { status: 'ACTIVE' } })}
                                      >
                                          <Plus className="w-3 h-3"/> Casa
                                      </button>
                                      <button className="text-xs text-blue-600 font-bold hover:underline" onClick={() => setEditingCustomer({...member})}>Edit</button>
                                      <button className="text-xs text-red-500 font-bold hover:underline ml-2" onClick={() => handleDeleteCustomer(member.id, `${member.first_name} ${member.last_name}`)}>Elimina</button>
                                   </div>
                               </div>
                               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                   {member.properties.map(prop => (
                                       <div key={prop.id} className={`p-2 border rounded text-[10px] space-y-1 relative group cursor-pointer hover:border-brand-accent ${prop.status === 'SOLD' ? 'opacity-50 bg-gray-100' : 'bg-gray-50'}`} onClick={() => setEditingProperty({ customer: member, property: prop })}>
                                            <div className="font-bold text-gray-700 truncate">{prop.address}</div>
                                            <div className="flex gap-1 mb-1">
                                                {prop.electricity && <span className="bg-yellow-100 text-yellow-800 px-1 rounded border border-yellow-200 truncate">POD: {prop.electricity.code}</span>}
                                                {prop.gas && <span className="bg-orange-100 text-orange-800 px-1 rounded border border-orange-200 truncate">PDR: {prop.gas.code}</span>}
                                            </div>
                                            <div className="flex gap-1">
                                                {prop.is_resident && <span className="bg-green-100 text-green-700 px-1 rounded ml-auto">Residenza</span>}
                                                {prop.status === 'SOLD' && <span className="bg-red-100 text-red-700 px-1 rounded ml-auto">VENDUTA</span>}
                                            </div>
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1">
                                                <Edit className="w-3 h-3 text-gray-500 hover:text-brand-primary" />
                                                <Trash2 
                                                    className="w-3 h-3 text-gray-500 hover:text-red-500" 
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteProperty(member.id, prop.id); }}
                                                />
                                            </div>
                                       </div>
                                   ))}
                               </div>
                           </div>
                       ))}
                   </div>
               )}
             </div>
             );
           })}
        </div>
      )}

      {/* MERGE MODAL */}
      {showMergeModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-brand-primary p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <GitMerge className="w-5 h-5" />
                          Gestione Famiglie & Duplicati
                      </h3>
                      <button onClick={() => setShowMergeModal(false)}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      
                      <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                          <button 
                              onClick={() => setMergeMode('LINK')}
                              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mergeMode === 'LINK' ? 'bg-white text-brand-primary shadow' : 'text-gray-500'}`}
                          >
                              Crea Famiglia
                          </button>
                          <button 
                              onClick={() => setMergeMode('MERGE')}
                              className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${mergeMode === 'MERGE' ? 'bg-white text-red-600 shadow' : 'text-gray-500'}`}
                          >
                              Fusione Duplicati
                          </button>
                      </div>

                      <p className="text-sm text-gray-600 mb-4 bg-blue-50 p-3 rounded border border-blue-100">
                          {mergeMode === 'LINK' 
                              ? "Collega due persone (es. Marito e Moglie) nello stesso nucleo familiare. Entrambi rimarranno attivi."
                              : "ATTENZIONE: Unisce due schede duplicate. Il cliente 'Duplicato' verrà ELIMINATO per sempre."
                          }
                      </p>
                      
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                              {mergeMode === 'LINK' ? 'Capofamiglia (Principale)' : 'Cliente Corretto (Mantiene i dati)'}
                          </label>
                          <select 
                              className="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-brand-accent"
                              value={mergeTargetId}
                              onChange={(e) => setMergeTargetId(e.target.value)}
                          >
                              <option value="">-- Seleziona --</option>
                              {flatCustomers.filter(c => c.id !== mergeSourceId).map(c => (
                                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.fiscal_code})</option>
                              ))}
                          </select>
                      </div>

                      <div className="flex justify-center">
                          <ArrowUpRight className="w-6 h-6 text-gray-300" />
                      </div>

                      <div>
                          <label className={`block text-xs font-bold uppercase mb-1 ${mergeMode === 'MERGE' ? 'text-red-600' : 'text-gray-500'}`}>
                              {mergeMode === 'LINK' ? 'Membro da aggiungere' : 'Duplicato da eliminare'}
                          </label>
                          <select 
                              className={`w-full p-3 border-2 rounded-lg focus:outline-none ${mergeMode === 'MERGE' ? 'border-red-100 bg-red-50 focus:border-red-500' : 'border-gray-200 focus:border-brand-accent'}`}
                              value={mergeSourceId}
                              onChange={(e) => setMergeSourceId(e.target.value)}
                          >
                              <option value="">-- Seleziona --</option>
                              {flatCustomers.filter(c => c.id !== mergeTargetId).map(c => (
                                  <option key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.fiscal_code})</option>
                              ))}
                          </select>
                      </div>

                      <div className="pt-4 flex justify-end gap-2 border-t mt-4">
                          <button onClick={() => setShowMergeModal(false)} className="px-4 py-2 text-gray-500 font-bold" disabled={actionLoading}>Annulla</button>
                          <button onClick={handleMerge} disabled={!mergeTargetId || !mergeSourceId || actionLoading} className={`px-4 py-2 text-white font-bold rounded flex items-center gap-2 shadow-lg disabled:opacity-50 ${mergeMode === 'MERGE' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-primary hover:bg-brand-dark'}`}>
                              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <GitMerge className="w-4 h-4"/>}
                              {mergeMode === 'LINK' ? 'Crea Famiglia' : 'Esegui Fusione'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* AMBIGUOUS & CONFLICT MODALS... (existing code) */}
      {/* ... (Keep existing modals) ... */}
      {ambiguousState && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-brand-primary p-5 text-white">
                  <h3 className="text-xl font-bold flex items-center gap-2"><AlertCircle className="w-6 h-6" /> Seleziona Immobile</h3>
              </div>
              <div className="p-6">
                  <div className="space-y-3 mb-6">
                      {ambiguousState.existingProperties.map(prop => (
                          <div key={prop.id} onClick={() => handlePropertySelection(prop.id)} className="p-3 border rounded-lg hover:border-brand-accent cursor-pointer">
                              <div className="font-bold">{prop.address}</div>
                              <div className="text-xs text-gray-500">{prop.city}</div>
                          </div>
                      ))}
                  </div>
                  <button onClick={() => handlePropertySelection('NEW')} className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-bold">+ Nuovo Immobile</button>
                  <button onClick={() => setAmbiguousState(null)} className="w-full mt-4 text-xs text-gray-400 underline">Annulla</button>
              </div>
           </div>
        </div>
      )}

      {conflictState && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border-2 border-orange-500">
              <div className="bg-orange-500 p-5 text-white">
                  <h3 className="text-xl font-bold flex items-center gap-2"><ArrowLeftRight className="w-6 h-6" /> Voltura / Subentro Rilevato</h3>
              </div>
              <div className="p-6">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                      <h4 className="text-xs font-bold text-orange-800 uppercase mb-2">Attuale Titolare:</h4>
                      <p className="font-bold text-gray-800 text-lg">{conflictState.conflictOwner.first_name} {conflictState.conflictOwner.last_name}</p>
                      <p className="text-sm text-gray-600 font-mono mb-2">{conflictState.conflictOwner.fiscal_code}</p>
                      <p className="text-xs text-gray-500">Immobile: {conflictState.conflictProperty.address}</p>
                  </div>
                  <button onClick={handleTransfer} className="w-full p-4 bg-brand-primary text-white rounded-lg font-bold flex items-center justify-between shadow-lg">
                      <span>Esegui Voltura al nuovo cliente</span><ArrowRight className="w-6 h-6" />
                  </button>
                  <button onClick={() => setConflictState(null)} className="w-full mt-4 text-xs text-gray-400 underline">Annulla e correggi dati</button>
              </div>
           </div>
        </div>
      )}
    </Container>
  );
};

export default ConsumerTab;
