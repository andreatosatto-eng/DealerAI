
import React, { useState, useEffect } from 'react';
import { User, Agency, AuditLog, UserRole } from '../types';
import * as API from '../services/mockApi';
import { Container } from './ui/Layouts';
import { 
    Plus, Building2, Users, Shield, UserPlus, Trash2, Edit, Save, X, Loader2, 
    CheckCircle2, Ban, Globe, CreditCard, History, Database, Download, Upload, 
    AlertTriangle, Terminal, Search, MapPin, Share2, ArrowDownCircle
} from 'lucide-react';
import { syncCustomerToHighLevel, importContactsFromHighLevel } from '../services/highLevelService';

interface Props {
  user: User;
}

const ManagementTab: React.FC<Props> = ({ user }) => {
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isAgencyAdmin = user.role === 'AGENCY_ADMIN';

  const [activeTab, setActiveTab] = useState<'AGENCIES' | 'BRANCHES' | 'USERS' | 'DATABASE' | 'AUDIT' | 'INTEGRATIONS'>(isSuperAdmin ? 'AGENCIES' : 'USERS');
  
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  
  // HighLevel Sync State
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  
  // HighLevel Import State
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  
  // Create Agency Form
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [newAgency, setNewAgency] = useState({ name: '', vat_number: '' });

  // Create Branch Form
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranch, setNewBranch] = useState({ name: '', city: '' });

  // Create User Form
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({ 
      username: '', 
      password: '', 
      full_name: '', 
      agency_id: isSuperAdmin ? '' : user.agency_id, 
      branch_id: '',
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

  const handleCreateBranch = async () => {
      if(!newBranch.name || !newBranch.city) return;
      setLoading(true);
      await API.add_branch_to_agency(user.agency_id, newBranch.name, newBranch.city);
      setShowBranchModal(false);
      setNewBranch({ name: '', city: ''});
      fetchData();
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password || (!isSuperAdmin && !newUser.agency_id)) return;
    
    // Safety check for UI
    if (user.role === 'AGENCY_ADMIN' && newUser.role === 'SUPER_ADMIN') {
        alert("Non puoi creare un Super Admin.");
        return;
    }

    setLoading(true);
    try {
        await API.create_system_user(newUser as Omit<User, 'id'>, user);
        setShowUserModal(false);
        setNewUser({ 
            username: '', 
            password: '', 
            full_name: '', 
            agency_id: isSuperAdmin ? '' : user.agency_id, 
            branch_id: '',
            role: 'AGENT', 
            is_active: true 
        });
        fetchData();
    } catch(e: any) {
        alert("Errore: " + e.message);
    } finally {
        setLoading(false);
    }
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

  const handleHighLevelSync = async () => {
    if (!confirm("Vuoi sincronizzare tutti i clienti di questa agenzia con HighLevel?")) return;
    
    setSyncing(true);
    setSyncResult(null);
    try {
        // Fetch all customers for current agency
        const customers = await API.get_customers(user.agency_id);
        let successCount = 0;
        let failCount = 0;

        for (const customer of customers) {
            try {
                await syncCustomerToHighLevel(customer);
                successCount++;
            } catch (e) {
                console.error(`Failed to sync customer ${customer.id}`, e);
                failCount++;
            }
        }
        setSyncResult(`Sincronizzazione completata: ${successCount} successi, ${failCount} errori.`);
    } catch (e) {
        setSyncResult("Errore critico durante la sincronizzazione.");
    } finally {
        setSyncing(false);
    }
  };

  const handleHighLevelImport = () => {
    setShowImportConfirm(true);
  };

  const executeImport = async () => {
    setShowImportConfirm(false);
    console.log("Starting import process...");
    setImporting(true);
    setImportResult(null);
    try {
        console.log("Calling importContactsFromHighLevel...");
        const result = await importContactsFromHighLevel(user.agency_id);
        console.log("Import result:", result);
        setImportResult(`Import completato: ${result.success} processati, ${result.failed} errori.`);
    } catch (e: any) {
        console.error("Import failed in component:", e);
        setImportResult(`Errore: ${e.response?.data?.error || e.message || "Errore sconosciuto"}`);
    } finally {
        setImporting(false);
    }
  };

  const myAgency = agencies.find(a => a.id === user.agency_id);
  const availableBranches = isSuperAdmin 
     ? (newUser.agency_id ? agencies.find(a => a.id === newUser.agency_id)?.branches || [] : [])
     : (myAgency?.branches || []);

  return (
    <Container>
      <div className="mb-8 flex justify-between items-end">
        <div>
            <h2 className="text-3xl font-black text-brand-primary">
                {isSuperAdmin ? 'Gestione Sistema' : 'Amministrazione Agenzia'}
            </h2>
            <p className="text-gray-500">
                {isSuperAdmin ? 'Multi-Tenant Network Core' : `${myAgency?.name || '...'}`}
            </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-2xl w-fit">
        {isSuperAdmin && (
            <button 
                onClick={() => setActiveTab('AGENCIES')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'AGENCIES' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <Globe className="w-4 h-4"/> Rete Agenzie
            </button>
        )}
        {(isAgencyAdmin || isSuperAdmin) && (
             <button 
                onClick={() => setActiveTab('BRANCHES')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'BRANCHES' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <MapPin className="w-4 h-4"/> Sedi & Filiali
            </button>
        )}
        <button 
            onClick={() => setActiveTab('USERS')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'USERS' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            <Users className="w-4 h-4"/> {isSuperAdmin ? 'Tutti gli Utenti' : 'Staff & Agenti'}
        </button>
        <button 
            onClick={() => setActiveTab('AUDIT')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'AUDIT' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            <History className="w-4 h-4"/> Audit Log
        </button>
        <button 
            onClick={() => setActiveTab('DATABASE')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'DATABASE' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            <Database className="w-4 h-4"/> Dati
        </button>
        <button 
            onClick={() => setActiveTab('INTEGRATIONS')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${activeTab === 'INTEGRATIONS' ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
            <Share2 className="w-4 h-4"/> Integrazioni
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
                          <div key={ag.id} className="bg-gray-50 p-5 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-3">
                                  <div className="bg-white p-2 rounded-lg shadow-sm"><Building2 className="w-6 h-6 text-brand-primary"/></div>
                                  <div className="text-[10px] bg-white border px-2 py-0.5 rounded font-bold text-gray-400">ID: {ag.id}</div>
                              </div>
                              <h4 className="font-bold text-gray-800 text-lg leading-tight mb-1">{ag.name}</h4>
                              <div className="text-sm text-gray-500 flex items-center gap-2 mb-2"><CreditCard className="w-4 h-4" /> {ag.vat_number}</div>
                              <div className="pt-3 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                                  <span>{ag.branches?.length || 0} Sedi</span>
                                  <span>Creato: {new Date(ag.created_at).toLocaleDateString()}</span>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* 2. BRANCHES (Sedi) */}
          {activeTab === 'BRANCHES' && (
              <div className="p-6">
                 <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-brand-accent"/> Sedi Operative
                      </h3>
                      {!isSuperAdmin && (
                          <button onClick={() => setShowBranchModal(true)} className="bg-brand-primary text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm">
                              <Plus className="w-4 h-4"/> Nuova Sede
                          </button>
                      )}
                  </div>

                  <div className="space-y-6">
                      {(isSuperAdmin ? agencies : [myAgency]).filter(Boolean).map(ag => (
                          <div key={ag!.id}>
                              {isSuperAdmin && <h4 className="font-bold text-gray-500 text-xs uppercase mb-2">{ag!.name}</h4>}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {ag!.branches?.map(br => (
                                      <div key={br.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex justify-between items-center">
                                          <div>
                                              <div className="font-bold text-gray-800 flex items-center gap-2">
                                                  {br.name}
                                                  {br.is_main && <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded uppercase">Sede Legale</span>}
                                              </div>
                                              <div className="text-sm text-gray-500">{br.city}</div>
                                          </div>
                                          <MapPin className="w-5 h-5 text-gray-300" />
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* 3. USERS (Scoped) */}
          {activeTab === 'USERS' && (
              <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        <Shield className="w-5 h-5 text-brand-accent"/> {isSuperAdmin ? 'Gestione Account Rete' : 'Gestione Team'}
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
                                  <th className="px-4 py-3">Sede</th>
                                  <th className="px-4 py-3">Ruolo</th>
                                  <th className="px-4 py-3 text-right">Stato</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 text-sm">
                              {users.map(u => {
                                  const userAgency = agencies.find(a => a.id === u.agency_id);
                                  const userBranch = userAgency?.branches?.find(b => b.id === u.branch_id);

                                  return (
                                  <tr key={u.id} className="hover:bg-gray-50 transition-all">
                                      <td className="px-4 py-3">
                                          <div className="flex items-center gap-3">
                                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${u.role === 'SUPER_ADMIN' ? 'bg-brand-accent text-brand-dark' : 'bg-gray-200 text-gray-500'}`}>
                                                  {u.full_name.charAt(0)}
                                              </div>
                                              <div>
                                                  <div className="font-bold">{u.full_name}</div>
                                                  <div className="text-[10px] text-gray-400">@{u.username}</div>
                                              </div>
                                          </div>
                                      </td>
                                      {isSuperAdmin && <td className="px-4 py-3">{userAgency?.name || 'N/D'}</td>}
                                      <td className="px-4 py-3 text-xs text-gray-500">{userBranch?.name || '-'}</td>
                                      <td className="px-4 py-3">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                              u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' :
                                              u.role === 'AGENCY_ADMIN' ? 'bg-blue-100 text-blue-700' : 
                                              'bg-green-100 text-green-700'
                                          }`}>
                                              {u.role.replace('_', ' ')}
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
                              )})}
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
                      {auditLogs.length === 0 && <div className="text-gray-600 italic">Nessun evento registrato.</div>}
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
                          <button onClick={handleExportDB} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm w-full hover:bg-blue-700 transition-colors shadow-sm">Genera Archivio JSON</button>
                      </div>

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

          {/* 5. INTEGRATIONS */}
          {activeTab === 'INTEGRATIONS' && (
              <div className="p-6">
                  <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 mb-6">
                    <Share2 className="w-5 h-5 text-brand-accent"/> Integrazioni Esterne
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-4 mb-4">
                              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">HL</div>
                              <div>
                                  <h4 className="font-bold text-gray-800 text-lg">HighLevel CRM</h4>
                                  <p className="text-sm text-gray-500">Sincronizzazione contatti e lead</p>
                              </div>
                          </div>
                          
                          <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600 mb-4 border border-gray-100">
                              <p className="mb-2">Stato: <span className="font-bold text-green-600">Connesso (API v1)</span></p>
                              <p>Sincronizza l'intera anagrafica clienti verso la tua Location HighLevel configurata.</p>
                          </div>

                          {syncResult && (
                              <div className={`mb-4 p-3 rounded text-sm font-bold ${syncResult.includes('errori') ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
                                  {syncResult}
                              </div>
                          )}

                          {importResult && (
                              <div className={`mb-4 p-3 rounded text-sm font-bold ${importResult.includes('errori') ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
                                  {importResult}
                              </div>
                          )}

                          <div className="flex gap-3">
                              <button 
                                  onClick={handleHighLevelSync} 
                                  disabled={syncing || importing}
                                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                  {syncing ? <Loader2 className="w-5 h-5 animate-spin"/> : <Share2 className="w-5 h-5"/>}
                                  {syncing ? 'Invio...' : 'Export to GHL'}
                              </button>
                              
                              <button 
                                  onClick={handleHighLevelImport} 
                                  disabled={syncing || importing}
                                  className="flex-1 py-3 bg-white border-2 border-blue-600 text-blue-600 font-bold rounded-xl shadow-lg hover:bg-blue-50 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                  {importing ? <Loader2 className="w-5 h-5 animate-spin"/> : <ArrowDownCircle className="w-5 h-5"/>}
                                  {importing ? 'Ricezione...' : 'Import from GHL'}
                              </button>
                          </div>
                      </div>

                      {/* Placeholder for MCP Server Info */}
                      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow opacity-60">
                          <div className="flex items-center gap-4 mb-4">
                              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold"><Terminal className="w-6 h-6"/></div>
                              <div>
                                  <h4 className="font-bold text-gray-800 text-lg">MCP Server</h4>
                                  <p className="text-sm text-gray-500">Model Context Protocol</p>
                              </div>
                          </div>
                          <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600 mb-4 border border-gray-100">
                              <p>Endpoint attivo per agenti AI esterni.</p>
                              <code className="block mt-2 bg-gray-200 p-2 rounded text-xs">/api/mcp/tools</code>
                          </div>
                          <button disabled className="w-full py-3 bg-gray-200 text-gray-400 font-bold rounded-xl cursor-not-allowed">Configurazione (Presto disponibile)</button>
                      </div>
                  </div>
              </div>
          )}
      </div>

      {/* Modals for creation */}
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
                          <input placeholder="Es. Agenzia Rossi Srl" className="w-full border p-3 rounded-xl" onChange={e => setNewAgency({...newAgency, name: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Partita IVA</label>
                          <input placeholder="IT..." className="w-full border p-3 rounded-xl" onChange={e => setNewAgency({...newAgency, vat_number: e.target.value})} />
                      </div>
                      <button onClick={handleCreateAgency} className="w-full py-3 bg-brand-primary text-white font-bold rounded-xl shadow-lg">Crea Agenzia Partner</button>
                  </div>
              </div>
          </div>
      )}

      {showBranchModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b">
                      <h3 className="font-bold text-xl">Nuova Sede Operativa</h3>
                      <button onClick={() => setShowBranchModal(false)}><X className="w-6 h-6"/></button>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nome Sede (Es. Filiale Nord)</label>
                          <input className="w-full border p-3 rounded-xl" onChange={e => setNewBranch({...newBranch, name: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Città</label>
                          <input className="w-full border p-3 rounded-xl" onChange={e => setNewBranch({...newBranch, city: e.target.value})} />
                      </div>
                      <button onClick={handleCreateBranch} className="w-full py-3 bg-brand-primary text-white font-bold rounded-xl shadow-lg">Aggiungi Sede</button>
                  </div>
              </div>
          </div>
      )}

      {showUserModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b">
                      <h3 className="font-bold text-xl">Nuovo Utente</h3>
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
                            <select className="w-full border p-3 rounded-xl" value={newUser.agency_id} onChange={e => setNewUser({...newUser, agency_id: e.target.value, branch_id: ''})}>
                                <option value="">Seleziona...</option>
                                {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                      )}
                      
                      {newUser.agency_id && (
                          <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Assegna a Sede (Opzionale)</label>
                            <select className="w-full border p-3 rounded-xl" value={newUser.branch_id} onChange={e => setNewUser({...newUser, branch_id: e.target.value})}>
                                <option value="">Nessuna (Operativo Ovunque)</option>
                                {availableBranches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.city})</option>)}
                            </select>
                          </div>
                      )}

                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Ruolo</label>
                          <select className="w-full border p-3 rounded-xl" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                              <option value="AGENT">Agente (Operativo)</option>
                              <option value="AGENCY_ADMIN">Admin Agenzia</option>
                              {isSuperAdmin && <option value="SUPER_ADMIN">SUPER ADMIN (Globale)</option>}
                          </select>
                      </div>
                      <button onClick={handleCreateUser} className="w-full py-3 bg-brand-primary text-white font-bold rounded-xl mt-4">Conferma Creazione</button>
                  </div>
              </div>
          </div>
      )}

      {showImportConfirm && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4 pb-2 border-b">
                      <h3 className="font-bold text-xl flex items-center gap-2"><ArrowDownCircle className="w-6 h-6 text-blue-600"/> Importa da HighLevel</h3>
                      <button onClick={() => setShowImportConfirm(false)}><X className="w-6 h-6"/></button>
                  </div>
                  <div className="space-y-4">
                      <div className="bg-blue-50 p-4 rounded-xl text-blue-800 text-sm">
                          <p className="font-bold mb-2">Stai per importare i contatti da HighLevel.</p>
                          <ul className="list-disc list-inside space-y-1">
                              <li>Verranno scaricati i contatti dalla Location configurata.</li>
                              <li>I contatti esistenti (stessa email) verranno aggiornati.</li>
                              <li>I nuovi contatti verranno creati come clienti.</li>
                          </ul>
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button onClick={() => setShowImportConfirm(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl">Annulla</button>
                          <button onClick={executeImport} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700">Conferma Import</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </Container>
  );
};

export default ManagementTab;
