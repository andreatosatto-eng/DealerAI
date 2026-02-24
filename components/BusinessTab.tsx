import React, { useState, useEffect } from 'react';
import { Customer, User, Property, ExtractedBill, PropertyType, PropertyStatus, Commodity } from '../types';
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
          alert("Subentro aziendale completato! Vecchia sede disattivata.");
      } catch (e) {
          alert("Errore nel trasferimento sede.");
      } finally {
          setIsUploading(false);
      }
  };

  const handleSaveProperty = async () => {
      if (!editingProperty) return;
      const { customer, property } = editingProperty;
      
      // MANUAL CONFLICT CHECK
      const manualPod = property.electricity?.code;
      const manualPdr = property.gas?.code;

      if ((manualPod && manualPod.length > 5) || (manualPdr && manualPdr.length > 5)) {
          // In Business Tab, we need to check ALL customers (Consumer + Business) for conflicts
          // Assuming 'customers' state only has companies, we might need a broader check.
          // For now, let's check against current loaded companies. In real app, API call is better.
          for (const c of customers) {
              if (c.id === customer.id) continue;
              const conflictProp = c.properties.find(p => 
                  p.status === 'ACTIVE' && (
                      (manualPod && p.electricity?.code === manualPod) || 
                      (manualPdr && p.gas?.code === manualPdr)
                  )
              );

              if (conflictProp) {
                  const dummyExtracted: ExtractedBill = {
                      commodity: manualPod ? Commodity.LUCE : Commodity.GAS,
                      pod_pdr: (manualPod || manualPdr)!,
                      consumption: 0, consumption_f1:0, consumption_f2:0, consumption_f3:0,
                      confidence_map: {},
                      client_name: customer.company_name,
                      fiscal_code: customer.fiscal_code,
                      address: property.address,
                      city: property.city
                  };

                  setConflictState({
                      extractedData: dummyExtracted,
                      conflictOwner: c,
                      conflictProperty: conflictProp
                  });
                  setEditingProperty(null); 
                  return;
              }
          }
      }

      let updatedProps = [...customer.properties];
      if (property.id) {
          updatedProps = updatedProps.map(p => p.id === property.id ? { ...p, ...property } as Property : p);
      } else {
          const newProp: Property = {
              id: `prop_${Date.now()}`,
              status: 'ACTIVE',
              address: property.address || '',
              city: property.city || '',
              is_resident: false, 
              property_type: property.property_type || 'OFFICE',
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
                                onClick={(e) => { e.stopPropagation(); setEditingProperty({ customer: cust, property: { status: 'ACTIVE', property_type: 'OFFICE' } }); }}
                                className="text-xs flex items-center gap-1 bg-white border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-100 text-brand-primary font-bold"
                            >
                                <Plus className="w-3 h-3" /> Aggiungi Sede
                            </button>
                        </div>
                        <div className="grid gap-2">
                            {cust.properties.map(prop => (
                                <div key={prop.id} className={`bg-white p-3 rounded border flex justify-between items-center ${prop.status === 'SOLD' || prop.status === 'INACTIVE' ? 'opacity-60 bg-gray-100 border-dashed' : ''}`}>
                                    <div className="flex flex-col gap-1 w-full mr-4">
                                        <div className="flex items-center gap-3">
                                            {prop.property_type === 'INDUSTRIAL' ? <Building2 className="w-5 h-5 text-gray-600" /> : <Briefcase className="w-5 h-5 text-blue-500" />}
                                            <div>
                                                <div className="font-bold text-sm">{prop.address}</div>
                                                <div className="text-xs text-gray-500">{prop.city} {prop.property_type && `(${prop.property_type})`}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 ml-8 mt-1">
                                            {prop.electricity && <span className="text-[10px] font-mono bg-yellow-100 text-yellow-800 px-1.5 rounded border border-yellow-200">POD: {prop.electricity.code}</span>}
                                            {prop.gas && <span className="text-[10px] font-mono bg-orange-100 text-orange-800 px-1.5 rounded border border-orange-200">PDR: {prop.gas.code}</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 items-center">
                                        {(prop.status === 'SOLD' || prop.status === 'INACTIVE') && <span className="text-[9px] bg-gray-200 px-1 rounded mr-2">STORICO</span>}
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

      {/* UPLOAD MODAL */}
      {showUploadModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-brand-primary p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <UploadCloud className="w-5 h-5" /> Carica Bolletta Aziendale
                      </h3>
                      <button onClick={() => setShowUploadModal(false)}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-8 text-center">
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-brand-accent transition-colors bg-gray-50 relative group mb-6">
                          <input type="file" multiple accept="image/*,application/pdf" onChange={handleFileSelection} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                          <div className="flex flex-col items-center gap-2 pointer-events-none">
                              <Camera className="w-10 h-10 text-gray-400 mb-2" />
                              <span className="text-gray-600 font-medium">Trascina file o clicca per caricare</span>
                          </div>
                      </div>

                      {selectedFiles.length > 0 && (
                          <div className="mb-6 text-left">
                              <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">File pronti:</h4>
                              <div className="space-y-2">
                                  {selectedFiles.map((f, i) => (
                                      <div key={i} className="flex justify-between items-center text-sm bg-gray-100 p-2 rounded">
                                          <span className="truncate">{f.name}</span>
                                          <button onClick={() => removeFile(i)} className="text-red-500"><X className="w-4 h-4"/></button>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}

                      <button 
                          disabled={selectedFiles.length === 0 || isUploading}
                          onClick={handleAnalyze}
                          className="w-full py-3 bg-brand-accent hover:bg-teal-500 text-brand-dark rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          {isUploading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Wand2 className="w-5 h-5"/>}
                          Analizza e Aggiungi Azienda
                      </button>
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
                          <GitMerge className="w-5 h-5" /> Unisci Aziende Duplicate
                      </h3>
                      <button onClick={() => setShowMergeModal(false)}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6">
                      <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm text-yellow-800 mb-4">
                          Attenzione: Questa operazione unirà due aziende in una sola. Tutte le sedi verranno spostate sull'azienda "Target".
                      </div>

                      <div className="space-y-4">
                          <div>
                              <label className="block text-xs font-bold text-green-700 uppercase mb-1">1. Azienda da MANTENERE (Target)</label>
                              <select 
                                  className="w-full p-2 border-2 border-green-100 rounded bg-green-50"
                                  value={mergeTargetId}
                                  onChange={e => setMergeTargetId(e.target.value)}
                              >
                                  <option value="">-- Seleziona --</option>
                                  {customers.map(c => (
                                      <option key={c.id} value={c.id}>{c.company_name} ({c.fiscal_code})</option>
                                  ))}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-red-700 uppercase mb-1">2. Azienda da ELIMINARE (Sorgente)</label>
                              <select 
                                  className="w-full p-2 border-2 border-red-100 rounded bg-red-50"
                                  value={mergeSourceId}
                                  onChange={e => setMergeSourceId(e.target.value)}
                              >
                                  <option value="">-- Seleziona --</option>
                                  {customers.filter(c => c.id !== mergeTargetId).map(c => (
                                      <option key={c.id} value={c.id}>{c.company_name} ({c.fiscal_code})</option>
                                  ))}
                              </select>
                          </div>
                      </div>

                      <div className="pt-6 flex justify-end gap-2">
                          <button onClick={() => setShowMergeModal(false)} className="px-4 py-2 text-gray-500 font-bold">Annulla</button>
                          <button 
                              disabled={!mergeTargetId || !mergeSourceId || loading}
                              onClick={handleMerge} 
                              className="px-4 py-2 bg-brand-primary text-white font-bold rounded flex items-center gap-2 shadow-lg disabled:opacity-50"
                          >
                              {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <GitMerge className="w-4 h-4"/>} 
                              Unisci Definitivamente
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
                  <h3 className="text-xl font-bold flex items-center gap-2">
                     <AlertCircle className="w-6 h-6 text-brand-highlight" />
                     Seleziona Sede Operativa
                  </h3>
                  <p className="text-sm text-gray-300 mt-1">
                      L'azienda esiste già, ma questo POD/PDR non è associato a nessuna sede conosciuta.
                  </p>
              </div>
              <div className="p-6">
                  <h4 className="font-bold text-gray-700 mb-3">Sedi esistenti:</h4>
                  <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                      {ambiguousState.existingProperties.map(prop => (
                          <div key={prop.id} onClick={() => handlePropertySelection(prop.id)} className="p-3 border rounded-lg hover:border-brand-accent hover:bg-teal-50 cursor-pointer transition-colors group">
                              <div className="flex items-center gap-3">
                                  <div className="bg-gray-100 p-2 rounded-full group-hover:bg-white"><Building2 className="w-5 h-5 text-gray-500 group-hover:text-brand-accent" /></div>
                                  <div>
                                      <div className="font-bold text-gray-800">{prop.address}</div>
                                      <div className="text-xs text-gray-500">{prop.city}</div>
                                  </div>
                              </div>
                          </div>
                      ))}
                      {ambiguousState.existingProperties.length === 0 && <div className="text-gray-400 italic text-sm text-center py-2">Nessuna sede registrata.</div>}
                  </div>
                  <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-gray-200"></div><span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OPPURE</span><div className="flex-grow border-t border-gray-200"></div>
                  </div>
                  <button onClick={() => handlePropertySelection('NEW')} className="w-full mt-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand-primary hover:bg-gray-50 text-gray-500 hover:text-brand-primary font-bold flex items-center justify-center gap-2 transition-all">
                      <Plus className="w-5 h-5" /> Crea Nuova Sede: {ambiguousState.extractedData.address || 'Da Bolletta'}
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* EDIT PROPERTY MODAL */}
      {editingProperty && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                  <div className="bg-brand-primary p-4 text-white flex justify-between items-center sticky top-0 z-10">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <Building2 className="w-5 h-5" />
                          {editingProperty.property.id ? 'Gestione Sede' : 'Nuova Sede'}
                      </h3>
                      <button onClick={() => setEditingProperty(null)}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2">
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipologia Sede</label>
                              <select 
                                  className="w-full p-2 border rounded"
                                  value={editingProperty.property.property_type || 'OFFICE'}
                                  onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, property_type: e.target.value as PropertyType}})}
                              >
                                  <option value="OFFICE">Ufficio / Studio / Negozio</option>
                                  <option value="INDUSTRIAL">Fabbricato Industriale / Capannone</option>
                                  <option value="RESIDENTIAL">Uso Promiscuo / Abitazione</option>
                                  <option value="ANNEX">Magazzino / Deposito</option>
                              </select>
                          </div>
                          <div className="col-span-2">
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Indirizzo Sede</label>
                              <input 
                                  className="w-full p-2 border rounded" 
                                  placeholder="Via Roma 1"
                                  value={editingProperty.property.address || ''} 
                                  onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, address: e.target.value}})} 
                              />
                          </div>
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
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">CAP</label>
                              <input 
                                  className="w-full p-2 border rounded" 
                                  placeholder="00000"
                                  value={editingProperty.property.zip_code || ''} 
                                  onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, zip_code: e.target.value}})} 
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stato Sede</label>
                              <select 
                                  className="w-full p-2 border rounded"
                                  value={editingProperty.property.status || 'ACTIVE'}
                                  onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, status: e.target.value as PropertyStatus}})}
                              >
                                  <option value="ACTIVE">Attiva</option>
                                  <option value="INACTIVE">Chiusa / Storico</option>
                                  <option value="SOLD">Trasferita / Voltura</option>
                              </select>
                          </div>
                      </div>

                      {/* Technical Section */}
                      <div className="border-t border-gray-200 pt-4">
                          <h4 className="text-sm font-bold text-gray-800 mb-3">Dati Tecnici Forniture</h4>
                          
                          <div className="bg-yellow-50 p-3 rounded border border-yellow-200 mb-3">
                              <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-bold text-yellow-800 flex items-center gap-1"><Zap className="w-3 h-3"/> Luce Business</span>
                                  <label className="flex items-center gap-1 text-xs">
                                      <input 
                                          type="checkbox" 
                                          checked={!!editingProperty.property.electricity}
                                          onChange={(e) => {
                                              if (e.target.checked) {
                                                  setEditingProperty({
                                                      ...editingProperty, 
                                                      property: { ...editingProperty.property, electricity: { code: '', supplier: '', status: 'ACTIVE', raw_material_cost: 0, fixed_fee_year: 0 } }
                                                  });
                                              } else {
                                                  setEditingProperty({
                                                      ...editingProperty, 
                                                      property: { ...editingProperty.property, electricity: undefined }
                                                  });
                                              }
                                          }}
                                      /> Abilita
                                  </label>
                              </div>
                              {editingProperty.property.electricity && (
                                  <div className="grid grid-cols-2 gap-2">
                                      <input 
                                          placeholder="POD (IT...)" 
                                          className="text-xs p-2 border rounded"
                                          value={editingProperty.property.electricity.code}
                                          onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, electricity: {...editingProperty.property.electricity!, code: e.target.value.toUpperCase()}}})}
                                      />
                                      <input 
                                          placeholder="Fornitore" 
                                          className="text-xs p-2 border rounded"
                                          value={editingProperty.property.electricity.supplier}
                                          onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, electricity: {...editingProperty.property.electricity!, supplier: e.target.value}}})}
                                      />
                                  </div>
                              )}
                          </div>

                          <div className="bg-orange-50 p-3 rounded border border-orange-200">
                              <div className="flex justify-between items-center mb-2">
                                  <span className="text-xs font-bold text-orange-800 flex items-center gap-1"><Flame className="w-3 h-3"/> Gas Business</span>
                                  <label className="flex items-center gap-1 text-xs">
                                      <input 
                                          type="checkbox" 
                                          checked={!!editingProperty.property.gas}
                                          onChange={(e) => {
                                              if (e.target.checked) {
                                                  setEditingProperty({
                                                      ...editingProperty, 
                                                      property: { ...editingProperty.property, gas: { code: '', supplier: '', status: 'ACTIVE', raw_material_cost: 0, fixed_fee_year: 0 } }
                                                  });
                                              } else {
                                                  setEditingProperty({
                                                      ...editingProperty, 
                                                      property: { ...editingProperty.property, gas: undefined }
                                                  });
                                              }
                                          }}
                                      /> Abilita
                                  </label>
                              </div>
                              {editingProperty.property.gas && (
                                  <div className="grid grid-cols-2 gap-2">
                                      <input 
                                          placeholder="PDR (Numerico)" 
                                          className="text-xs p-2 border rounded"
                                          value={editingProperty.property.gas.code}
                                          onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, gas: {...editingProperty.property.gas!, code: e.target.value}}})}
                                      />
                                      <input 
                                          placeholder="Fornitore" 
                                          className="text-xs p-2 border rounded"
                                          value={editingProperty.property.gas.supplier}
                                          onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, gas: {...editingProperty.property.gas!, supplier: e.target.value}}})}
                                      />
                                  </div>
                              )}
                          </div>
                      </div>

                      <div className="pt-4 flex justify-end gap-2 border-t sticky bottom-0 bg-white">
                          <button onClick={() => setEditingProperty(null)} className="px-4 py-2 text-gray-500 font-bold">Annulla</button>
                          <button onClick={handleSaveProperty} className="px-4 py-2 bg-brand-primary text-white font-bold rounded flex items-center gap-2">
                              <Save className="w-4 h-4"/> Salva Sede
                          </button>
                      </div>
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
                  <p className="text-sm text-gray-600 mb-4">Eseguire <strong>Subentro Aziendale</strong>? La vecchia sede verrà disattivata.</p>
                  
                  <button onClick={handleTransfer} className="w-full p-4 bg-brand-primary text-white rounded-lg font-bold flex items-center justify-between shadow-lg">
                      <span>Conferma Subentro</span><ArrowRight className="w-6 h-6" />
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