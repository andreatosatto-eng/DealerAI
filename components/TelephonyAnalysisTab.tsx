
import React, { useState, useEffect } from 'react';
import { User, TelephonyOpportunity } from '../types';
import * as API from '../services/mockApi';
import { Container } from './ui/Layouts';
import { RefreshCw, TrendingDown, Smartphone, Router, AlertTriangle, UploadCloud, FileText, Loader2 } from 'lucide-react';

interface Props {
  user: User;
}

const TelephonyAnalysisTab: React.FC<Props> = ({ user }) => {
  const [opportunities, setOpportunities] = useState<TelephonyOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const runAnalysis = async () => {
      setLoading(true);
      const ops = await API.findTelephonyOpportunities(user);
      setOpportunities(ops);
      setLoading(false);
  };

  useEffect(() => {
      runAnalysis();
  }, [user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setUploading(true);
          try {
              const file = e.target.files[0];
              const result = await API.process_telephony_bill(file, user);
              alert(`Analisi completata!\nCliente: ${result.customer.first_name || result.customer.company_name}\nGestore Rilevato: ${result.extracted.operator}`);
              await runAnalysis();
          } catch (err) {
              console.error(err);
              alert("Errore durante l'analisi della fattura telefonica.");
          } finally {
              setUploading(false);
              e.target.value = '';
          }
      }
  };

  return (
    <Container>
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-brand-primary">Analisi Risparmio</h2>
           <p className="text-sm text-gray-500">Confronto automatico Portafoglio vs Canvas</p>
        </div>
        <button 
           onClick={runAnalysis}
           className="bg-brand-primary text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-dark"
        >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/> Aggiorna Analisi
        </button>
      </div>

      {/* UPLOAD SECTION */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm mb-8 animate-in fade-in slide-in-from-top-2">
          <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-accent"/> Nuova Analisi da Fattura
          </h3>
          <p className="text-sm text-gray-500 mb-4">Carica una bolletta telefonica (PDF o Immagine) per estrarre i dati e trovare subito l'offerta migliore.</p>
          
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-brand-accent transition-colors bg-gray-50 relative group cursor-pointer">
                <input 
                    type="file" 
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                    {uploading ? (
                        <>
                            <Loader2 className="w-8 h-8 text-brand-accent animate-spin mb-1" />
                            <span className="text-gray-600 font-bold">Estrazione dati in corso...</span>
                        </>
                    ) : (
                        <>
                            <div className="bg-white p-3 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                <UploadCloud className="w-6 h-6 text-brand-primary" />
                            </div>
                            <span className="text-brand-primary font-bold">Clicca per caricare</span>
                            <span className="text-xs text-gray-400">Supporta PDF, JPG, PNG</span>
                        </>
                    )}
                </div>
          </div>
      </div>

      {loading ? <div className="text-center py-12">Analisi in corso...</div> : (
          <div className="space-y-4">
              {opportunities.length === 0 && (
                  <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl">
                      Nessuna opportunità di risparmio trovata con il Canvas attuale.
                  </div>
              )}

              {opportunities.map((op, idx) => (
                  <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row gap-4 items-center">
                      <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                              {op.asset_type === 'MOBILE' ? <Smartphone className="w-5 h-5 text-fuchsia-500"/> : <Router className="w-5 h-5 text-indigo-500"/>}
                              <span className="font-bold text-gray-800">{op.customer_name}</span>
                          </div>
                          <div className="text-sm text-gray-500">
                              Attuale: <span className="font-medium text-gray-700">{op.current_asset_info}</span> a <span className="font-bold text-red-500">{op.current_cost.toFixed(2)}€</span>
                          </div>
                          {op.penalty_monthly > 0 && (
                              <div className="text-[10px] text-orange-600 flex items-center gap-1 mt-1 bg-orange-50 w-fit px-2 py-0.5 rounded font-bold">
                                  <AlertTriangle className="w-3 h-3" />
                                  Attenzione: Penale {op.penalty_monthly}€/mese
                              </div>
                          )}
                      </div>

                      <div className="hidden md:block text-gray-300">➜</div>

                      <div className="flex-1 bg-green-50 p-3 rounded-lg border border-green-100">
                          <div className="text-xs text-green-700 font-bold uppercase mb-1">Migliore Alternativa</div>
                          <div className="font-bold text-green-900">{op.better_offer.operator_name} {op.better_offer.name}</div>
                          <div className="text-sm text-green-800">
                              Canone: {op.better_offer.monthly_price.toFixed(2)}€
                          </div>
                      </div>

                      <div className="text-right min-w-[120px]">
                          <div className="text-xs text-gray-400 font-bold uppercase">Risparmio</div>
                          <div className="text-2xl font-bold text-brand-success flex items-center justify-end gap-1">
                              <TrendingDown className="w-5 h-5"/>
                              {op.estimated_monthly_savings.toFixed(2)}€
                          </div>
                          <div className="text-[10px] text-gray-400">al mese</div>
                      </div>
                  </div>
              ))}
          </div>
      )}
    </Container>
  );
};

export default TelephonyAnalysisTab;
