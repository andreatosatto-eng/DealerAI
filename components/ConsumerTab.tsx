
import React, { useState, useEffect } from 'react';
import { Customer, User, Property, ExtractedBill, ConnectivityDetails, PropertyType, PropertyStatus } from '../types';
import * as API from '../services/mockApi';
import { Container } from './ui/Layouts';
import { 
    Users, Search, MapPin, Zap, Flame, Home, Plus, X, Loader2, Edit, Save, Trash2, 
    Router, Smartphone, AlertCircle, ArrowLeftRight, ArrowRight, Camera, FileText, 
    Wand2, GitMerge, User as UserIcon, CheckCircle2, ArrowDown, LogOut, Split, Move, UploadCloud
} from 'lucide-react';

interface Props {
  user: User;
}

// Helper interface for the new view structure
interface BuildingGroup {
    addressKey: string;
    primaryProperty: Property; // The source of truth for technical data
    primaryOwner: Customer; // The actual owner of the primaryProperty record
    residents: Customer[]; // People linked to this address
    owners: string[]; // Names of people who have this property in their list
}

const ConsumerTab: React.FC<Props> = ({ user }) => {
  const [families, setFamilies] = useState<Record<string, Customer[]>>({});
  const [flatCustomers, setFlatCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedFamilyId, setExpandedFamilyId] = useState<string | null>(null);

  // --- MODAL STATES ---
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  
  // Building Merge State
  const [showBuildingMergeModal, setShowBuildingMergeModal] = useState(false);
  const [mergeBuildingTargetKey, setMergeBuildingTargetKey] = useState<string>('');
  const [mergeBuildingSourceKey, setMergeBuildingSourceKey] = useState<string>('');
  const [currentFamilyForMerge, setCurrentFamilyForMerge] = useState<string | null>(null);

  // Person Move State
  const [movePersonState, setMovePersonState] = useState<{
      member: Customer;
      currentAddressKey: string;
      familyId: string;
  } | null>(null);

  // Editing States
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingProperty, setEditingProperty] = useState<{ customer: Customer, property: Partial<Property> } | null>(null);
  
  // Upload/Conflict Logic
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [ambiguousState, setAmbiguousState] = useState<{
      extractedData: ExtractedBill;
      existingCustomerId: string;
      existingProperties: Property[];
  } | null>(null);
  const [conflictState, setConflictState] = useState<{
      extractedData: ExtractedBill;
      conflictOwner: Customer;
      conflictProperty: Property;
  } | null>(null);

  // Merge Logic (People)
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [mergeSourceId, setMergeSourceId] = useState<string>('');

  const fetchFamilies = () => {
    setLoading(true);
    API.get_families(user.agency_id)
        .then(async (data) => {
            setFamilies(data);
            const flat: Customer[] = [];
            Object.values(data).forEach(arr => flat.push(...arr));
            setFlatCustomers(flat);
        })
        .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFamilies();
  }, [user.agency_id]);

  // --- DATA TRANSFORMATION FOR UI ---
  const getAddressKey = (addr: string) => addr.toLowerCase().trim().replace(/\s+/g, ' ');

  const organizeFamilyBuildings = (members: Customer[]): BuildingGroup[] => {
      const buildings: Record<string, BuildingGroup> = {};

      members.forEach(member => {
          member.properties.forEach(prop => {
              // Normalize Address to group same physical location
              const key = getAddressKey(prop.address);
              
              // Ensure property type has a default
              if (!prop.property_type) prop.property_type = 'RESIDENTIAL';

              if (!buildings[key]) {
                  buildings[key] = {
                      addressKey: key,
                      primaryProperty: prop,
                      primaryOwner: member,
                      residents: [],
                      owners: []
                  };
              }

              // Logic to select the "Best" property representation (most complete data)
              const current = buildings[key].primaryProperty;
              const score = (p: Property) => (p.electricity ? 2 : 0) + (p.gas ? 2 : 0) + (p.connectivity ? 1 : 0) + (p.status === 'ACTIVE' ? 0.5 : 0);
              
              if (score(prop) > score(current)) {
                  buildings[key].primaryProperty = prop;
                  buildings[key].primaryOwner = member;
              }

              buildings[key].owners.push(member.first_name || member.fiscal_code);
              
              // Add member to residents ONLY if they are resident in THIS specific property
              // This fixes the issue of the client appearing in both houses
              if (prop.is_resident) {
                  if (!buildings[key].residents.find(r => r.id === member.id)) {
                      buildings[key].residents.push(member);
                  }
              }
          });
      });

      return Object.values(buildings);
  };

  // --- HANDLERS ---

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)]);
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

        await fetchFamilies();
        setShowUploadModal(false);
        setSelectedFiles([]);
        alert("Analisi completata con successo!");
    } catch (err) {
        alert("Errore analisi.");
    } finally {
        setIsUploading(false);
    }
  };

  const handleSaveProperty = async () => {
      if (!editingProperty) return;
      const { customer, property } = editingProperty;
      
      let updatedProps = [...customer.properties];
      
      // LOGIC: If setting as resident, unset resident for all other properties of this customer
      if (property.is_resident) {
          updatedProps = updatedProps.map(p => ({
              ...p,
              is_resident: false
          }));
      }

      if (property.id) {
          // Update existing
          updatedProps = updatedProps.map(p => p.id === property.id ? { ...p, ...property } as Property : p);
      } else {
          // Add new
          const newProp: Property = {
              id: `prop_${Date.now()}`,
              status: 'ACTIVE',
              address: property.address || '',
              city: property.city || '',
              is_resident: property.is_resident || false,
              property_type: property.property_type || 'RESIDENTIAL',
              ...property
          } as Property;
          updatedProps.push(newProp);
      }

      await API.update_customer({ ...customer, properties: updatedProps });
      setEditingProperty(null);
      fetchFamilies();
  };

  const handleSaveCustomer = async () => {
      if (!editingCustomer) return;
      await API.update_customer(editingCustomer);
      setEditingCustomer(null);
      fetchFamilies();
  };

  const handleDeleteCustomer = async (id: string) => {
      if(confirm("Eliminare definitivamente questo cliente?")) {
          await API.delete_customer(id);
          fetchFamilies();
      }
  };

  const handleDeleteProperty = async (custId: string, propId: string) => {
      if(confirm("Rimuovere questa abitazione dal cliente?")) {
          await API.delete_property(custId, propId);
          fetchFamilies();
      }
  };

  const handleMergePeople = async () => {
      if (!mergeTargetId || !mergeSourceId) return;
      if (mergeTargetId === mergeSourceId) { alert("Seleziona due persone diverse"); return; }
      
      if(confirm("Unire le due anagrafiche? L'operazione è irreversibile.")) {
          setLoading(true);
          try {
              await API.merge_customers(mergeTargetId, mergeSourceId);
              setShowMergeModal(false);
              fetchFamilies();
          } catch(e) { alert("Errore merge"); }
          finally { setLoading(false); }
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
      } catch (e) {
          alert("Errore nel salvataggio.");
      } finally {
          setIsUploading(false);
      }
  };

  // --- MOVE PERSON HANDLER ---
  const handleMovePerson = async (targetType: 'EXISTING_HOUSE' | 'NEW_FAMILY', targetAddressKey?: string) => {
      if (!movePersonState) return;
      const { member, currentAddressKey } = movePersonState;

      setLoading(true);
      try {
          // 1. Remove Current Property from Member
          let updatedProps = member.properties.filter(p => getAddressKey(p.address) !== currentAddressKey);

          if (targetType === 'EXISTING_HOUSE' && targetAddressKey) {
              // 2A. Move to Existing House in same family
              const familyMembers = families[movePersonState.familyId];
              let targetTemplate: Property | null = null;
              
              for (const m of familyMembers) {
                  const p = m.properties.find(p => getAddressKey(p.address) === targetAddressKey);
                  if (p) { targetTemplate = p; break; }
              }

              if (targetTemplate) {
                  const newPropForMember: Property = {
                      ...targetTemplate,
                      id: `prop_${Date.now()}`, // New ID for this member's instance
                      is_resident: true // Assume resident if moving there, can be changed later
                  };
                  updatedProps.push(newPropForMember);
                  
                  await API.update_customer({ ...member, properties: updatedProps });
                  alert(`Spostamento completato in ${targetTemplate.address}.`);
              }

          } else {
              // 2B. Move to New Independent Family
              const newProp: Property = {
                  id: `prop_${Date.now()}`,
                  status: 'ACTIVE',
                  address: 'Nuova Abitazione',
                  city: 'Da Configurare',
                  property_type: 'RESIDENTIAL',
                  is_resident: true
              };
              updatedProps.push(newProp);

              await API.update_customer({ 
                  ...member, 
                  properties: updatedProps,
                  family_id: member.id, // Breaks link with old family
                  is_family_head: true 
              });
              alert("Nuovo nucleo famigliare creato con successo.");
          }

          setMovePersonState(null);
          await fetchFamilies();

      } catch (e) {
          console.error(e);
          alert("Errore durante lo spostamento.");
      } finally {
          setLoading(false);
      }
  };

  // --- BUILDING MERGE HANDLER ---
  const handleMergeBuildings = async () => {
      if (!currentFamilyForMerge || !mergeBuildingTargetKey || !mergeBuildingSourceKey) return;
      if (mergeBuildingTargetKey === mergeBuildingSourceKey) {
          alert("Seleziona due indirizzi diversi.");
          return;
      }

      const members = families[currentFamilyForMerge];
      if (!members) return;

      setLoading(true);
      try {
          // Find the "Target" building details from the first occurrence in the family
          let targetTemplate: Property | null = null;
          for (const m of members) {
              const p = m.properties.find(p => getAddressKey(p.address) === mergeBuildingTargetKey);
              if (p) { targetTemplate = p; break; }
          }

          if (!targetTemplate) throw new Error("Target building not found");

          // Iterate all members and consolidate
          const updates = members.map(async (member) => {
              const sourceProps = member.properties.filter(p => getAddressKey(p.address) === mergeBuildingSourceKey);
              if (sourceProps.length === 0) return; // No changes for this person

              let newProps = [...member.properties];
              
              // Find if member already has the target building
              const existingTarget = newProps.find(p => getAddressKey(p.address) === mergeBuildingTargetKey);

              if (existingTarget) {
                  // MERGE: Move data from Source to Target, then delete Source
                  sourceProps.forEach(sp => {
                      // Consolidate Energy
                      if (!existingTarget.electricity && sp.electricity) existingTarget.electricity = sp.electricity;
                      if (!existingTarget.gas && sp.gas) existingTarget.gas = sp.gas;
                      // Consolidate Connectivity
                      if (!existingTarget.connectivity && sp.connectivity) existingTarget.connectivity = sp.connectivity;
                      // Consolidate Resident Flag (OR logic)
                      existingTarget.is_resident = existingTarget.is_resident || sp.is_resident;
                  });
                  // Remove source properties
                  newProps = newProps.filter(p => getAddressKey(p.address) !== mergeBuildingSourceKey);
              } else {
                  // RENAME: Member only had the bad address, so we just update it to match the good one
                  sourceProps.forEach(sp => {
                      sp.address = targetTemplate!.address;
                      sp.city = targetTemplate!.city;
                      sp.zip_code = targetTemplate!.zip_code;
                      // Keep technical data attached to this property
                  });
              }

              // Save member
              await API.update_customer({ ...member, properties: newProps });
          });

          await Promise.all(updates);
          
          alert("Unione immobili completata.");
          setShowBuildingMergeModal(false);
          setMergeBuildingTargetKey('');
          setMergeBuildingSourceKey('');
          fetchFamilies();

      } catch (e) {
          console.error(e);
          alert("Errore durante l'unione degli immobili.");
      } finally {
          setLoading(false);
      }
  };

  // --- RENDER ---

  const filteredFamilies = (Object.entries(families) as [string, Customer[]][]).filter(([_, members]) => {
      const txt = search.toLowerCase();
      return members.some(m => 
          m.last_name?.toLowerCase().includes(txt) || 
          m.fiscal_code.toLowerCase().includes(txt) ||
          m.properties.some(p => p.address.toLowerCase().includes(txt))
      );
  });

  return (
    <Container>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div>
           <h2 className="text-2xl font-bold text-brand-primary">Nuclei Famigliari & Abitazioni</h2>
           <p className="text-sm text-gray-500">Gestione Consumer</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setShowMergeModal(true)}
                className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm"
            >
                <GitMerge className="w-5 h-5" />
                <span className="hidden md:inline">Unisci Persone</span>
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
             placeholder="Cerca per cognome, indirizzo o CF..." 
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-accent"
           />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Caricamento famiglie...</div>
      ) : (
        <div className="space-y-6">
           {filteredFamilies.map(([familyKey, members]) => {
             const head = members.find(m => m.is_family_head) || members[0];
             const buildings = organizeFamilyBuildings(members);
             const familyName = `Famiglia ${head.last_name}`;
             const isExpanded = expandedFamilyId === familyKey;

             return (
             <div key={familyKey} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
               
               {/* FAMILY HEADER */}
               <div className="p-6 cursor-pointer bg-white" onClick={() => setExpandedFamilyId(isExpanded ? null : familyKey)}>
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-teal-50 p-3 rounded-full text-teal-700 border border-teal-100">
                            <Users className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-xl text-gray-800">{familyName}</h3>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-bold">{members.length} Componenti</span>
                                <span>•</span>
                                <span>{buildings.length} Abitazioni</span>
                            </div>
                        </div>
                    </div>
                    {/* Toolbar */}
                    <div className="flex gap-2">
                        {isExpanded && buildings.length > 1 && (
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setCurrentFamilyForMerge(familyKey); 
                                    setShowBuildingMergeModal(true); 
                                }}
                                className="text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1"
                            >
                                <GitMerge className="w-3 h-3"/> Unisci Abitazioni
                            </button>
                        )}
                        <button 
                            onClick={(e) => { e.stopPropagation(); setEditingCustomer({ 
                                id: '', agency_id: user.agency_id, fiscal_code: '', type: 'PERSON', family_id: familyKey, properties: [] 
                            } as Customer); }}
                            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3"/> Aggiungi Persona
                        </button>
                    </div>
                 </div>
               </div>

               {/* EXPANDED VIEW: BUILDINGS & RESIDENTS */}
               {isExpanded && (
                   <div className="bg-slate-50 border-t border-gray-200 p-6 space-y-6">
                       
                       {/* BUILDINGS LOOP */}
                       {buildings.map((bg, idx) => (
                           <div key={bg.addressKey} className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden relative">
                               
                               {/* Building Header */}
                               <div className="bg-slate-100 p-4 border-b border-gray-200 flex justify-between items-start">
                                   <div className="flex items-start gap-3">
                                       <Home className="w-6 h-6 text-brand-primary mt-1" />
                                       <div>
                                           <h4 className="font-bold text-lg text-brand-primary">{bg.primaryProperty.address}</h4>
                                           <div className="text-sm text-gray-500">{bg.primaryProperty.city} • {bg.primaryProperty.zip_code || 'CAP N/D'}</div>
                                           <div className="mt-1 flex gap-2">
                                               {bg.primaryProperty.property_type && <span className="text-[10px] uppercase font-bold bg-white border px-2 py-0.5 rounded text-gray-600">{bg.primaryProperty.property_type === 'RESIDENTIAL' ? 'ABITAZIONE' : bg.primaryProperty.property_type}</span>}
                                               {bg.primaryProperty.status !== 'ACTIVE' && <span className="text-[10px] uppercase font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded">NON ATTIVA</span>}
                                           </div>
                                       </div>
                                   </div>
                                   <button 
                                        onClick={() => setEditingProperty({ customer: bg.primaryOwner, property: bg.primaryProperty })}
                                        className="text-brand-primary hover:bg-white p-2 rounded transition-colors" title="Modifica Abitazione"
                                   >
                                       <Edit className="w-4 h-4"/>
                                   </button>
                               </div>

                               <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6">
                                   
                                   {/* COL 1: ABITANTI (Residents) */}
                                   <div className="col-span-1 border-r border-gray-100 pr-4">
                                       <h5 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-1"><Users className="w-3 h-3"/> Abitanti del nucleo</h5>
                                       <div className="space-y-3">
                                           {bg.residents.map(res => (
                                               <div key={res.id} className="flex items-center justify-between group">
                                                   <div className="flex items-center gap-2">
                                                       <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                                           {res.first_name?.charAt(0)}
                                                       </div>
                                                       <div>
                                                           <div className="font-bold text-sm text-gray-700">{res.first_name} {res.last_name}</div>
                                                           <div className="text-[10px] text-gray-400 font-mono">{res.fiscal_code}</div>
                                                       </div>
                                                   </div>
                                                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                       {/* MOVE BUTTON */}
                                                       <button 
                                                            onClick={() => setMovePersonState({ member: res, currentAddressKey: bg.addressKey, familyId: familyKey })} 
                                                            className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded"
                                                            title="Sposta Persona / Cambio Casa"
                                                       >
                                                           <ArrowRight className="w-3 h-3"/>
                                                       </button>
                                                       <button onClick={() => setEditingCustomer(res)} className="p-1 text-gray-400 hover:text-blue-500"><Edit className="w-3 h-3"/></button>
                                                       <button onClick={() => handleDeleteCustomer(res.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                                                   </div>
                                               </div>
                                           ))}
                                           {bg.residents.length === 0 && <div className="text-sm italic text-gray-400">Nessun residente registrato.</div>}
                                       </div>
                                   </div>

                                   {/* COL 2: ENERGY (Luce & Gas) */}
                                   <div className="col-span-1 border-r border-gray-100 pr-4">
                                       <h5 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-1"><Zap className="w-3 h-3"/> Forniture Energia</h5>
                                       <div className="space-y-3">
                                           {/* Electricity */}
                                           <div className={`p-3 rounded-lg border ${bg.primaryProperty.electricity ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100 border-dashed'}`}>
                                               {bg.primaryProperty.electricity ? (
                                                   <div>
                                                       <div className="flex justify-between mb-1">
                                                           <span className="font-bold text-yellow-800 text-xs flex items-center gap-1"><Zap className="w-3 h-3"/> LUCE</span>
                                                           <span className="text-[10px] font-mono text-gray-500">{bg.primaryProperty.electricity.code}</span>
                                                       </div>
                                                       <div className="text-sm font-bold text-gray-800">{bg.primaryProperty.electricity.supplier}</div>
                                                       <div className="text-xs text-gray-500 mt-1">Consumo: {bg.primaryProperty.electricity.annual_consumption} kWh</div>
                                                   </div>
                                               ) : (
                                                   <div className="text-center text-xs text-gray-400 py-2">Nessun contatore Luce</div>
                                               )}
                                           </div>

                                           {/* Gas */}
                                           <div className={`p-3 rounded-lg border ${bg.primaryProperty.gas ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-100 border-dashed'}`}>
                                               {bg.primaryProperty.gas ? (
                                                   <div>
                                                       <div className="flex justify-between mb-1">
                                                           <span className="font-bold text-orange-800 text-xs flex items-center gap-1"><Flame className="w-3 h-3"/> GAS</span>
                                                           <span className="text-[10px] font-mono text-gray-500">{bg.primaryProperty.gas.code}</span>
                                                       </div>
                                                       <div className="text-sm font-bold text-gray-800">{bg.primaryProperty.gas.supplier}</div>
                                                       <div className="text-xs text-gray-500 mt-1">Consumo: {bg.primaryProperty.gas.annual_consumption} Smc</div>
                                                   </div>
                                               ) : (
                                                   <div className="text-center text-xs text-gray-400 py-2">Nessun contatore Gas</div>
                                               )}
                                           </div>
                                       </div>
                                   </div>

                                   {/* COL 3: CONNECTIVITY (Fixed Line) */}
                                   <div className="col-span-1">
                                       <h5 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-1"><Router className="w-3 h-3"/> Linea Fissa / Internet</h5>
                                       
                                       <div className={`p-3 rounded-lg border h-full ${bg.primaryProperty.connectivity ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100 border-dashed'}`}>
                                            {bg.primaryProperty.connectivity ? (
                                                <div className="h-full flex flex-col justify-between">
                                                    <div>
                                                        <div className="flex justify-between mb-2">
                                                            <span className="font-bold text-indigo-800 text-xs">{bg.primaryProperty.connectivity.technology}</span>
                                                            <span className="bg-white px-2 py-0.5 rounded text-[10px] border border-indigo-100 font-bold text-indigo-600">{bg.primaryProperty.connectivity.status}</span>
                                                        </div>
                                                        <div className="text-lg font-bold text-gray-800">{bg.primaryProperty.connectivity.provider}</div>
                                                        <div className="text-xs text-gray-500 mt-1 font-mono">
                                                            {bg.primaryProperty.connectivity.phone_number || 'Nessun numero'}
                                                        </div>
                                                    </div>
                                                    <div className="mt-3 pt-3 border-t border-indigo-100 flex justify-between items-center">
                                                        <div className="text-xs text-gray-500">Canone</div>
                                                        <div className="font-bold text-indigo-700">{bg.primaryProperty.connectivity.monthly_cost.toFixed(2)} €</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                                                    <Router className="w-8 h-8 opacity-20" />
                                                    <span className="text-xs">Nessuna linea fissa</span>
                                                    <button 
                                                        onClick={() => setEditingProperty({ customer: bg.residents[0], property: { ...bg.primaryProperty, connectivity: { provider: '', status: 'ACTIVE', technology: 'FTTH', monthly_cost: 0 } } })}
                                                        className="text-[10px] text-brand-primary underline hover:text-brand-dark"
                                                    >
                                                        + Aggiungi Linea
                                                    </button>
                                                </div>
                                            )}
                                       </div>
                                   </div>

                               </div>
                           </div>
                       ))}

                       {/* Button to add new Building to this Family */}
                       <div className="text-center">
                           <button 
                                onClick={() => setEditingProperty({ customer: head, property: { status: 'ACTIVE', property_type: 'RESIDENTIAL' } })}
                                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-primary border border-dashed border-gray-300 hover:border-brand-primary px-4 py-2 rounded-lg transition-colors"
                           >
                               <Plus className="w-4 h-4"/> Aggiungi un'altra abitazione a questo nucleo
                           </button>
                       </div>

                   </div>
               )}
             </div>
             );
           })}
        </div>
      )}

      {/* --- MOVE PERSON MODAL --- */}
      {movePersonState && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-brand-primary p-4 text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <ArrowRight className="w-5 h-5" /> Sposta Persona
                    </h3>
                    <button onClick={() => setMovePersonState(null)}><X className="w-5 h-5"/></button>
                </div>
                <div className="p-6">
                    <p className="mb-4 text-gray-600">
                        Dove vuoi spostare <strong>{movePersonState.member.first_name} {movePersonState.member.last_name}</strong>?
                    </p>
                    
                    <div className="space-y-3">
                        <button 
                            onClick={() => handleMovePerson('NEW_FAMILY')}
                            className="w-full p-4 border rounded-lg hover:bg-gray-50 flex items-center gap-3 transition-colors text-left group"
                        >
                            <div className="bg-green-100 p-2 rounded-full text-green-600 group-hover:bg-green-200"><Plus className="w-5 h-5"/></div>
                            <div>
                                <div className="font-bold text-gray-800">Nuovo Nucleo Famigliare</div>
                                <div className="text-xs text-gray-500">Crea una nuova famiglia indipendente</div>
                            </div>
                        </button>

                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-gray-200"></div><span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OPPURE IN ALTRA ABITAZIONE</span><div className="flex-grow border-t border-gray-200"></div>
                        </div>

                        {families[movePersonState.familyId]?.map(m => m.properties).flat().reduce((acc: Property[], curr) => {
                             if (!acc.find(p => getAddressKey(p.address) === getAddressKey(curr.address)) && getAddressKey(curr.address) !== movePersonState.currentAddressKey) {
                                 acc.push(curr);
                             }
                             return acc;
                        }, []).map(prop => (
                            <button 
                                key={prop.id}
                                onClick={() => handleMovePerson('EXISTING_HOUSE', getAddressKey(prop.address))}
                                className="w-full p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-200 flex items-center gap-3 transition-colors text-left"
                            >
                                <div className="bg-gray-100 p-2 rounded-full text-gray-500"><Home className="w-4 h-4"/></div>
                                <div className="text-sm font-bold text-gray-700">{prop.address}, {prop.city}</div>
                            </button>
                        ))}
                        
                        {/* Fallback if no other houses */}
                        {families[movePersonState.familyId]?.map(m => m.properties).flat().filter(p => getAddressKey(p.address) !== movePersonState.currentAddressKey).length === 0 && (
                            <div className="text-center text-xs text-gray-400 italic py-2">Nessuna altra abitazione disponibile in questo nucleo.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- BUILDING MERGE MODAL --- */}
      {showBuildingMergeModal && currentFamilyForMerge && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-orange-600 p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <GitMerge className="w-5 h-5" /> Unisci Abitazioni Duplicate
                      </h3>
                      <button onClick={() => setShowBuildingMergeModal(false)}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6">
                      <p className="text-sm text-gray-600 mb-4">
                          Seleziona l'indirizzo CORRETTO (Target) e quello ERRATO (Sorgente). 
                          Tutti i dati tecnici (POD, PDR) verranno spostati sul Target e l'indirizzo errato verrà rimosso.
                      </p>

                      <div className="grid grid-cols-2 gap-4 mb-6">
                          <div>
                              <label className="block text-xs font-bold text-green-700 uppercase mb-1">1. Tieni questo (Target)</label>
                              <select 
                                  className="w-full p-2 border-2 border-green-100 rounded bg-green-50 focus:border-green-500 outline-none"
                                  value={mergeBuildingTargetKey}
                                  onChange={e => setMergeBuildingTargetKey(e.target.value)}
                              >
                                  <option value="">-- Seleziona --</option>
                                  {organizeFamilyBuildings(families[currentFamilyForMerge]).map(b => (
                                      <option key={b.addressKey} value={b.addressKey}>{b.primaryProperty.address}</option>
                                  ))}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-red-700 uppercase mb-1">2. Unisci questo (Sorgente)</label>
                              <select 
                                  className="w-full p-2 border-2 border-red-100 rounded bg-red-50 focus:border-red-500 outline-none"
                                  value={mergeBuildingSourceKey}
                                  onChange={e => setMergeBuildingSourceKey(e.target.value)}
                              >
                                  <option value="">-- Seleziona --</option>
                                  {organizeFamilyBuildings(families[currentFamilyForMerge])
                                      .filter(b => b.addressKey !== mergeBuildingTargetKey)
                                      .map(b => (
                                      <option key={b.addressKey} value={b.addressKey}>{b.primaryProperty.address}</option>
                                  ))}
                              </select>
                          </div>
                      </div>

                      <div className="flex justify-end gap-2">
                          <button onClick={() => setShowBuildingMergeModal(false)} className="px-4 py-2 text-gray-500 font-bold">Annulla</button>
                          <button 
                              disabled={!mergeBuildingTargetKey || !mergeBuildingSourceKey || loading}
                              onClick={handleMergeBuildings} 
                              className="px-4 py-2 bg-orange-600 text-white font-bold rounded flex items-center gap-2 shadow-lg disabled:opacity-50"
                          >
                              {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <GitMerge className="w-4 h-4"/>} 
                              Unisci e Correggi
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- UPLOAD MODAL --- */}
      {showUploadModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-brand-primary p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <UploadCloud className="w-5 h-5" /> Carica Bolletta / Documento
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
                          Analizza e Aggiungi
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* --- EDIT PROPERTY MODAL --- */}
      {editingProperty && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                  <div className="bg-brand-primary p-4 text-white flex justify-between items-center sticky top-0 z-10">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <Home className="w-5 h-5" />
                          {editingProperty.property.id ? 'Modifica Abitazione' : 'Nuova Abitazione'}
                      </h3>
                      <button onClick={() => setEditingProperty(null)}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      
                      {/* ADDRESS SECTION */}
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="grid grid-cols-1 gap-3">
                              <div className="grid grid-cols-2 gap-3 mb-2">
                                  <div className="col-span-2">
                                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipologia</label>
                                      <select 
                                          className="w-full p-2 border rounded"
                                          value={editingProperty.property.property_type || 'RESIDENTIAL'}
                                          onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, property_type: e.target.value as PropertyType}})}
                                      >
                                          <option value="RESIDENTIAL">Abitazione Principale / Secondaria</option>
                                          <option value="OFFICE">Ufficio / Studio</option>
                                          <option value="ANNEX">Pertinenza / Garage</option>
                                          <option value="OTHER">Altro</option>
                                      </select>
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Indirizzo</label>
                                  <input 
                                      className="w-full p-2 border rounded" 
                                      placeholder="Via Roma 1"
                                      value={editingProperty.property.address || ''} 
                                      onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, address: e.target.value}})} 
                                  />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
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
                                          onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, status: e.target.value as PropertyStatus}})}
                                      >
                                          <option value="ACTIVE">Attiva</option>
                                          <option value="SOLD">Venduto/Trasferito</option>
                                          <option value="OBSOLETE">Obsoleto</option>
                                      </select>
                                  </div>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                  <input 
                                      type="checkbox" 
                                      id="is_resident"
                                      checked={editingProperty.property.is_resident || false}
                                      onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, is_resident: e.target.checked}})}
                                      className="w-4 h-4 text-brand-accent rounded"
                                  />
                                  <label htmlFor="is_resident" className="text-sm font-bold text-gray-700">Residenza Anagrafica</label>
                              </div>
                              {editingProperty.property.is_resident && (
                                  <div className="text-[10px] text-blue-600 italic bg-blue-50 p-1 rounded">
                                      Nota: Selezionando questa opzione, verranno deselezionate le altre abitazioni di {editingProperty.customer.first_name}.
                                  </div>
                              )}
                          </div>
                      </div>

                      {/* UTILITIES SECTION (Unchanged) */}
                      <div>
                          <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Forniture Attive</h4>
                          {/* Electricity */}
                          <div className="mb-3 border rounded-lg overflow-hidden">
                              <div className="bg-yellow-50 p-2 border-b border-yellow-100 flex justify-between items-center">
                                  <span className="text-xs font-bold text-yellow-800 flex items-center gap-1"><Zap className="w-3 h-3"/> Luce</span>
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
                                  <div className="p-3 bg-white grid grid-cols-2 gap-2">
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

                          {/* Gas */}
                          <div className="mb-3 border rounded-lg overflow-hidden">
                              <div className="bg-orange-50 p-2 border-b border-orange-100 flex justify-between items-center">
                                  <span className="text-xs font-bold text-orange-800 flex items-center gap-1"><Flame className="w-3 h-3"/> Gas</span>
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
                                  <div className="p-3 bg-white grid grid-cols-2 gap-2">
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

                          {/* Connectivity */}
                          <div className="border rounded-lg overflow-hidden">
                              <div className="bg-indigo-50 p-2 border-b border-indigo-100 flex justify-between items-center">
                                  <span className="text-xs font-bold text-indigo-800 flex items-center gap-1"><Router className="w-3 h-3"/> Internet/Fisso</span>
                                  <label className="flex items-center gap-1 text-xs">
                                      <input 
                                          type="checkbox" 
                                          checked={!!editingProperty.property.connectivity}
                                          onChange={(e) => {
                                              if (e.target.checked) {
                                                  setEditingProperty({
                                                      ...editingProperty, 
                                                      property: { ...editingProperty.property, connectivity: { provider: '', technology: 'FTTH', status: 'ACTIVE', monthly_cost: 0 } }
                                                  });
                                              } else {
                                                  setEditingProperty({
                                                      ...editingProperty, 
                                                      property: { ...editingProperty.property, connectivity: undefined }
                                                  });
                                              }
                                          }}
                                      /> Abilita
                                  </label>
                              </div>
                              {editingProperty.property.connectivity && (
                                  <div className="p-3 bg-white grid grid-cols-2 gap-2">
                                      <input 
                                          placeholder="Gestore (es. TIM)" 
                                          className="text-xs p-2 border rounded"
                                          value={editingProperty.property.connectivity.provider}
                                          onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, connectivity: {...editingProperty.property.connectivity!, provider: e.target.value}}})}
                                      />
                                      <select
                                          className="text-xs p-2 border rounded"
                                          value={editingProperty.property.connectivity.technology}
                                          onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, connectivity: {...editingProperty.property.connectivity!, technology: e.target.value as any}}})}
                                      >
                                          <option value="FTTH">FTTH (Fibra Pura)</option>
                                          <option value="FTTC">FTTC (Misto Rame)</option>
                                          <option value="FWA">FWA (Radio)</option>
                                          <option value="ADSL">ADSL (Vecchio Rame)</option>
                                      </select>
                                      <div className="col-span-2 flex items-center gap-2 border rounded p-2">
                                          <span className="text-xs text-gray-500">Costo Mensile €</span>
                                          <input 
                                              type="number"
                                              className="text-xs outline-none w-full font-bold"
                                              value={editingProperty.property.connectivity.monthly_cost}
                                              onChange={e => setEditingProperty({...editingProperty, property: {...editingProperty.property, connectivity: {...editingProperty.property.connectivity!, monthly_cost: parseFloat(e.target.value) || 0}}})}
                                          />
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>

                      <div className="pt-4 flex justify-end gap-2 border-t sticky bottom-0 bg-white">
                          <button onClick={() => setEditingProperty(null)} className="px-4 py-2 text-gray-500 font-bold">Annulla</button>
                          <button onClick={handleSaveProperty} className="px-4 py-2 bg-brand-primary text-white font-bold rounded flex items-center gap-2 shadow-lg">
                              <Save className="w-4 h-4"/> Salva Modifiche
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- EDIT CUSTOMER MODAL (Simple) --- */}
      {editingCustomer && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-brand-primary p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <UserIcon className="w-5 h-5" /> {editingCustomer.id ? 'Modifica Persona' : 'Nuova Persona'}
                      </h3>
                      <button onClick={() => setEditingCustomer(null)}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome</label>
                              <input 
                                  className="w-full p-2 border rounded" 
                                  value={editingCustomer.first_name || ''} 
                                  onChange={e => setEditingCustomer({...editingCustomer, first_name: e.target.value})} 
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cognome</label>
                              <input 
                                  className="w-full p-2 border rounded" 
                                  value={editingCustomer.last_name || ''} 
                                  onChange={e => setEditingCustomer({...editingCustomer, last_name: e.target.value})} 
                              />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Codice Fiscale</label>
                          <input 
                              className="w-full p-2 border rounded font-mono uppercase" 
                              value={editingCustomer.fiscal_code || ''} 
                              onChange={e => setEditingCustomer({...editingCustomer, fiscal_code: e.target.value.toUpperCase()})} 
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                              <input 
                                  className="w-full p-2 border rounded" 
                                  value={editingCustomer.email || ''} 
                                  onChange={e => setEditingCustomer({...editingCustomer, email: e.target.value})} 
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefono</label>
                              <input 
                                  className="w-full p-2 border rounded" 
                                  value={editingCustomer.phone || ''} 
                                  onChange={e => setEditingCustomer({...editingCustomer, phone: e.target.value})} 
                              />
                          </div>
                      </div>

                      <div className="pt-4 flex justify-end gap-2 border-t">
                          <button onClick={() => setEditingCustomer(null)} className="px-4 py-2 text-gray-500 font-bold">Annulla</button>
                          <button onClick={handleSaveCustomer} className="px-4 py-2 bg-brand-primary text-white font-bold rounded flex items-center gap-2 shadow-lg">
                              <Save className="w-4 h-4"/> Salva
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- MERGE PEOPLE MODAL --- */}
      {showMergeModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-brand-primary p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <GitMerge className="w-5 h-5" /> Unisci Anagrafiche Duplicate
                      </h3>
                      <button onClick={() => setShowMergeModal(false)}><X className="w-5 h-5"/></button>
                  </div>
                  <div className="p-6">
                      <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-sm text-yellow-800 mb-4">
                          Attenzione: Questa operazione unirà due persone in una sola. Tutte le proprietà e i veicoli verranno spostati sulla persona "Target".
                      </div>

                      <div className="space-y-4">
                          <div>
                              <label className="block text-xs font-bold text-green-700 uppercase mb-1">1. Persona da MANTENERE (Target)</label>
                              <select 
                                  className="w-full p-2 border-2 border-green-100 rounded bg-green-50"
                                  value={mergeTargetId}
                                  onChange={e => setMergeTargetId(e.target.value)}
                              >
                                  <option value="">-- Seleziona --</option>
                                  {flatCustomers.map(c => (
                                      <option key={c.id} value={c.id}>{c.last_name} {c.first_name} ({c.fiscal_code})</option>
                                  ))}
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-red-700 uppercase mb-1">2. Persona da ELIMINARE (Sorgente)</label>
                              <select 
                                  className="w-full p-2 border-2 border-red-100 rounded bg-red-50"
                                  value={mergeSourceId}
                                  onChange={e => setMergeSourceId(e.target.value)}
                              >
                                  <option value="">-- Seleziona --</option>
                                  {flatCustomers.filter(c => c.id !== mergeTargetId).map(c => (
                                      <option key={c.id} value={c.id}>{c.last_name} {c.first_name} ({c.fiscal_code})</option>
                                  ))}
                              </select>
                          </div>
                      </div>

                      <div className="pt-6 flex justify-end gap-2">
                          <button onClick={() => setShowMergeModal(false)} className="px-4 py-2 text-gray-500 font-bold">Annulla</button>
                          <button 
                              disabled={!mergeTargetId || !mergeSourceId || loading}
                              onClick={handleMergePeople} 
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
      
      {/* --- AMBIGUOUS PROPERTY MODAL --- */}
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
                  <h4 className="font-bold text-gray-700 mb-3">Immobili esistenti del cliente:</h4>
                  <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
                      {ambiguousState.existingProperties.map(prop => (
                          <div key={prop.id} onClick={() => handlePropertySelection(prop.id)} className="p-3 border rounded-lg hover:border-brand-accent hover:bg-teal-50 cursor-pointer transition-colors group">
                              <div className="flex items-center gap-3">
                                  <div className="bg-gray-100 p-2 rounded-full group-hover:bg-white"><Home className="w-5 h-5 text-gray-500 group-hover:text-brand-accent" /></div>
                                  <div>
                                      <div className="font-bold text-gray-800">{prop.address}</div>
                                      <div className="text-xs text-gray-500">{prop.city}</div>
                                  </div>
                              </div>
                          </div>
                      ))}
                      {ambiguousState.existingProperties.length === 0 && <div className="text-gray-400 italic text-sm text-center py-2">Nessun immobile registrato.</div>}
                  </div>
                  <div className="relative flex py-2 items-center">
                      <div className="flex-grow border-t border-gray-200"></div><span className="flex-shrink-0 mx-4 text-gray-400 text-xs">OPPURE</span><div className="flex-grow border-t border-gray-200"></div>
                  </div>
                  <button onClick={() => handlePropertySelection('NEW')} className="w-full mt-2 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-brand-primary hover:bg-gray-50 text-gray-500 hover:text-brand-primary font-bold flex items-center justify-center gap-2 transition-all">
                      <Plus className="w-5 h-5" /> Crea Nuovo Immobile: {ambiguousState.extractedData.address || 'Da Bolletta'}
                  </button>
              </div>
           </div>
        </div>
      )}

    </Container>
  );
};

export default ConsumerTab;
