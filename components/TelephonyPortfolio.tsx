
import React, { useState, useEffect } from 'react';
import { Customer, User } from '../types';
import * as API from '../services/mockApi';
import { Container } from './ui/Layouts';
import { Search, User as UserIcon, Building2, Smartphone, Router, Tablet, Signal, AlertTriangle } from 'lucide-react';

interface Props {
  user: User;
}

const TelephonyPortfolio: React.FC<Props> = ({ user }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    API.get_customers(user.agency_id).then(data => {
      setCustomers(data);
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
           <h2 className="text-2xl font-bold text-brand-primary">Portafoglio Telefonia</h2>
           <p className="text-sm text-gray-500">Fisso, Mobile & Fibra</p>
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
                  const fixedLines = cust.properties.filter(p => p.connectivity && p.status === 'ACTIVE');
                  const mobileLines = cust.mobile_lines || [];
                  
                  if(fixedLines.length === 0 && mobileLines.length === 0) return null;

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
                              {/* FIXED LINES */}
                              {fixedLines.map(prop => (
                                  <div key={prop.id} className="bg-indigo-50 rounded-xl p-4 border border-indigo-200 relative">
                                      <div className="flex justify-between items-start mb-3">
                                          <div className="flex items-center gap-2">
                                              <div className="bg-white p-2 rounded-full shadow-sm"><Router className="w-5 h-5 text-indigo-500" /></div>
                                              <div>
                                                  <div className="font-bold text-indigo-900 text-sm">FIBRA/FISSO - {prop.name}</div>
                                                  <div className="text-xs text-indigo-700">{prop.address}</div>
                                              </div>
                                          </div>
                                      </div>
                                      <div className="space-y-2 text-sm">
                                          <div className="flex justify-between border-b border-indigo-200 pb-1">
                                              <span className="text-gray-500">Gestore</span>
                                              <span className="font-bold text-gray-800">{prop.connectivity?.provider}</span>
                                          </div>
                                          <div className="flex justify-between border-b border-indigo-200 pb-1">
                                              <span className="text-gray-500">Tecnologia</span>
                                              <span className="font-bold text-gray-800">{prop.connectivity?.technology}</span>
                                          </div>
                                          <div className="flex justify-between pt-1">
                                              <span className="text-gray-500 font-bold">Costo Mensile</span>
                                              <span className="font-bold text-indigo-700 text-lg">{prop.connectivity?.monthly_cost.toFixed(2)} €</span>
                                          </div>
                                          {prop.connectivity?.contract_end_date && (
                                              <div className="text-[10px] text-red-500 text-right font-medium flex items-center justify-end gap-1">
                                                  Vincolo: {prop.connectivity.contract_end_date}
                                                  {prop.connectivity.penalty_monthly_cost ? ` (Penale ${prop.connectivity.penalty_monthly_cost}€/m)` : ''}
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              ))}

                              {/* MOBILE LINES */}
                              {mobileLines.map(sim => (
                                  <div key={sim.id} className="bg-fuchsia-50 rounded-xl p-4 border border-fuchsia-200 relative">
                                      <div className="flex justify-between items-start mb-3">
                                          <div className="flex items-center gap-2">
                                              <div className="bg-white p-2 rounded-full shadow-sm">
                                                {sim.type === 'FWA_SIM' ? <Signal className="w-5 h-5 text-fuchsia-500" /> : <Smartphone className="w-5 h-5 text-fuchsia-500" />}
                                              </div>
                                              <div>
                                                  <div className="font-bold text-fuchsia-900 text-sm">MOBILE - {sim.operator}</div>
                                                  <div className="text-xs text-fuchsia-700 font-mono">{sim.number}</div>
                                              </div>
                                          </div>
                                          <div className="text-[10px] bg-white px-2 py-1 rounded text-fuchsia-800 border border-fuchsia-100 font-bold">
                                              {sim.notes || sim.type}
                                          </div>
                                      </div>
                                      <div className="space-y-2 text-sm">
                                          <div className="flex justify-between border-b border-fuchsia-200 pb-1">
                                              <span className="text-gray-500">Giga Inclusi</span>
                                              <span className="font-bold text-gray-800">{sim.data_limit_gb === 'UNLIMITED' ? 'Illimitati' : `${sim.data_limit_gb} GB`}</span>
                                          </div>
                                          {sim.device && (
                                              <div className="flex justify-between border-b border-fuchsia-200 pb-1 items-center">
                                                  <span className="text-gray-500 flex items-center gap-1"><Tablet className="w-3 h-3"/> Device</span>
                                                  <div className="text-right leading-tight">
                                                      <div className="font-bold text-gray-800">{sim.device.model}</div>
                                                      <div className="text-[9px] text-gray-500">{sim.device.installments_remaining} rate da {sim.device.installment_cost}€</div>
                                                  </div>
                                              </div>
                                          )}
                                          <div className="flex justify-between pt-1">
                                              <span className="text-gray-500 font-bold">Costo Mensile</span>
                                              <span className="font-bold text-fuchsia-700 text-lg">{sim.monthly_cost.toFixed(2)} €</span>
                                          </div>
                                          {sim.penalty_monthly_cost && (
                                              <div className="mt-2 bg-red-100 text-red-700 text-[10px] p-1 rounded font-bold text-center flex items-center justify-center gap-1">
                                                  <AlertTriangle className="w-3 h-3" />
                                                  Penale Attiva: {sim.penalty_monthly_cost} €/mese
                                              </div>
                                          )}
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  );
              })}
          </div>
      )}
    </Container>
  );
};

export default TelephonyPortfolio;
