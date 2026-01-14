
import React, { useState, useEffect } from 'react';
import { User, Agency, AuditLog } from '../types';
import * as API from '../services/mockApi';
import { Container } from './ui/Layouts';
import { 
    Plus, Building2, Users, Shield, UserPlus, Trash2, Edit, Save, X, Loader2, 
    CheckCircle2, Ban, Globe, CreditCard, History, Database, Download, Upload, 
    AlertTriangle, Terminal, Search 
} from 'lucide-react';

interface Props {
  user: User;
}

const ManagementTab: React.FC<Props> = ({ user }) => {
  const isSuperAdmin = user.agency_id === 'ag_mt';
  const [activeTab, setActiveTab] = useState<'AGENCIES' | 'USERS' | 'DATABASE' | 'AUDIT'>(isSuperAdmin ? 'AGENCIES' : 'USERS');
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Create Agency Form
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [newAgency, setNewAgency] = useState({ name: '', vat_number: '' });

  // Create User Form
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({ 
      username: '', 
      password: '', 
      full_name: '', 
      agency_id: isSuperAdmin ? '' : user.agency_id, 
      role: 'AGENT',
      is_active: true 
  });

  const fetchData = async () => {
    setLoading(true);
    const [agList, usList, logs] = await Promise.all([
        API.list_agencies(user),
        API.list_users(user),
        API.get_audit_logs(user)
    ]);
    setAgencies(agList);
    setUsers(usList);
    setAuditLogs(logs);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleCreateAgency = async () => {
    if (!newAgency.name || !newAgency.vat_number) return;
    setLoading(true);
    await API.create_agency(newAgency);
    setNewAgency({ name: '', vat_number: '' });
    setShowAgencyModal(false);
    fetchData();
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password || (!isSuperAdmin && !newUser.agency_id)) return;
    setLoading(true);
    await API.create_system_user(newUser as Omit<User, 'id'>, user);
    setShowUserModal(false);
    setNewUser({ username: '', password: '', full_name: '', agency_id: isSuperAdmin ? '' : user.agency_id, role: 'AGENT', is_active: true });
    fetchData();
  };

  const toggleUser = async (userId: string) => {
    await API.toggle_user_status(userId, user);
    fetchData();
  };

  const handleExportDB = async () => {
      const data = await API.db_export(isSuperAdmin ? undefined : user.agency_id);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${isSuperAdmin ? 'full' : user.agency_id}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
  };

  const handleImportDB = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isSuperAdmin) return;
      if (e.target.files && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = async (event) => {
              const content = event.target?.result as string;
              const success = await API.db_import(content);
              if (success) {
                  alert("Database importato con successo!");
                  window.location.reload();
              } else {
                  alert("Errore nell'importazione. File non valido o mancante di permessi SuperAdmin.");
              }
          };
          reader.readAsText(e.target.files[0]);
      }
  };

  return (
    <Container>
      <div className="mb-8 flex justify-between items-end">
        <div>
            <h2 className="text-3xl font-black text-brand-primary">
                {isSuperAdmin ? 'Gestione Sistema' : 'Gestione Agenzia'}
            </h2>
            <p className="text-gray-500">
                {isSuperAdmin ? 'Amministrazione Multi-Tenant Core' : `Amministrazione Team: ${agencies[0]?.name || '...'}`}
            </p>
        </div>
        <div className="hidden md:block">
            <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">V1.3.0 SECURITY_PATCH</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-2xl w-fit">
        {isSuperAdmin && (
            <button 
                onClick={() => setActiveTab('AGENCIES')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'AGENCIES' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <Building2 className="w-4 h-4"/> Rete Agenzie
            </button>
        )}
        <button 
            onClick={() => setActiveTab('USERS')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'USERS' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            <Users className="w-4 h-4"/> {isSuperAdmin ? 'Tutti gli Utenti' : 'Membri Team'}
        </button>
        <button 
            onClick={() => setActiveTab('AUDIT')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'AUDIT' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            <History className="w-4 h-4"/> Log Attività
        </button>
        <button 
            onClick={() => setActiveTab('DATABASE')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'DATABASE' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            <Database className="w-4 h-4"/> {isSuperAdmin ? 'Database' : 'Export Dati'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[450px]">
          
          {/* 1. AGENCIES (SuperAdmin Only) */}
          {activeTab === 'AGENCIES' && isSuperAdmin && (
              <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        <Globe className="w-5 h-5 text-brand-accent"/> Rete Agenzie Partner
                      </h3>
                      <button onClick={() => setShowAgencyModal(true)} className="bg-brand-accent text-brand-dark px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm">
                          <Plus className="w-4 h-4"/> Nuova Agenzia
                      </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {agencies.map(ag => (
                          <div key={ag.id} className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                              <div className="flex justify-between items-start mb-3">
                                  <div className="bg-white p-2 rounded-lg shadow-sm"><Building2 className="w-6 h-6 text-brand-primary"/></div>
                                  <div className="text-[10px] bg-white border px-2 py-0.5 rounded font-bold text-gray-400">ID: {ag.id}</div>
                              </div>
                              <h4 className="font-bold text-gray-800 text-lg leading-tight mb-1">{ag.name}</h4>
                              <div className="text-sm text-gray-500 flex items-center gap-2"><CreditCard className="w-4 h-4" /> {ag.vat_number}</div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* 2. USERS (Scoped) */}
          {activeTab === 'USERS' && (
              <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        <Shield className="w-5 h-5 text-brand-accent"/> {isSuperAdmin ? 'Gestione Account Rete' : 'Gestione Agenti'}
                      </h3>
                      <button onClick={() => setShowUserModal(true)} className="bg-brand-primary text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm">
                          <UserPlus className="w-4 h-4"/> {isSuperAdmin ? 'Nuovo Utente' : 'Aggiungi Agente'}
                      </button>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left">
                          <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 border-b">
                              <tr>
                                  <th className="px-4 py-3">Utente</th>
                                  {isSuperAdmin && <th className="px-4 py-3">Agenzia</th>}
                                  <th className="px-4 py-3">Ruolo</th>
                                  <th className="px-4 py-3 text-right">Stato</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-sm">
                              {users.map(u => (
                                  <tr key={u.id} className="hover:bg-gray-50 transition-all">
                                      <td className="px-4 py-3">
                                          <div className="flex items-center gap-3">
                                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${u.role === 'ADMIN' ? 'bg-brand-dark text-brand-accent' : 'bg-gray-200 text-gray-500'}`}>
                                                  {u.full_name.charAt(0)}
                                              </div>
                                              <div>
                                                  <div className="font-bold">{u.full_name}</div>
                                                  <div className="text-[10px] text-gray-400">@{u.username}</div>
                                              </div>
                                          </div>
                                      </td>
                                      {isSuperAdmin && <td className="px-4 py-3">{agencies.find(a => a.id === u.agency_id)?.name}</td>}
                                      <td className="px-4 py-3">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                              {u.role}
                                          </span>
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                          <button 
                                              onClick={() => toggleUser(u.id)} 
                                              disabled={u.id === user.id} // Cannot toggle self
                                              className={`text-xs font-bold px-3 py-1 rounded border transition-colors ${u.is_active ? 'border-red-100 text-red-500 hover:bg-red-50' : 'border-green-100 text-green-500 hover:bg-green-50'} disabled:opacity-30`}
                                          >
                                              {u.is_active ? 'Sospendi' : 'Abilita'}
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          )}

          {/* 3. AUDIT LOGS (Scoped) */}
          {activeTab === 'AUDIT' && (
              <div className="p-6">
                  <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-6">
                    <History className="w-5 h-5 text-brand-accent"/> {isSuperAdmin ? 'Log Globale MT' : 'Log Attività Agenzia'}
                  </h3>
                  <div className="bg-gray-900 rounded-xl p-4 font-mono text-[11px] h-[400px] overflow-y-auto text-green-400 border-4 border-gray-800 shadow-inner">
                      <div className="text-gray-500 border-b border-gray-800 pb-1 mb-2">--- REAL-TIME AUDIT STREAM ---</div>
                      {auditLogs.map(log => (
                          <div key={log.id} className="hover:bg-white/5 p-1 rounded transition-colors group">
                              <span className="text-gray-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                              {isSuperAdmin && <span className="text-brand-accent font-bold">[{log.agency_id}]</span>}{' '}
                              <span className="text-blue-400 uppercase font-bold">{log.action}</span>{' '}
                              <span className="text-gray-400">@{log.username}:</span>{' '}
                              <span className="text-white group-hover:text-brand-accent">{log.details}</span>
                          </div>
                      ))}
                      {auditLogs.length === 0 && <div className="text-gray-600 italic">Nessun evento registrato per questa agenzia.</div>}
                  </div>
              </div>
          )}

          {/* 4. DATABASE TOOLS (Contextual) */}
          {activeTab === 'DATABASE' && (
              <div className="p-6">
                  <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-6">
                    <Database className="w-5 h-5 text-brand-accent"/> {isSuperAdmin ? 'Manutenzione Core' : 'Backup e Dati'}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm">
                          <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                              <Download className="w-4 h-4 text-blue-500"/> {isSuperAdmin ? 'Esporta Backup Totale' : 'Esporta Clienti e Contratti'}
                          </h4>
                          <p className="text-xs text-gray-500 mb-4">
                              {isSuperAdmin 
                                ? "Genera un file JSON completo di tutte le agenzie e i listini." 
                                : "Scarica un backup cifrato dei tuoi clienti e delle anagrafiche inserite dai tuoi agenti."}
                          </p>
                          <button onClick={handleExportDB} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm w-full hover:bg-blue-700 transition-colors shadow-sm">Genera Archivio JSON</button>
                      </div>

                      {isSuperAdmin && (
                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                                <Upload className="w-4 h-4 text-brand-accent"/> Ripristino Sistema
                            </h4>
                            <p className="text-xs text-gray-500 mb-4">Carica un file di backup per ripristinare l'intero database di rete.</p>
                            <div className="relative">
                                <input type="file" accept=".json" onChange={handleImportDB} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                                <button className="bg-brand-primary text-white px-4 py-2.5 rounded-xl font-bold text-sm w-full shadow-sm">Seleziona File di Backup</button>
                            </div>
                        </div>
                      )}

                      {!isSuperAdmin && (
                          <div className="bg-brand-dark p-6 rounded-2xl text-white flex flex-col justify-center">
                              <h4 className="font-bold text-brand-accent mb-2 flex items-center gap-2">
                                  <Shield className="w-4 h-4"/> Security Note
                              </h4>
                              <p className="text-xs text-gray-400">
                                  La tua agenzia opera in un'istanza dedicata. Nessun dato condiviso qui è visibile ad altre agenzie partner. Solo i tuoi ADMIN possono gestire gli AGENTI.
                              </p>
                          </div>
                      )}

                      {isSuperAdmin && (
                        <div className="md:col-span-2 bg-red-50 p-6 rounded-2xl border border-red-100 flex items-start gap-4">
                            <AlertTriangle className="w-10 h-10 text-red-500 shrink-0" />
                            <div>
                                <h4 className="font-bold text-red-800 mb-1">Zona Pericolo: Reset Globale</h4>
                                <p className="text-xs text-red-600 mb-4">Questa operazione eliminerà tutte le agenzie e tutti i dati inseriti. È ammessa solo in fase di testing.</p>
                                <button onClick={() => { if(confirm("WIPE?")) API.db_reset(); window.location.reload(); }} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-red-700 transition-colors">WIPE ALL NETWORK DATA</button>
                            </div>
                        </div>
                      )}
                  </div>
              </div>
          )}
      </div>

      {/* Modals for creation (unchanged but context-aware select) */}
      {showAgencyModal && isSuperAdmin && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b">
                      <h3 className="font-bold text-xl">Registra Agenzia</h3>
                      <button onClick={() => setShowAgencyModal(false)}><X className="w-6 h-6"/></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ragione Sociale</label>
                          <input placeholder="Es. Agenzia Rossi Srl" className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none" onChange={e => setNewAgency({...newAgency, name: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Partita IVA</label>
                          <input placeholder="IT..." className="w-full border p-3 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none" onChange={e => setNewAgency({...newAgency, vat_number: e.target.value})} />
                      </div>
                      <button onClick={handleCreateAgency} className="w-full py-3 bg-brand-primary text-white font-bold rounded-xl shadow-lg">Crea Agenzia Partner</button>
                  </div>
              </div>
          </div>
      )}

      {showUserModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b">
                      <h3 className="font-bold text-xl">{isSuperAdmin ? 'Nuovo Utente Sistema' : 'Aggiungi Agente'}</h3>
                      <button onClick={() => setShowUserModal(false)}><X className="w-6 h-6"/></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nome Completo</label>
                          <input placeholder="Nome e Cognome" className="w-full border p-3 rounded-xl" onChange={e => setNewUser({...newUser, full_name: e.target.value})} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Username</label>
                            <input placeholder="user.name" className="w-full border p-3 rounded-xl" onChange={e => setNewUser({...newUser, username: e.target.value.toLowerCase()})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
                            <input type="password" placeholder="••••••" className="w-full border p-3 rounded-xl" onChange={e => setNewUser({...newUser, password: e.target.value})} />
                        </div>
                      </div>
                      {isSuperAdmin && (
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Assegna ad Agenzia</label>
                            <select className="w-full border p-3 rounded-xl" onChange={e => setNewUser({...newUser, agency_id: e.target.value})}>
                                <option value="">Seleziona...</option>
                                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                      )}
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ruolo</label>
                          <select className="w-full border p-3 rounded-xl" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}>
                              <option value="AGENT">Agente (Vendite)</option>
                              <option value="ADMIN">Amministratore (Gestione)</option>
                          </select>
                      </div>
                      <button onClick={handleCreateUser} className="w-full py-3 bg-brand-primary text-white font-bold rounded-xl mt-4">Conferma Creazione</button>
                  </div>
              </div>
          </div>
      )}
    </Container>
  );
};

export default ManagementTab;
