
import React, { useState, useEffect } from 'react';
import { Customer, User, Property, ExtractedBill } from '../types';
import * as API from '../services/mockApi';
import { Container } from './ui/Layouts';
import { Building2, Search, Zap, Flame, Home, UserCheck, Briefcase, Smartphone, Leaf, Car, Plus, X, UploadCloud, Loader2, AlertCircle, ArrowLeftRight, ArrowRight, Edit, Save, MapPin } from 'lucide-react';

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

  const handleBillUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsUploading(true);
      try {
        const file = e.target.files[0];
        const result = await API.analyze_bill(file, user);
        
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
        setSearch(result.customer_data!.fiscal_code);
        alert(`Analisi completata! Azienda: ${result.customer_data!.company_name}`);
      } catch (err) {
        console.error(err);
        alert("Errore durante l'analisi della bolletta.");
      } finally {
        setIsUploading(false);
        e.target.value = ''; 
      }
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

  const filtered = customers.filter(c => {
    const lowerSearch = search.toLowerCase();
    const nameMatch = c.company_name?.toLowerCase().includes(lowerSearch);
    const cfMatch = c.fiscal_code.toLowerCase().includes(lowerSearch);
    const podMatch = c.properties.some(p => p.electricity?.code?.toLowerCase().includes(lowerSearch) || p.gas?.code?.toLowerCase().includes(lowerSearch));
    return nameMatch || cfMatch || podMatch;
  });

  return (
    <Container>
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-brand-primary">Aziende Clienti</h2>
           <p className="text-sm text-gray-500">Gestione Business</p>
        </div>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="bg-brand-primary hover:bg-brand-dark text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5"
        >
            <Plus className="w-5 h-5" />
            <span className="hidden md:inline">Nuovo Cliente</span>
        </button>
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
                 <div className="flex items-start gap-4">
                    <div className="p-3 rounded-full bg-blue-100 text-blue-600"><Building2 className="w-6 h-6" /></div>
                    <div><h3 className="font-bold text-lg text-gray-800">{cust.company_name}</h3><div className="text-sm text-gray-500 font-mono">{cust.fiscal_code}</div></div>
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
                                    <button 
                                        onClick={() => setEditingProperty({ customer: cust, property: prop })}
                                        className="p-2 text-gray-400 hover:text-brand-primary hover:bg-gray-100 rounded self-start"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
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
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center bg-gray-50 relative group">
                        <input type="file" accept="image/*,application/pdf" onChange={handleBillUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className="flex flex-col items-center gap-2 pointer-events-none">
                            {isUploading ? <Loader2 className="w-10 h-10 text-brand-accent animate-spin" /> : <UploadCloud className="w-10 h-10 text-gray-400" />}
                            <span className="text-gray-600 font-medium">Trascina o Carica</span>
                        </div>
                    </div>
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
