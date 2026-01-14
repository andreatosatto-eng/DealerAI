
import React, { useState, useEffect } from 'react';
import { Customer, User, Opportunity, CommodityDetails, ExtractedBill, Property } from '../types';
import * as API from '../services/mockApi';
import { Container } from './ui/Layouts';
import { User as UserIcon, Building2, Search, MapPin, Calendar, Zap, Flame, Home, Plus, X, UploadCloud, Loader2, ArrowUpRight, Edit, Save, Trash2, Users, History, PiggyBank, TrendingDown, Settings, Smartphone, Leaf, Car, AlertCircle, ArrowLeftRight, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  user: User;
}

const ConsumerTab: React.FC<Props> = ({ user }) => {
  const [families, setFamilies] = useState<Record<string, Customer[]>>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);

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
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingProperty, setEditingProperty] = useState<{ customer: Customer, property: Partial<Property> } | null>(null); // NEW

  const fetchFamilies = () => {
    setLoading(true);
    API.get_families(user.agency_id).then(async (data) => {
        setFamilies(data);
        setLoading(false);
    });
  };

  useEffect(() => {
    fetchFamilies();
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
        await fetchFamilies();
        setShowUploadModal(false);
        const name = result.customer_data!.last_name || result.customer_data!.company_name;
        alert(`Analisi completata! Cliente ${name} aggiornato/creato.`);
        setSearch(name || '');
      } catch (err) {
        console.error(err);
        alert("Errore durante l'analisi del documento.");
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
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-brand-primary">Nuclei Famigliari</h2>
           <p className="text-sm text-gray-500">Gestione Consumer</p>
        </div>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="bg-brand-primary hover:bg-brand-dark text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5"
        >
            <Plus className="w-5 h-5" />
            <span className="hidden md:inline">Nuovo</span>
        </button>
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
                           <div key={member.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                               <div className="flex justify-between items-start mb-4 border-b pb-2">
                                   <div className="flex items-center gap-2">
                                       <UserIcon className="w-4 h-4 text-gray-400" />
                                       <span className="font-bold text-gray-800">{member.first_name} {member.last_name}</span>
                                       <span className="text-xs text-gray-400 font-mono ml-2">{member.fiscal_code}</span>
                                   </div>
                                   <div className="flex gap-2">
                                      <button 
                                          className="text-xs text-brand-primary font-bold hover:underline flex items-center gap-1"
                                          onClick={() => setEditingProperty({ customer: member, property: { status: 'ACTIVE' } })}
                                      >
                                          <Plus className="w-3 h-3"/> Casa
                                      </button>
                                      <button className="text-xs text-blue-600 font-bold hover:underline" onClick={() => setEditingCustomer({...member})}>Edit</button>
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
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100">
                                                <Edit className="w-3 h-3 text-gray-500 hover:text-brand-primary" />
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

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-brand-primary p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg">Carica Documento</h3>
                    <button onClick={() => setShowUploadModal(false)}><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-brand-accent transition-colors bg-gray-50 relative group">
                        <input type="file" accept="image/*,application/pdf" onChange={handleBillUpload} disabled={isUploading} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className="flex flex-col items-center gap-2 pointer-events-none">
                            {isUploading ? <Loader2 className="w-10 h-10 text-brand-accent animate-spin" /> : <UploadCloud className="w-10 h-10 text-gray-400" />}
                            <span className="text-gray-600 font-medium">Bolletta o Carta d'Identità</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-brand-primary p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold text-lg">Modifica Persona</h3>
                    <button onClick={() => setEditingCustomer(null)}><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
                        <input className="w-full p-2 border rounded" value={editingCustomer.first_name} onChange={e => setEditingCustomer({...editingCustomer, first_name: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cognome</label>
                        <input className="w-full p-2 border rounded" value={editingCustomer.last_name} onChange={e => setEditingCustomer({...editingCustomer, last_name: e.target.value})} />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Codice Fiscale</label>
                        <input className="w-full p-2 border rounded font-mono bg-gray-50" readOnly value={editingCustomer.fiscal_code} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefono</label>
                        <input className="w-full p-2 border rounded" value={editingCustomer.phone || ''} onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                        <input className="w-full p-2 border rounded" value={editingCustomer.email || ''} onChange={e => setEditingCustomer({...editingCustomer, email: e.target.value})} />
                    </div>
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
                    <button onClick={() => setEditingCustomer(null)} className="px-4 py-2 text-gray-600 font-bold">Annulla</button>
                    <button onClick={handleSaveCustomer} className="px-4 py-2 bg-brand-primary text-white font-bold rounded">Salva Modifiche</button>
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
                          <Home className="w-5 h-5" />
                          {editingProperty.property.id ? 'Modifica Immobile' : 'Nuovo Immobile'}
                      </h3>
                      <button onClick={() => setEditingProperty(null)}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Indirizzo</label>
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
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stato</label>
                              <select 
                                  className="w-full p-2 border rounded"
                                  value={editingProperty.property.status || 'ACTIVE'}
                                  onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, status: e.target.value as any}})}
                              >
                                  <option value="ACTIVE">Attivo</option>
                                  <option value="SOLD">Venduto/Trasferito</option>
                                  <option value="OBSOLETE">Obsoleto</option>
                              </select>
                          </div>
                      </div>
                      
                      <div className="flex items-center gap-2 bg-gray-50 p-3 rounded border border-gray-200">
                          <input 
                              type="checkbox" 
                              id="is_resident"
                              checked={editingProperty.property.is_resident || false}
                              onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, is_resident: e.target.checked}})}
                              className="w-4 h-4 text-brand-accent rounded"
                          />
                          <label htmlFor="is_resident" className="text-sm font-bold text-gray-700">Residenza Anagrafica</label>
                      </div>

                      <div className="pt-4 flex justify-end gap-2 border-t">
                          <button onClick={() => setEditingProperty(null)} className="px-4 py-2 text-gray-500 font-bold">Annulla</button>
                          <button onClick={handleSaveProperty} className="px-4 py-2 bg-brand-primary text-white font-bold rounded flex items-center gap-2">
                              <Save className="w-4 h-4"/> Salva Immobile
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* AMBIGUOUS & CONFLICT MODALS (Same as before) */}
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
                  <button onClick={() => setConflictState(null)} className="w-full mt-4 text-xs text-gray-400 underline">Annulla</button>
              </div>
           </div>
        </div>
      )}
    </Container>
  );
};

export default ConsumerTab;
