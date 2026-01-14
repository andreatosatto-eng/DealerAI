
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Zap, FileText, Users, LogOut, Briefcase, Menu, X, Smartphone, Leaf, Car, Construction, FolderOpen, Search, Palette, Settings } from 'lucide-react';
import AnalysisTab from './components/AnalysisTab';
import IndicesTab from './components/IndicesTab';
import CteManagerTab from './components/CteManagerTab';
import ConsumerTab from './components/ConsumerTab';
import BusinessTab from './components/BusinessTab';
import EnergyPortfolio from './components/EnergyPortfolio';
import TelephonyPortfolio from './components/TelephonyPortfolio';
import CanvasManagerTab from './components/CanvasManagerTab';
import TelephonyAnalysisTab from './components/TelephonyAnalysisTab';
import ManagementTab from './components/ManagementTab'; // NEW
import LoginScreen from './components/LoginScreen';
import { IndicesResponse, User, Sector } from './types';
import * as API from './services/mockApi';

enum EnergyTab {
  ANALYSIS = 'analysis',
  PORTFOLIO = 'portfolio',
  INDICES = 'indices',
  CTE = 'cte',
}

enum TelephonyTab {
  ANALYSIS = 'analysis',
  PORTFOLIO = 'portfolio',
  CANVAS = 'canvas',
}

enum CrmTab {
  CONSUMERS = 'consumers',
  BUSINESS = 'business',
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeSector, setActiveSector] = useState<Sector>(Sector.CRM);
  const [activeEnergyTab, setActiveEnergyTab] = useState<EnergyTab>(EnergyTab.ANALYSIS);
  const [activeTelephonyTab, setActiveTelephonyTab] = useState<TelephonyTab>(TelephonyTab.ANALYSIS);
  const [activeCrmTab, setActiveCrmTab] = useState<CrmTab>(CrmTab.CONSUMERS);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [indices, setIndices] = useState<IndicesResponse | null>(null);
  const [loadingIndices, setLoadingIndices] = useState(false);

  const loadIndices = async (force = false) => {
    setLoadingIndices(true);
    try {
      const data = await API.fetch_indices(force);
      setIndices(data);
    } catch (e) {
      console.error("Failed to load indices", e);
    } finally {
      setLoadingIndices(false);
    }
  };

  useEffect(() => {
    if (currentUser && activeSector === Sector.ENERGY) {
      loadIndices();
    }
  }, [currentUser, activeSector]);

  if (!currentUser) {
    return <LoginScreen onLogin={setCurrentUser} />;
  }

  const renderSectorContent = () => {
      switch (activeSector) {
          case Sector.CRM:
              return (
                <div className="pb-20 md:pb-0">
                   <div className="md:hidden flex p-2 bg-white border-b mb-4">
                       <button onClick={() => setActiveCrmTab(CrmTab.CONSUMERS)} className={`flex-1 py-2 text-sm font-bold rounded ${activeCrmTab === CrmTab.CONSUMERS ? 'bg-brand-primary text-white' : 'text-gray-500'}`}>Famiglie</button>
                       <button onClick={() => setActiveCrmTab(CrmTab.BUSINESS)} className={`flex-1 py-2 text-sm font-bold rounded ${activeCrmTab === CrmTab.BUSINESS ? 'bg-brand-primary text-white' : 'text-gray-500'}`}>Aziende</button>
                   </div>
                   <div className="hidden md:flex justify-center mb-6 px-6 pt-4">
                        <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 flex gap-1">
                            <DesktopTab active={activeCrmTab === CrmTab.CONSUMERS} onClick={() => setActiveCrmTab(CrmTab.CONSUMERS)} label="Famiglie" icon={<Users className="w-4 h-4"/>} />
                            <DesktopTab active={activeCrmTab === CrmTab.BUSINESS} onClick={() => setActiveCrmTab(CrmTab.BUSINESS)} label="Aziende" icon={<Briefcase className="w-4 h-4"/>} />
                        </div>
                   </div>
                   {activeCrmTab === CrmTab.CONSUMERS && <ConsumerTab user={currentUser} />}
                   {activeCrmTab === CrmTab.BUSINESS && <BusinessTab user={currentUser} />}
                </div>
              );
          case Sector.ENERGY:
              return (
                <div className="pb-20 md:pb-0">
                    {activeEnergyTab === EnergyTab.ANALYSIS && <AnalysisTab indices={indices} user={currentUser} />}
                    {activeEnergyTab === EnergyTab.PORTFOLIO && <EnergyPortfolio user={currentUser} />}
                    {activeEnergyTab === EnergyTab.INDICES && <IndicesTab data={indices} onRefresh={() => loadIndices(true)} loading={loadingIndices} />}
                    {activeEnergyTab === EnergyTab.CTE && <CteManagerTab user={currentUser} />}
                </div>
              );
          case Sector.TELEPHONY:
              return (
                <div className="pb-20 md:pb-0">
                    {activeTelephonyTab === TelephonyTab.ANALYSIS && <TelephonyAnalysisTab user={currentUser} />}
                    {activeTelephonyTab === TelephonyTab.PORTFOLIO && <TelephonyPortfolio user={currentUser} />}
                    {activeTelephonyTab === TelephonyTab.CANVAS && <CanvasManagerTab user={currentUser} />}
                </div>
              );
          case Sector.MANAGEMENT:
              return <ManagementTab user={currentUser} />;
          case Sector.EFFICIENCY:
              return <PlaceholderView icon={<Leaf className="w-16 h-16"/>} title="Efficientamento" description="Fotovoltaico e soluzioni Green." />;
          case Sector.MOBILITY:
              return <PlaceholderView icon={<Car className="w-16 h-16"/>} title="Mobilità" description="Noleggio a Lungo Termine." />;
          default:
              return <div>Sezione non trovata</div>;
      }
  };

  const SidebarItem: React.FC<{ 
      icon: React.ReactNode, 
      label: string, 
      active: boolean,
      onClick: () => void 
  }> = ({ icon, label, active, onClick }) => (
      <button 
          onClick={() => { onClick(); setIsSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              active 
              ? 'bg-brand-accent text-brand-dark font-bold shadow-lg' 
              : 'text-gray-400 hover:bg-white/10 hover:text-white'
          }`}
      >
          {icon}
          <span className="text-sm">{label}</span>
      </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-brand-dark text-white transform transition-transform duration-300 ease-in-out shadow-2xl
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:relative md:flex md:flex-col
      `}>
          <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-accent rounded-lg flex items-center justify-center font-bold text-brand-dark text-xl">MT</div>
                  <div className="leading-tight">
                      <div className="font-bold">DealerAI</div>
                      <div className="text-[10px] text-gray-400">Suites Multi-Agency</div>
                  </div>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400"><X className="w-6 h-6" /></button>
          </div>

          <div className="px-4 py-2 flex-1 overflow-y-auto space-y-6">
              <div>
                  <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-2">Operativo</div>
                  <nav className="space-y-1">
                      <SidebarItem icon={<FolderOpen className="w-5 h-5"/>} label="CRM & Anagrafica" active={activeSector === Sector.CRM} onClick={() => setActiveSector(Sector.CRM)} />
                      <SidebarItem icon={<Zap className="w-5 h-5"/>} label="Energia & Gas" active={activeSector === Sector.ENERGY} onClick={() => setActiveSector(Sector.ENERGY)} />
                      <SidebarItem icon={<Smartphone className="w-5 h-5"/>} label="Telefonia" active={activeSector === Sector.TELEPHONY} onClick={() => setActiveSector(Sector.TELEPHONY)} />
                  </nav>
              </div>

              <div>
                  <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-2">Servizi Extra</div>
                  <nav className="space-y-1">
                      <SidebarItem icon={<Leaf className="w-5 h-5"/>} label="Efficientamento" active={activeSector === Sector.EFFICIENCY} onClick={() => setActiveSector(Sector.EFFICIENCY)} />
                      <SidebarItem icon={<Car className="w-5 h-5"/>} label="Mobilità (NLT)" active={activeSector === Sector.MOBILITY} onClick={() => setActiveSector(Sector.MOBILITY)} />
                  </nav>
              </div>

              {currentUser.role === 'ADMIN' && (
                  <div>
                      <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-2">Sistema</div>
                      <nav className="space-y-1">
                          <SidebarItem icon={<Settings className="w-5 h-5"/>} label="Gestione Backend" active={activeSector === Sector.MANAGEMENT} onClick={() => setActiveSector(Sector.MANAGEMENT)} />
                      </nav>
                  </div>
              )}
          </div>

          <div className="p-4 bg-brand-primary/50 mt-auto border-t border-white/5">
              <div className="flex items-center gap-3 mb-4 p-2 rounded-lg bg-brand-dark/30">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${currentUser.role === 'ADMIN' ? 'bg-brand-accent text-brand-dark' : 'bg-gray-700 text-white'}`}>
                      {currentUser.full_name.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                      <p className="text-xs font-bold truncate text-white">{currentUser.full_name}</p>
                      <p className="text-[10px] text-gray-400 truncate uppercase">{currentUser.role} • {currentUser.agency_id}</p>
                  </div>
              </div>
              <button onClick={() => setCurrentUser(null)} className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition-all">
                  <LogOut className="w-4 h-4" /> Esci
              </button>
          </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b border-gray-200 p-4 flex md:hidden justify-between items-center shadow-sm z-40">
            <div className="flex items-center gap-3">
                <button onClick={() => setIsSidebarOpen(true)}><Menu className="w-6 h-6 text-brand-dark" /></button>
                <span className="font-bold text-lg text-brand-dark uppercase tracking-tight">DealerAI</span>
            </div>
            <div className="w-8 h-8 bg-brand-accent rounded-full flex items-center justify-center font-bold text-xs text-brand-dark">
                {currentUser.agency_id.substring(0,2).toUpperCase()}
            </div>
        </header>

        <main className="flex-1 overflow-y-auto p-0 md:p-6 scroll-smooth">
             {renderSectorContent()}
        </main>

        {/* Desktop Navigation Overlays for sectors */}
        <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-200 z-40">
            <div className="flex justify-around p-1">
                {activeSector === Sector.ENERGY && (
                    <>
                        <BottomNavBtn active={activeEnergyTab === EnergyTab.ANALYSIS} onClick={() => setActiveEnergyTab(EnergyTab.ANALYSIS)} icon={<Zap className="w-5 h-5"/>} label="Analisi" />
                        <BottomNavBtn active={activeEnergyTab === EnergyTab.PORTFOLIO} onClick={() => setActiveEnergyTab(EnergyTab.PORTFOLIO)} icon={<FolderOpen className="w-5 h-5"/>} label="Assets" />
                        <BottomNavBtn active={activeEnergyTab === EnergyTab.CTE} onClick={() => setActiveEnergyTab(EnergyTab.CTE)} icon={<FileText className="w-5 h-5"/>} label="Docs" />
                    </>
                )}
                {activeSector === Sector.TELEPHONY && (
                    <>
                         <BottomNavBtn active={activeTelephonyTab === TelephonyTab.ANALYSIS} onClick={() => setActiveTelephonyTab(TelephonyTab.ANALYSIS)} icon={<Zap className="w-5 h-5"/>} label="Analisi" />
                         <BottomNavBtn active={activeTelephonyTab === TelephonyTab.PORTFOLIO} onClick={() => setActiveTelephonyTab(TelephonyTab.PORTFOLIO)} icon={<FolderOpen className="w-5 h-5"/>} label="Assets" />
                         <BottomNavBtn active={activeTelephonyTab === TelephonyTab.CANVAS} onClick={() => setActiveTelephonyTab(TelephonyTab.CANVAS)} icon={<Palette className="w-5 h-5"/>} label="Canvas" />
                    </>
                )}
            </div>
        </nav>

        {activeSector === Sector.ENERGY && (
             <div className="hidden md:flex justify-center mb-6 px-6 pt-4">
                 <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 flex gap-1">
                    <DesktopTab active={activeEnergyTab === EnergyTab.ANALYSIS} onClick={() => setActiveEnergyTab(EnergyTab.ANALYSIS)} label="Nuova Analisi" icon={<Zap className="w-4 h-4"/>} />
                    <DesktopTab active={activeEnergyTab === EnergyTab.PORTFOLIO} onClick={() => setActiveEnergyTab(EnergyTab.PORTFOLIO)} label="Portafoglio" icon={<FolderOpen className="w-4 h-4"/>} />
                    <DesktopTab active={activeEnergyTab === EnergyTab.INDICES} onClick={() => setActiveEnergyTab(EnergyTab.INDICES)} label="Indici Mercato" icon={<LayoutDashboard className="w-4 h-4"/>} />
                    <DesktopTab active={activeEnergyTab === EnergyTab.CTE} onClick={() => setActiveEnergyTab(EnergyTab.CTE)} label="Archivio CTE" icon={<FileText className="w-4 h-4"/>} />
                 </div>
             </div>
        )}
        {activeSector === Sector.TELEPHONY && (
             <div className="hidden md:flex justify-center mb-6 px-6 pt-4">
                 <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 flex gap-1">
                    <DesktopTab active={activeTelephonyTab === TelephonyTab.ANALYSIS} onClick={() => setActiveTelephonyTab(TelephonyTab.ANALYSIS)} label="Analisi Risparmio" icon={<Zap className="w-4 h-4"/>} />
                    <DesktopTab active={activeTelephonyTab === TelephonyTab.PORTFOLIO} onClick={() => setActiveTelephonyTab(TelephonyTab.PORTFOLIO)} label="Portafoglio" icon={<FolderOpen className="w-4 h-4"/>} />
                    <DesktopTab active={activeTelephonyTab === TelephonyTab.CANVAS} onClick={() => setActiveTelephonyTab(TelephonyTab.CANVAS)} label="Gestione Canvas" icon={<Palette className="w-4 h-4"/>} />
                 </div>
             </div>
        )}
      </div>
    </div>
  );
};

const BottomNavBtn: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
    <button onClick={onClick} className={`flex flex-col items-center p-2 rounded-lg transition-colors w-1/4 ${active ? 'text-brand-accent bg-brand-dark/5' : 'text-gray-400'}`}>
        <div className="mb-1">{icon}</div>
        <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
    </button>
);

const DesktopTab: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${active ? 'bg-brand-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}>
        {icon}
        {label}
    </button>
);

const PlaceholderView: React.FC<{ icon: React.ReactNode, title: string, description: string }> = ({ icon, title, description }) => (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-6">{icon}</div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-500 max-w-md mx-auto mb-8">{description}</p>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Construction className="w-4 h-4" /> Sezione in sviluppo</div>
    </div>
);

export default App;
