
import React, { useState, useEffect } from 'react';
import { Camera, FileText, Upload, AlertCircle, CheckCircle, XCircle, ArrowRight, Download, RefreshCw, CheckSquare, Square, ChevronDown, User as UserIcon, Building2, MapPin, Plus, Home, ArrowLeftRight, Loader2, X } from 'lucide-react';
import { Segment, ExtractedBill, CTE, IndicesResponse, ComparisonResult, OfferType, User, Customer, Property } from '../types';
import * as API from '../services/mockApi';
import { Container, Section } from './ui/Layouts';

interface Props {
  indices: IndicesResponse | null;
  user: User;
}

const AnalysisTab: React.FC<Props> = ({ indices, user }) => {
  const [step, setStep] = useState<number>(1);
  const [segment, setSegment] = useState<Segment | ''>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Selection State
  const [availableCtes, setAvailableCtes] = useState<CTE[]>([]);
  const [selectedCteIds, setSelectedCteIds] = useState<string[]>([]);
  const [activeSupplierTab, setActiveSupplierTab] = useState<string>('');
  
  // Analysis State
  const [extractedData, setExtractedData] = useState<ExtractedBill | null>(null);
  const [identifiedCustomer, setIdentifiedCustomer] = useState<Customer | null>(null); // New CRM State
  const [comparisons, setComparisons] = useState<ComparisonResult[]>([]);
  const [calculationMode, setCalculationMode] = useState<'MONO' | 'BIO' | 'TRI'>('MONO');
  const [activeResultTab, setActiveResultTab] = useState<string>(''); 

  // Modal States
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

  // Manual Override for Consumption
  const [manualConsumption, setManualConsumption] = useState<{f1: number, f2: number, f3: number}>({f1:0, f2:0, f3:0});

  // Fetch CTEs when segment changes
  useEffect(() => {
    if (segment) {
      setError(null);
      setAvailableCtes([]);
      setSelectedCteIds([]);
      setActiveSupplierTab('');
      
      API.list_cte(user, segment).then(({ items }) => {
        const now = new Date();
        const validItems = items.filter(cte => new Date(cte.valid_until) >= now);
        
        if (validItems.length > 0) {
          setAvailableCtes(validItems);
          const firstSupplier = validItems[0].supplier_name;
          setActiveSupplierTab(firstSupplier);
        } else {
          setError("Nessuna CTE valida disponibile per questo segmento (o per la tua agenzia).");
        }
      });
    }
  }, [segment, user]);

  // Re-calculate when mode or consumption changes
  useEffect(() => {
    if (step === 3 && extractedData && selectedCteIds.length > 0 && indices) {
        recalculateComparisons();
    }
  }, [calculationMode, manualConsumption]);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const newFiles = Array.from(e.target.files);
        setSelectedFiles(prev => [...prev, ...newFiles]);
        setError(null);
    }
  };

  const removeFile = (index: number) => {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toggleCteSelection = (id: string) => {
    setSelectedCteIds(prev => 
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

  const startAnalysis = async () => {
    if (!segment || selectedFiles.length === 0 || selectedCteIds.length === 0 || !indices) return;
    
    setLoading(true);
    setStep(2); 
    
    try {
      const result = await API.analyze_bill(selectedFiles, user);
      
      if (result.status === 'AMBIGUOUS_PROPERTY') {
          setAmbiguousState({
              extractedData: result.extracted_data,
              existingCustomerId: result.existing_customer_id!,
              existingProperties: result.existing_properties!
          });
          setLoading(false);
          return;
      }

      if (result.status === 'CONFLICT_EXISTING_OWNER') {
          setConflictState({
              extractedData: result.extracted_data,
              conflictOwner: result.conflict_owner!,
              conflictProperty: result.conflict_property!
          });
          setLoading(false);
          return;
      }

      // If Success, proceed
      finalizeAnalysis(result.extracted_data, result.customer_data!);

    } catch (err) {
      console.error(err);
      setError("Errore durante l'analisi. Riprova.");
      setStep(1);
      setLoading(false);
    }
  };

  const finalizeAnalysis = async (extracted: ExtractedBill, customer: Customer) => {
      setExtractedData(extracted);
      setIdentifiedCustomer(customer);
      setManualConsumption({
          f1: extracted.consumption_f1,
          f2: extracted.consumption_f2,
          f3: extracted.consumption_f3
      });

      const selectedCtes = availableCtes.filter(c => selectedCteIds.includes(c.id));
      const results = await Promise.all(selectedCtes.map(cte => 
         API.compute_comparison(extracted, cte, indices!, calculationMode)
      ));
      
      setComparisons(results);
      if (results.length > 0) setActiveResultTab(results[0].cte_id);
      
      setStep(3);
      setLoading(false);
      setAmbiguousState(null);
      setConflictState(null);
  };

  const handlePropertySelection = async (propertyId: string | 'NEW') => {
      if (!ambiguousState) return;
      setLoading(true);
      try {
          const { customer } = await API.save_analyzed_bill(
              ambiguousState.extractedData,
              user,
              ambiguousState.existingCustomerId,
              propertyId
          );
          await finalizeAnalysis(ambiguousState.extractedData, customer);
      } catch (e) {
          setError("Errore nel salvataggio della proprietà.");
          setLoading(false);
      }
  };

  const handleTransfer = async () => {
      if (!conflictState) return;
      setLoading(true);
      try {
          // Transfer ownership: Old property marked SOLD, New Customer created with fresh property
          const { newCustomer } = await API.transfer_property(
              conflictState.extractedData,
              user,
              conflictState.conflictOwner,
              conflictState.conflictProperty
          );
          await finalizeAnalysis(conflictState.extractedData, newCustomer);
      } catch (e) {
          console.error(e);
          setError("Errore nel trasferimento proprietà.");
          setLoading(false);
      }
  };

  const recalculateComparisons = async () => {
      if (!extractedData || !indices) return;
      
      const overriddenBill = {
          ...extractedData,
          consumption_f1: manualConsumption.f1,
          consumption_f2: manualConsumption.f2,
          consumption_f3: manualConsumption.f3,
          consumption: manualConsumption.f1 + manualConsumption.f2 + manualConsumption.f3
      };

      const selectedCtes = availableCtes.filter(c => selectedCteIds.includes(c.id));
      const results = await Promise.all(selectedCtes.map(cte => 
         API.compute_comparison(overriddenBill, cte, indices, calculationMode)
      ));
      setComparisons(results);
  };

  const downloadPdf = async (result: ComparisonResult) => {
    if (!extractedData || !identifiedCustomer) return;
    const cte = availableCtes.find(c => c.id === result.cte_id);
    if (!cte) return;

    setLoading(true);
    try {
      // Fix: generate_comparison_pdf signature matches expected data object
      const response = await API.generate_comparison_pdf({ 
          comparison: result, 
          extractedData, 
          selectedCte: cte, 
          customer: identifiedCustomer 
      });
      const link = document.createElement('a');
      link.href = response.download_url;
      link.download = `Report_Risparmio_${identifiedCustomer.last_name || identifiedCustomer.company_name}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(response.download_url), 100);
    } catch(e) {
      alert("Errore generazione report");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSelectedFiles([]);
    setStep(1);
    setComparisons([]);
    setExtractedData(null);
    setIdentifiedCustomer(null);
    setSelectedCteIds([]);
  };

  const suppliers = Array.from(new Set(availableCtes.map(c => c.supplier_name)));

  if (step === 2 || loading) {
    return (
      <Container className="flex flex-col items-center justify-center h-96">
        <RefreshCw className="w-16 h-16 text-brand-accent animate-spin mb-4" />
        <p className="text-xl font-medium text-brand-primary">Elaborazione Analisi in corso...</p>
      </Container>
    );
  }

  // ... (Step 3 and Step 1 renders are largely same as before, just included for context)
  if (step === 3 && extractedData && identifiedCustomer) {
    const activeResult = comparisons.find(c => c.cte_id === activeResultTab);
    const activeCte = availableCtes.find(c => c.id === activeResultTab);

    return (
      <Container>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-brand-primary">Risultati Analisi</h2>
            <button onClick={reset} className="text-sm text-gray-500 hover:text-brand-primary underline">Nuova Analisi</button>
        </div>
        
        {/* Customer Card */}
        <div className="bg-gradient-to-r from-brand-primary to-brand-dark p-4 rounded-lg shadow-lg mb-6 text-white flex items-center gap-4">
           <div className="bg-white/10 p-3 rounded-full">
               {identifiedCustomer.type === 'COMPANY' ? <Building2 className="w-8 h-8" /> : <UserIcon className="w-8 h-8" />}
           </div>
           <div>
              <div className="text-xs text-brand-accent font-bold uppercase tracking-wider">Analisi Per</div>
              <h3 className="text-xl font-bold">
                 {identifiedCustomer.type === 'COMPANY' ? identifiedCustomer.company_name : `${identifiedCustomer.first_name} ${identifiedCustomer.last_name}`}
              </h3>
              <p className="text-sm text-gray-300 font-mono">{identifiedCustomer.fiscal_code}</p>
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                  <MapPin className="w-3 h-3" />
                  {extractedData.address}, {extractedData.city}
              </div>
           </div>
        </div>

        {/* ... (Consumption Editor, Tabs, Result Card - Same as previous code) ... */}
         {/* 1. Consumption Editor */}
        <div className="bg-white p-4 rounded-lg shadow-sm mb-6 border border-gray-100">
           <div className="flex justify-between items-center mb-3">
             <h3 className="font-bold text-gray-700">Dati Bolletta (Modificabili)</h3>
             <div className="flex bg-gray-100 rounded p-1">
                {(['MONO', 'BIO', 'TRI'] as const).map(mode => (
                    <button
                        key={mode}
                        onClick={() => setCalculationMode(mode)}
                        className={`px-3 py-1 text-xs font-bold rounded transition-colors ${calculationMode === mode ? 'bg-white text-brand-primary shadow' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        {mode}
                    </button>
                ))}
             </div>
           </div>
           
           <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                  <label className="block text-xs font-bold text-gray-400">TOTALE</label>
                  <div className="text-lg font-bold text-brand-primary">{manualConsumption.f1 + manualConsumption.f2 + manualConsumption.f3}</div>
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-400">F1 (Peak)</label>
                  <input 
                    type="number" 
                    value={manualConsumption.f1} 
                    onChange={e => setManualConsumption({...manualConsumption, f1: parseInt(e.target.value) || 0})}
                    className="w-full p-1 border rounded text-sm bg-gray-50 focus:bg-white"
                  />
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-400">F2 (Mid)</label>
                  <input 
                    type="number" 
                    value={manualConsumption.f2} 
                    onChange={e => setManualConsumption({...manualConsumption, f2: parseInt(e.target.value) || 0})}
                    className="w-full p-1 border rounded text-sm bg-gray-50 focus:bg-white"
                  />
              </div>
              <div>
                  <label className="block text-xs font-bold text-gray-400">F3 (Off)</label>
                  <input 
                    type="number" 
                    value={manualConsumption.f3} 
                    onChange={e => setManualConsumption({...manualConsumption, f3: parseInt(e.target.value) || 0})}
                    className="w-full p-1 border rounded text-sm bg-gray-50 focus:bg-white"
                  />
              </div>
           </div>
        </div>

        {/* 2. Results Tabs (Nav Tab Style) */}
        <div className="bg-brand-primary rounded-t-2xl p-2 pb-0 flex overflow-x-auto gap-1">
            {comparisons.map(comp => {
                const cte = availableCtes.find(c => c.id === comp.cte_id);
                const isActive = activeResultTab === comp.cte_id;
                return (
                    <button
                        key={comp.cte_id}
                        onClick={() => setActiveResultTab(comp.cte_id)}
                        className={`flex-shrink-0 px-6 py-3 rounded-t-xl text-sm font-bold transition-all relative ${
                            isActive 
                            ? 'bg-white text-brand-primary shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-10' 
                            : 'bg-brand-dark text-gray-400 hover:text-white hover:bg-opacity-80'
                        }`}
                    >
                       <div className="flex flex-col items-center leading-tight">
                         <span>{cte?.supplier_name}</span>
                         <span className={`text-[10px] font-normal ${isActive ? 'text-gray-500' : 'text-gray-500'}`}>{cte?.offer_name}</span>
                       </div>
                    </button>
                );
            })}
        </div>

        {/* 3. Active Comparison Result Card */}
        {activeResult && activeCte && (
            <div className="bg-white rounded-b-2xl shadow-lg overflow-hidden border-b border-l border-r border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className={`p-6 text-center border-b-4 ${activeResult.verdict === 'CONVIENE' ? 'border-brand-success bg-emerald-50' : 'border-brand-danger bg-red-50'}`}>
                    <h2 className="text-3xl font-black text-gray-800 mb-1">{activeResult.verdict}</h2>
                    <p className="text-gray-600 font-medium">
                        Delta stimato: <span className={`${activeResult.verdict === 'CONVIENE' ? 'text-brand-success' : 'text-brand-danger'} font-bold text-xl`}>
                            {activeResult.delta_value > 0 ? '+' : ''}{activeResult.delta_value.toFixed(2)} €
                        </span> / periodo
                    </p>
                    <p className="text-xs text-gray-400 mt-2 uppercase tracking-wide font-bold">(Solo Materia Energia - Escluse Tasse)</p>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="p-4 bg-gray-50 rounded border">
                            <h4 className="font-bold text-gray-700">Attuale (Stimato)</h4>
                            <div className="text-2xl font-bold text-gray-800 my-2">{activeResult.current_cost_est} €</div>
                            <div className="text-xs text-gray-500 space-y-1">
                                <div>Prezzo Rilevato: {extractedData?.detected_unit_price?.toFixed(4) || 'N/D'} €/u</div>
                                <div>Fissi Annui: {extractedData?.detected_fixed_fee?.toFixed(0) || 'N/D'} €</div>
                            </div>
                        </div>
                        <div className="p-4 bg-teal-50 rounded border border-teal-100">
                            <h4 className="font-bold text-brand-dark">Con {activeCte.supplier_name}</h4>
                            <div className="text-2xl font-bold text-brand-accent my-2">{activeResult.new_cost_est} €</div>
                            <div className="text-xs text-gray-600 space-y-1">
                                <div>Offerta: {activeCte.offer_type}</div>
                                <div>Prezzo Base: {activeCte.f0} €/u</div>
                                <div>Fissi Annui: {activeCte.fixed_fee_value.toFixed(0)} €</div>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h4 className="font-bold text-gray-700 mb-2">Perché?</h4>
                        <ul className="space-y-2">
                            {activeResult.reasons.map((r, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                    <CheckCircle className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
                                    {r}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <button 
                        onClick={() => downloadPdf(activeResult)}
                        className="w-full py-4 bg-brand-primary hover:bg-brand-dark text-white rounded-lg font-bold flex items-center justify-center gap-2 shadow-lg"
                    >
                        <Download className="w-5 h-5" />
                        Scarica Report HTML
                    </button>
                </div>
            </div>
        )}
      </Container>
    );
  }

  // Step 1 Render
  return (
    <Container>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-bold text-brand-primary mb-6">Nuova Analisi</h2>
        {/* ... (Previous Input Logic) ... */}
        <div className="space-y-8">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">1. Seleziona Segmento</label>
            <select 
              value={segment} 
              onChange={(e) => setSegment(e.target.value as Segment)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-accent outline-none bg-white"
            >
              <option value="" disabled>-- Seleziona --</option>
              {Object.values(Segment).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {segment && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <label className="block text-sm font-medium text-gray-700 mb-3">2. Seleziona Offerte da confrontare</label>
              {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}
              {!error && availableCtes.length > 0 && (
                <div className="rounded-2xl overflow-hidden shadow-sm">
                   <div className="bg-brand-primary p-2 pb-0 flex overflow-x-auto gap-1">
                       {suppliers.map(supplier => {
                         const isActive = activeSupplierTab === supplier;
                         const count = availableCtes.filter(c => c.supplier_name === supplier).length;
                         return (
                           <button
                             key={supplier}
                             onClick={() => setActiveSupplierTab(supplier)}
                             className={`px-5 py-3 rounded-t-xl text-sm font-bold whitespace-nowrap transition-all ${
                               isActive ? 'bg-white text-brand-primary shadow-[0_-2px_10px_rgba(0,0,0,0.1)]' : 'bg-transparent text-gray-400 hover:text-white hover:bg-white/10'
                             }`}
                           >
                             {supplier} <span className="opacity-60 text-xs ml-1">({count})</span>
                           </button>
                         );
                       })}
                   </div>
                   <div className="bg-white p-4 min-h-[150px] border border-gray-200 border-t-0 rounded-b-2xl">
                       {activeSupplierTab && (
                         <div className="space-y-2 animate-in fade-in duration-300">
                            {availableCtes.filter(c => c.supplier_name === activeSupplierTab).map(cte => (
                                <div 
                                  key={cte.id} 
                                  onClick={() => toggleCteSelection(cte.id)}
                                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${
                                    selectedCteIds.includes(cte.id) ? 'bg-teal-50 border-teal-200 ring-1 ring-teal-200' : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-sm'
                                  }`}
                                >
                                    {selectedCteIds.includes(cte.id) ? <CheckSquare className="w-5 h-5 text-brand-primary shrink-0" /> : <Square className="w-5 h-5 text-gray-300 shrink-0" />}
                                    <div>
                                        <div className="font-bold text-gray-800">{cte.offer_name}</div>
                                        <div className="text-xs text-gray-500 flex gap-2"><span>{cte.offer_type}</span><span>•</span><span>F0: {cte.f0} {cte.spread_unit}</span></div>
                                    </div>
                                </div>
                            ))}
                         </div>
                       )}
                   </div>
                </div>
              )}
              {!error && selectedCteIds.length > 0 && (
                <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <label className="block text-sm font-medium text-gray-700 mb-2">3. Carica Bolletta / Documenti</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-brand-accent transition-colors bg-gray-50 relative group mb-4">
                    <input type="file" multiple accept="image/*,application/pdf" onChange={handleFileSelection} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <div className="flex flex-col items-center gap-2 pointer-events-none">
                        <Camera className="w-10 h-10 text-gray-400 mb-2" />
                        <span className="text-gray-600 font-medium">Scatta foto o carica PDF</span>
                        <span className="text-xs text-gray-400">(Multi-selezione supportata)</span>
                    </div>
                  </div>

                  {selectedFiles.length > 0 && (
                      <div className="mb-4">
                          <h4 className="text-sm font-bold text-gray-700 mb-2">File selezionati ({selectedFiles.length}):</h4>
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
                </div>
              )}
              {!error && (
                <button disabled={selectedFiles.length === 0 || selectedCteIds.length === 0} onClick={startAnalysis} className={`w-full py-4 rounded-lg font-bold text-white shadow-md flex items-center justify-center gap-2 transition-all mt-8 ${selectedFiles.length > 0 && selectedCteIds.length > 0 ? 'bg-brand-accent hover:bg-teal-500 transform hover:-translate-y-1' : 'bg-gray-300 cursor-not-allowed'}`}>
                  <span>Confronta ({selectedCteIds.length}) Offerte</span><ArrowRight className="w-5 h-5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

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

      {/* CONFLICT MODAL */}
      {conflictState && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 border-2 border-orange-500">
              <div className="bg-orange-500 p-5 text-white">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                     <ArrowLeftRight className="w-6 h-6" />
                     Conflitto di Proprietà
                  </h3>
                  <p className="text-sm text-white/90 mt-1 font-medium">
                      Il POD/PDR rilevato risulta già attivo su un altro cliente!
                  </p>
              </div>
              
              <div className="p-6">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                      <h4 className="text-xs font-bold text-orange-800 uppercase mb-2">Attuale Proprietario Rilevato:</h4>
                      <p className="font-bold text-gray-800 text-lg">
                          {conflictState.conflictOwner.type === 'COMPANY' ? conflictState.conflictOwner.company_name : `${conflictState.conflictOwner.first_name} ${conflictState.conflictOwner.last_name}`}
                      </p>
                      <p className="text-sm text-gray-600 font-mono mb-2">{conflictState.conflictOwner.fiscal_code}</p>
                      <p className="text-xs text-gray-500">Immobile: {conflictState.conflictProperty.address}, {conflictState.conflictProperty.city}</p>
                  </div>
                  
                  <h4 className="font-bold text-gray-700 mb-3 text-center">Come vuoi procedere?</h4>

                  <button 
                     onClick={handleTransfer}
                     className="w-full mb-3 p-4 bg-brand-primary hover:bg-brand-dark text-white rounded-lg font-bold flex items-center justify-between shadow-lg group"
                  >
                      <div className="text-left">
                          <div className="text-sm text-brand-accent group-hover:text-white transition-colors">È una voltura / subentro</div>
                          <div className="text-lg">Trasferisci al nuovo cliente</div>
                      </div>
                      <ArrowRight className="w-6 h-6" />
                  </button>
                  
                  <p className="text-xs text-gray-400 text-center mt-2 px-4">
                      Se confermi, l'immobile verrà segnato come "Venduto/Obsoleto" sul vecchio proprietario e ne verrà creato uno nuovo per l'intestatario della bolletta caricata.
                  </p>
                  
                  <button 
                     onClick={() => { setConflictState(null); setStep(1); }}
                     className="w-full mt-4 py-3 text-gray-500 hover:text-gray-700 font-bold underline"
                  >
                      Annulla operazione
                  </button>
              </div>
           </div>
        </div>
      )}

    </Container>
  );
};

export default AnalysisTab;
