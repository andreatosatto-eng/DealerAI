
import React, { useState, useEffect } from 'react';
import { Customer, User, Opportunity, CommodityDetails, Property } from '../types';
import * as API from '../services/mockApi';
import { Container } from './ui/Layouts';
import { Search, Zap, Flame, ArrowUpRight, History, X, User as UserIcon, Building2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  user: User;
}

// Re-creates the detailed "Energy View" for the Energy Sector
const EnergyPortfolio: React.FC<Props> = ({ user }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [opportunities, setOpportunities] = useState<Record<string, Opportunity[]>>({});
  
  // Modals
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<{ type: 'LUCE' | 'GAS', details: CommodityDetails } | null>(null);

  useEffect(() => {
    setLoading(true);
    API.get_customers(user.agency_id).then(async (data) => {
      // Load all customers, then we filter in UI
      setCustomers(data);
      const newOpportunities: Record<string, Opportunity[]> = {};
      for (const c of data) {
          const ops = await API.findBestOpportunities(c);
          if (ops.length > 0) newOpportunities[c.id] = ops;
      }
      setOpportunities(newOpportunities);
      setLoading(false);
    });
  }, [user.agency_id]);

  const filtered = customers.filter(c => 
    (c.last_name || c.company_name || '').toLowerCase().includes(search.toLowerCase()) || 
    c.fiscal_code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Container>
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-brand-primary">Portafoglio Energetico</h2>
           <p className="text-sm text-gray-500">Dettaglio Forniture Luce & Gas</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 sticky top-20 z-20">
        <div className="relative">
           <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
           <input 
             type="text" 
             placeholder="Cerca cliente..." 
             value={search}
             onChange={e => setSearch(e.target.value)}
             className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-accent"
           />
        </div>
      </div>

      {loading ? <div className="text-center py-12">Caricamento...</div> : (
          <div className="space-y-6">
              {filtered.map(cust => {
                  const custOps = opportunities[cust.id] || [];
                  // Only show customer if they have Energy properties
                  const activeProps = cust.properties.filter(p => (p.electricity || p.gas) && p.status === 'ACTIVE');
                  if(activeProps.length === 0) return null;

                  return (
                      <div key={cust.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                          <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-full ${cust.type === 'COMPANY' ? 'bg-blue-100 text-blue-600' : 'bg-teal-100 text-teal-600'}`}>
                                      {cust.type === 'COMPANY' ? <Building2 className="w-5 h-5"/> : <UserIcon className="w-5 h-5"/>}
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-gray-800">{cust.type === 'COMPANY' ? cust.company_name : `${cust.first_name} ${cust.last_name}`}</h3>
                                      <div className="text-xs text-gray-500">{cust.fiscal_code}</div>
                                  </div>
                              </div>
                          </div>
                          
                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {activeProps.map(prop => {
                                  const elecOp = custOps.find(o => o.property_id === prop.id && o.commodity === 'luce');
                                  const gasOp = custOps.find(o => o.property_id === prop.id && o.commodity === 'gas');

                                  return (
                                      <div key={prop.id} className="contents">
                                          {/* Detailed Electricity Card */}
                                          {prop.electricity && (
                                              <div 
                                                onClick={() => setSelectedHistory({ type: 'LUCE', details: prop.electricity! })}
                                                className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 relative cursor-pointer hover:shadow-md transition-all group"
                                              >
                                                  <div className="flex justify-between items-start mb-3">
                                                      <div className="flex items-center gap-2">
                                                          <div className="bg-white p-2 rounded-full shadow-sm"><Zap className="w-5 h-5 text-yellow-500" /></div>
                                                          <div>
                                                              <div className="font-bold text-yellow-900 text-sm">LUCE - {prop.name || prop.city}</div>
                                                              <div className="text-xs text-yellow-700">{prop.address}</div>
                                                          </div>
                                                      </div>
                                                      {elecOp && (
                                                        <span className="bg-brand-success text-white text-[10px] font-bold px-2 py-1 rounded shadow animate-pulse flex items-center gap-1">
                                                            <ArrowUpRight className="w-3 h-3" /> Save {elecOp.estimated_savings}€
                                                        </span>
                                                      )}
                                                  </div>
                                                  
                                                  <div className="space-y-2 text-sm">
                                                      <div className="flex justify-between border-b border-yellow-200 pb-1">
                                                          <span className="text-gray-500">Fornitore</span>
                                                          <span className="font-bold text-gray-800">{prop.electricity.supplier}</span>
                                                      </div>
                                                      <div className="flex justify-between border-b border-yellow-200 pb-1">
                                                          <span className="text-gray-500">Consumo Annuo</span>
                                                          <span className="font-bold text-gray-800">{prop.electricity.annual_consumption?.toFixed(0)} kWh</span>
                                                      </div>
                                                      <div className="grid grid-cols-2 gap-2 mt-2">
                                                          <div className="bg-white/60 p-2 rounded">
                                                              <div className="text-[10px] text-gray-400 uppercase font-bold">Costo Energia</div>
                                                              <div className="font-bold text-gray-700">{prop.electricity.raw_material_cost} €/kWh</div>
                                                          </div>
                                                          <div className="bg-white/60 p-2 rounded">
                                                              <div className="text-[10px] text-gray-400 uppercase font-bold">Quote Fisse</div>
                                                              <div className="font-bold text-gray-700">{prop.electricity.fixed_fee_year?.toFixed(0)} €/anno</div>
                                                          </div>
                                                      </div>
                                                  </div>
                                              </div>
                                          )}

                                          {/* Detailed Gas Card */}
                                          {prop.gas && (
                                              <div 
                                                onClick={() => setSelectedHistory({ type: 'GAS', details: prop.gas! })}
                                                className="bg-orange-50 rounded-xl p-4 border border-orange-200 relative cursor-pointer hover:shadow-md transition-all group"
                                              >
                                                  <div className="flex justify-between items-start mb-3">
                                                      <div className="flex items-center gap-2">
                                                          <div className="bg-white p-2 rounded-full shadow-sm"><Flame className="w-5 h-5 text-orange-500" /></div>
                                                          <div>
                                                              <div className="font-bold text-orange-900 text-sm">GAS - {prop.name || prop.city}</div>
                                                              <div className="text-xs text-orange-700">{prop.address}</div>
                                                          </div>
                                                      </div>
                                                      {gasOp && (
                                                        <span className="bg-brand-success text-white text-[10px] font-bold px-2 py-1 rounded shadow animate-pulse flex items-center gap-1">
                                                            <ArrowUpRight className="w-3 h-3" /> Save {gasOp.estimated_savings}€
                                                        </span>
                                                      )}
                                                  </div>
                                                  
                                                  <div className="space-y-2 text-sm">
                                                      <div className="flex justify-between border-b border-orange-200 pb-1">
                                                          <span className="text-gray-500">Fornitore</span>
                                                          <span className="font-bold text-gray-800">{prop.gas.supplier}</span>
                                                      </div>
                                                      <div className="flex justify-between border-b border-orange-200 pb-1">
                                                          <span className="text-gray-500">Consumo Annuo</span>
                                                          <span className="font-bold text-gray-800">{prop.gas.annual_consumption?.toFixed(0)} Smc</span>
                                                      </div>
                                                      <div className="grid grid-cols-2 gap-2 mt-2">
                                                          <div className="bg-white/60 p-2 rounded">
                                                              <div className="text-[10px] text-gray-400 uppercase font-bold">Costo Materia</div>
                                                              <div className="font-bold text-gray-700">{prop.gas.raw_material_cost} €/Smc</div>
                                                          </div>
                                                          <div className="bg-white/60 p-2 rounded">
                                                              <div className="text-[10px] text-gray-400 uppercase font-bold">Quote Fisse</div>
                                                              <div className="font-bold text-gray-700">{prop.gas.fixed_fee_year?.toFixed(0)} €/anno</div>
                                                          </div>
                                                      </div>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  );
              })}
          </div>
      )}
      
      {/* Reusing History Modal Logic from Tabs */}
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

export default EnergyPortfolio;
