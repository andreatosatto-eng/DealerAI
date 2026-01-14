
import React, { useState, useEffect } from 'react';
import { Customer, User, Segment, Opportunity, CommodityDetails, ExtractedBill, Property } from '../types';
import * as API from '../services/mockApi';
import { Container } from './ui/Layouts';
import { User as UserIcon, Building2, Search, MapPin, Calendar, Wallet, Zap, Flame, Home, Plus, X, UploadCloud, Loader2, ArrowUpRight, Edit, Save, Calculator, Wand2, History, TrendingDown, PiggyBank, AlertCircle, ArrowLeftRight, ArrowRight, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  user: User;
}

const CustomerTab: React.FC<Props> = ({ user }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedCustId, setExpandedCustId] = useState<string | null>(null);

  // Opportunity State
  const [opportunities, setOpportunities] = useState<Record<string, Opportunity[]>>({}); // Key: customerId

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
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<{ type: 'LUCE' | 'GAS', details: CommodityDetails } | null>(null);

  const fetchCustomers = () => {
    setLoading(true);
    API.get_customers(user.agency_id).then(async (data) => {
      setCustomers(data);
      setLoading(false);
      
      const newOpportunities: Record<string, Opportunity[]> = {};
      for(const c of data) {
          const ops = await API.findBestOpportunities(c);
          if (ops.length > 0) newOpportunities[c.id] = ops;
      }
      setOpportunities(newOpportunities);
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
        alert(`Analisi completata! Cliente: ${result.customer_data!.last_name || result.customer_data!.company_name}`);
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
          setSearch(customer.fiscal_code);
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
          setSearch(newCustomer.fiscal_code);
          alert("Voltura completata con successo!");
      } catch (e) {
          alert("Errore durante il trasferimento.");
      } finally {
          setIsUploading(false);
      }
  };

  const handleReverseCF = () => {
      if (!editingCustomer || !editingCustomer.fiscal_code) return;
      const details = API.parseFiscalCode(editingCustomer.fiscal_code);
      if (details) {
          setEditingCustomer({
              ...editingCustomer,
              birth_date: details.birth_date,
              gender: details.gender,
              birth_place: details.birth_place
          });
      } else {
          alert("Codice Fiscale non valido o non analizzabile.");
      }
  };

  const handleSaveCustomer = async () => {
      if (!editingCustomer) return;
      await API.update_customer(editingCustomer);
      setEditingCustomer(null);
      fetchCustomers();
  };

  const handleSaveProperty = async () => {
      if (!editingProperty) return;
      const { customer, property } = editingProperty;
      
      // Update property list
      let updatedProps = [...customer.properties];
      if (property.id) {
          // Edit existing
          updatedProps = updatedProps.map(p => p.id === property.id ? { ...p, ...property } as Property : p);
      } else {
          // Create new
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
      fetchCustomers();
  };

  const filtered = customers.filter(c => {
    const lowerSearch = search.toLowerCase();
    const nameMatch = c.last_name?.toLowerCase().includes(lowerSearch) || c.company_name?.toLowerCase().includes(lowerSearch);
    const cfMatch = c.fiscal_code.toLowerCase().includes(lowerSearch);
    const podMatch = c.properties.some(p => p.electricity?.code?.toLowerCase().includes(lowerSearch) || p.gas?.code?.toLowerCase().includes(lowerSearch));
    
    return nameMatch || cfMatch || podMatch;
  });

  return (
    <Container>
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-brand-primary">Portafoglio Clienti</h2>
           <p className="text-sm text-gray-500">Agenzia: {user.agency_id === 'ag_mt' ? 'MT Technology HQ' : 'Partner Agency'}</p>
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
             placeholder="Cerca Nome, CF, POD (Luce) o PDR (Gas)..." 
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-accent"
           />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Caricamento anagrafica...</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
           {filtered.length === 0 && (
             <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">
                Nessun cliente trovato. <br/>
                Clicca su "Nuovo Cliente" per caricare una bolletta.
             </div>
           )}

           {filtered.map(cust => {
             const custOpportunities = opportunities[cust.id] || [];
             const hasSavings = custOpportunities.length > 0;

             return (
             <div key={cust.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-all">
               <div 
                 className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer"
                 onClick={() => setExpandedCustId(expandedCustId === cust.id ? null : cust.id)}
               >
                 <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-full relative ${cust.type === 'COMPANY' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                       {cust.type === 'COMPANY' ? <Building2 className="w-6 h-6" /> : <UserIcon className="w-6 h-6" />}
                       {hasSavings && <span className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-brand-accent"></span></span>}
                    </div>
                    <div>
                       <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                          {cust.type === 'COMPANY' ? cust.company_name : `${cust.first_name} ${cust.last_name}`}
                       </h3>
                       <div className="text-sm text-gray-500 font-mono mb-1">{cust.fiscal_code}</div>
                       <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                          <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-500 flex items-center gap-1">
                             <Home className="w-3 h-3" /> {cust.properties.filter(p => p.status === 'ACTIVE').length} Attivi
                          </span>
                       </div>
                    </div>
                 </div>

                 <div className="flex flex-row md:flex-col gap-4 md:gap-2 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 items-end">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                       <Calendar className="w-4 h-4 text-brand-accent" />
                       <span>Ultimo agg: {cust.last_bill_date ? new Date(cust.last_bill_date).toLocaleDateString() : 'Mai'}</span>
                    </div>
                 </div>
               </div>

               {/* Expanded Properties Section */}
               {expandedCustId === cust.id && (
                 <div className="bg-gray-50 border-t border-gray-100 p-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                            <MapPin className="w-4 h-4" /> Abitazioni & Forniture
                        </h4>
                        <div className="flex gap-2">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setEditingProperty({ customer: cust, property: { status: 'ACTIVE' } }); }}
                                className="text-xs flex items-center gap-1 bg-white border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-100 text-brand-primary font-bold"
                            >
                                <Plus className="w-3 h-3" /> Aggiungi Immobile
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setEditingCustomer(cust); }}
                                className="text-xs flex items-center gap-1 bg-white border border-gray-200 px-3 py-1 rounded-lg hover:bg-gray-100 text-gray-600 font-bold"
                            >
                                <Edit className="w-3 h-3" /> Anagrafica
                            </button>
                        </div>
                    </div>
                    
                    <div className="grid gap-3">
                        {cust.properties.map(prop => {
                            if (prop.status === 'SOLD' || prop.status === 'OBSOLETE') return null; // Or show them faded
                            const elecOp = custOpportunities.find(o => o.property_id === prop.id && o.commodity === 'luce');
                            const gasOp = custOpportunities.find(o => o.property_id === prop.id && o.commodity === 'gas');

                            return (
                            <div key={prop.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm relative group">
                                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => setEditingProperty({ customer: cust, property: prop })}
                                        className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                                        title="Modifica Immobile"
                                    >
                                        <Edit className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="mb-4 pb-2 border-b border-gray-100">
                                     <div className="font-bold text-gray-800 flex items-center gap-2 text-lg">
                                        {prop.address}, {prop.city}
                                        {prop.is_resident ? 
                                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold border border-green-200">RESIDENTE</span> : 
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold border border-gray-200">NON RESIDENTE</span>
                                        }
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        {prop.electricity && <span className="text-[10px] font-mono bg-yellow-100 text-yellow-800 px-1.5 rounded border border-yellow-200">POD: {prop.electricity.code}</span>}
                                        {prop.gas && <span className="text-[10px] font-mono bg-orange-100 text-orange-800 px-1.5 rounded border border-orange-200">PDR: {prop.gas.code}</span>}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Electricity Section */}
                                    {prop.electricity ? (
                                        <div 
                                            onClick={() => setSelectedHistory({ type: 'LUCE', details: prop.electricity! })}
                                            className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 relative overflow-hidden group/card cursor-pointer hover:border-yellow-400 transition-colors"
                                        >
                                            <Zap className="absolute top-2 right-2 w-12 h-12 text-yellow-500/10" />
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-yellow-700 font-bold">
                                                    <Zap className="w-4 h-4" /> ENERGIA ELETTRICA
                                                </div>
                                                {elecOp && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setSelectedOpportunity(elecOp); }}
                                                        className="bg-brand-success text-white text-[10px] font-bold px-2 py-1 rounded shadow animate-pulse hover:animate-none flex items-center gap-1 z-10 hover:scale-105 transition-transform"
                                                    >
                                                        <ArrowUpRight className="w-3 h-3" />
                                                        Risparmia {elecOp.estimated_savings}€
                                                    </button>
                                                )}
                                            </div>
                                            <div className="space-y-1 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 text-xs">Fornitore</span>
                                                    <span className="font-bold text-gray-800">{prop.electricity.supplier}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 text-xs">POD</span>
                                                    <span className="font-mono text-xs">{prop.electricity.code}</span>
                                                </div>
                                                <div className="flex justify-between pt-2 mt-2 border-t border-yellow-200">
                                                    <div>
                                                        <span className="text-[10px] uppercase text-gray-400 font-bold">Materia Prima</span>
                                                        <div className="font-bold text-gray-700">{prop.electricity.raw_material_cost} €/kWh</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] uppercase text-gray-400 font-bold">Consumo Anno</span>
                                                        <div className="font-bold text-gray-700">{prop.electricity.annual_consumption?.toFixed(0)} kWh</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border border-dashed border-gray-200 rounded-lg p-3 flex items-center justify-center text-gray-400 text-sm italic">
                                            Dati Luce non presenti
                                        </div>
                                    )}

                                    {/* Gas Section */}
                                    {prop.gas ? (
                                        <div 
                                            onClick={() => setSelectedHistory({ type: 'GAS', details: prop.gas! })}
                                            className="bg-orange-50 rounded-lg p-3 border border-orange-200 relative overflow-hidden group/card cursor-pointer hover:border-orange-400 transition-colors"
                                        >
                                            <Flame className="absolute top-2 right-2 w-12 h-12 text-orange-500/10" />
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2 text-orange-700 font-bold">
                                                    <Flame className="w-4 h-4" /> GAS NATURALE
                                                </div>
                                                {gasOp && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setSelectedOpportunity(gasOp); }}
                                                        className="bg-brand-success text-white text-[10px] font-bold px-2 py-1 rounded shadow animate-pulse hover:animate-none flex items-center gap-1 z-10 hover:scale-105 transition-transform"
                                                    >
                                                        <ArrowUpRight className="w-3 h-3" />
                                                        Risparmia {gasOp.estimated_savings}€
                                                    </button>
                                                )}
                                            </div>
                                            <div className="space-y-1 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 text-xs">Fornitore</span>
                                                    <span className="font-bold text-gray-800">{prop.gas.supplier}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500 text-xs">PDR</span>
                                                    <span className="font-mono text-xs">{prop.gas.code}</span>
                                                </div>
                                                <div className="flex justify-between pt-2 mt-2 border-t border-orange-200">
                                                    <div>
                                                        <span className="text-[10px] uppercase text-gray-400 font-bold">Materia Prima</span>
                                                        <div className="font-bold text-gray-700">{prop.gas.raw_material_cost} €/Smc</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[10px] uppercase text-gray-400 font-bold">Consumo Anno</span>
                                                        <div className="font-bold text-gray-700">{prop.gas.annual_consumption?.toFixed(0)} Smc</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border border-dashed border-gray-200 rounded-lg p-3 flex items-center justify-center text-gray-400 text-sm italic">
                                            Dati Gas non presenti
                                        </div>
                                    )}
                                </div>
                            </div>
                        )})}
                    </div>
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
                    <h3 className="font-bold text-lg">Nuovo Cliente da Bolletta</h3>
                    <button onClick={() => setShowUploadModal(false)}><X className="w-5 h-5" /></button>
                </div>
                
                <div className="p-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-brand-accent transition-colors bg-gray-50 relative group">
                        <input 
                            type="file" 
                            accept="image/*,application/pdf"
                            onChange={handleBillUpload}
                            disabled={isUploading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="flex flex-col items-center gap-2 pointer-events-none">
                            {isUploading ? (
                                <>
                                    <Loader2 className="w-10 h-10 text-brand-accent animate-spin mb-2" />
                                    <span className="text-gray-600 font-bold">Analisi AI in corso...</span>
                                </>
                            ) : (
                                <>
                                    <UploadCloud className="w-10 h-10 text-gray-400 mb-2" />
                                    <span className="text-gray-600 font-medium">Clicca per caricare PDF o Foto</span>
                                </>
                            )}
                        </div>
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
                     Seleziona Immobile
                  </h3>
                  <p className="text-sm text-gray-300 mt-1">
                      Il cliente esiste già, ma questo POD/PDR non è associato a nessuna proprietà conosciuta.
                  </p>
              </div>
              <div className="p-6">
                  <h4 className="font-bold text-gray-700 mb-3 text-sm uppercase">Immobili esistenti del cliente:</h4>
                  <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                      {ambiguousState.existingProperties.map(prop => (
                          <div key={prop.id} onClick={() => handlePropertySelection(prop.id)} className="p-3 border rounded-lg hover:border-brand-accent hover:bg-teal-50 cursor-pointer transition-colors group">
                              <div className="flex items-center gap-3">
                                  <Home className="w-5 h-5 text-gray-400 group-hover:text-brand-accent" />
                                  <div>
                                      <div className="font-bold text-gray-800">{prop.address}</div>
                                      <div className="text-xs text-gray-500">{prop.city}</div>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
                  <button onClick={() => handlePropertySelection('NEW')} className="w-full mt-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand-primary hover:bg-gray-50 text-gray-500 hover:text-brand-primary font-bold flex items-center justify-center gap-2 transition-all">
                      <Plus className="w-5 h-5" /> Crea Nuovo Immobile: {ambiguousState.extractedData.address || 'Da Bolletta'}
                  </button>
                  <button onClick={() => setAmbiguousState(null)} className="w-full mt-4 text-xs text-gray-400 underline">Annulla</button>
              </div>
           </div>
        </div>
      )}

      {/* CONFLICT MODAL */}
      {conflictState && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border-2 border-orange-500">
              <div className="bg-orange-500 p-5 text-white">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                     <ArrowLeftRight className="w-6 h-6" />
                     Conflitto Fornitura Rilevato
                  </h3>
                  <p className="text-sm text-white/90 mt-1 font-medium">
                      Il contatore rilevato è attualmente associato ad un altro cliente!
                  </p>
              </div>
              
              <div className="p-6">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                      <h4 className="text-xs font-bold text-orange-800 uppercase mb-2">Titolare Rilevato nel CRM:</h4>
                      <p className="font-bold text-gray-800 text-lg">
                          {conflictState.conflictOwner.type === 'COMPANY' ? conflictState.conflictOwner.company_name : `${conflictState.conflictOwner.first_name} ${conflictState.conflictOwner.last_name}`}
                      </p>
                      <p className="text-sm text-gray-600 font-mono mb-2">{conflictState.conflictOwner.fiscal_code}</p>
                      <p className="text-xs text-gray-500">Immobile: {conflictState.conflictProperty.address}, {conflictState.conflictProperty.city}</p>
                  </div>
                  
                  <h4 className="font-bold text-gray-700 mb-4 text-center">Vuoi procedere con la Voltura/Subentro?</h4>

                  <button 
                     onClick={handleTransfer}
                     className="w-full mb-3 p-4 bg-brand-primary hover:bg-brand-dark text-white rounded-lg font-bold flex items-center justify-between shadow-lg group"
                  >
                      <div className="text-left">
                          <div className="text-sm text-brand-accent group-hover:text-white transition-colors">Conferma Voltura</div>
                          <div className="text-xs opacity-75">Sposta contatore al nuovo cliente</div>
                      </div>
                      <ArrowRight className="w-6 h-6" />
                  </button>
                  
                  <button 
                     onClick={() => setConflictState(null)}
                     className="w-full mt-4 py-3 text-gray-500 hover:text-gray-700 font-bold underline text-sm"
                  >
                      Annulla e correggi dati
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-brand-primary p-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <Edit className="w-5 h-5" />
                        <h3 className="font-bold text-lg">Modifica Anagrafica</h3>
                    </div>
                    <button onClick={() => setEditingCustomer(null)}><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo Cliente</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2">
                                <input type="radio" checked={editingCustomer.type === 'PERSON'} onChange={() => setEditingCustomer({...editingCustomer, type: 'PERSON'})} />
                                Privato
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="radio" checked={editingCustomer.type === 'COMPANY'} onChange={() => setEditingCustomer({...editingCustomer, type: 'COMPANY'})} />
                                Azienda
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome / Ragione Sociale</label>
                        <input 
                            type="text" 
                            className="w-full p-2 border rounded" 
                            value={editingCustomer.type === 'COMPANY' ? editingCustomer.company_name : editingCustomer.first_name}
                            onChange={(e) => editingCustomer.type === 'COMPANY' ? setEditingCustomer({...editingCustomer, company_name: e.target.value}) : setEditingCustomer({...editingCustomer, first_name: e.target.value})}
                        />
                    </div>
                    {editingCustomer.type === 'PERSON' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cognome</label>
                            <input 
                                type="text" 
                                className="w-full p-2 border rounded" 
                                value={editingCustomer.last_name}
                                onChange={(e) => setEditingCustomer({...editingCustomer, last_name: e.target.value})}
                            />
                        </div>
                    )}

                    <div className="col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Codice Fiscale / P.IVA</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                className="w-full p-2 border rounded font-mono" 
                                value={editingCustomer.fiscal_code}
                                onChange={(e) => setEditingCustomer({...editingCustomer, fiscal_code: e.target.value.toUpperCase()})}
                            />
                            {editingCustomer.type === 'PERSON' && (
                                <button 
                                    onClick={handleReverseCF}
                                    className="bg-brand-accent hover:bg-teal-500 text-brand-dark px-3 rounded flex items-center gap-1 text-sm font-bold whitespace-nowrap"
                                >
                                    <Wand2 className="w-4 h-4" /> Estrai Dati
                                </button>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data di Nascita</label>
                        <input type="date" className="w-full p-2 border rounded" value={editingCustomer.birth_date || ''} onChange={(e) => setEditingCustomer({...editingCustomer, birth_date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Luogo di Nascita</label>
                        <input type="text" className="w-full p-2 border rounded" value={editingCustomer.birth_place || ''} onChange={(e) => setEditingCustomer({...editingCustomer, birth_place: e.target.value})} />
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
                    <button onClick={() => setEditingCustomer(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded">Annulla</button>
                    <button onClick={handleSaveCustomer} className="px-4 py-2 bg-brand-primary text-white font-medium rounded hover:bg-brand-dark flex items-center gap-2">
                        <Save className="w-4 h-4" /> Salva Modifiche
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
                      
                      {editingProperty.customer.type === 'PERSON' && (
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
                      )}

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

      {/* Opportunity Modal */}
      {selectedOpportunity && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-brand-success p-6 text-white text-center">
                      <PiggyBank className="w-16 h-16 mx-auto mb-2 text-white/90" />
                      <h3 className="text-2xl font-black">Risparmio Trovato!</h3>
                      <p className="font-medium opacity-90">Miglior offerta rilevata nel Canvas</p>
                  </div>
                  <div className="p-6">
                      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                           <div>
                               <div className="text-xs text-gray-500 uppercase font-bold">Risparmio Stimato</div>
                               <div className="text-3xl font-bold text-brand-success">
                                   {selectedOpportunity.estimated_savings} € <span className="text-sm font-normal text-gray-400">/ anno</span>
                               </div>
                           </div>
                           <TrendingDown className="w-10 h-10 text-brand-success" />
                      </div>
                      <div className="space-y-4 text-sm">
                          <div className="flex justify-between border-b pb-2"><span>Miglior Offerta</span><span className="font-bold">{selectedOpportunity.better_cte.offer_name}</span></div>
                          <div className="flex justify-between border-b pb-2"><span>Fornitore</span><span className="font-bold">{selectedOpportunity.better_cte.supplier_name}</span></div>
                          <div className="bg-blue-50 p-3 rounded text-xs text-blue-700">{selectedOpportunity.calculation_basis}</div>
                      </div>
                      <button onClick={() => setSelectedOpportunity(null)} className="w-full mt-6 py-3 bg-brand-primary text-white font-bold rounded-lg">Chiudi</button>
                  </div>
              </div>
          </div>
      )}

      {/* History Modal */}
      {selectedHistory && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className={`p-4 flex justify-between items-center text-white ${selectedHistory.type === 'LUCE' ? 'bg-yellow-500' : 'bg-orange-500'}`}>
                      <div className="flex items-center gap-2">
                          <History className="w-6 h-6" />
                          <h3 className="font-bold text-lg">Storico Consumi & Costi</h3>
                      </div>
                      <button onClick={() => setSelectedHistory(null)}><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-6">
                      <div className="h-64 w-full bg-gray-50 rounded-lg mb-6 border border-gray-100 p-2">
                          <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={selectedHistory.details.history || []}>
                                  <XAxis dataKey="date" tick={{fontSize: 10}} />
                                  <YAxis yAxisId="left" />
                                  <YAxis yAxisId="right" orientation="right" />
                                  <Tooltip />
                                  <Line yAxisId="left" type="monotone" dataKey="consumption" stroke="#8884d8" name="Consumo" />
                                  <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#82ca9d" name="Costo (€)" />
                              </LineChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </Container>
  );
};

export default CustomerTab;
