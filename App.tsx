
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Zap, FileText, Users, LogOut, Briefcase, Menu, X, Smartphone, Leaf, Car, Construction, FolderOpen, Search, Palette, Settings, ChevronDown, ChevronRight, BarChart3, Home } from 'lucide-react';
import AnalysisTab from './components/AnalysisTab';
import IndicesTab from './components/IndicesTab';
import CteManagerTab from './components/CteManagerTab';
import ConsumerTab from './components/ConsumerTab';
import BusinessTab from './components/BusinessTab';
import EnergyPortfolio from './components/EnergyPortfolio';
import TelephonyPortfolio from './components/TelephonyPortfolio';
import CanvasManagerTab from './components/CanvasManagerTab';
import TelephonyAnalysisTab from './components/TelephonyAnalysisTab';
import ManagementTab from './components/ManagementTab';
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
  
  // Navigation State
  const [activeSector, setActiveSector] = useState<Sector>(Sector.CRM);
  const [activeEnergyTab, setActiveEnergyTab] = useState<EnergyTab>(EnergyTab.ANALYSIS);
  const [activeTelephonyTab, setActiveTelephonyTab] = useState<TelephonyTab>(TelephonyTab.ANALYSIS);
  const [activeCrmTab, setActiveCrmTab] = useState<CrmTab>(CrmTab.CONSUMERS);
  
  // UI State
  const [expandedMenu, setExpandedMenu] = useState<string>('CRM'); // Default open menu
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

  const isAdmin = currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'AGENCY_ADMIN';

  const toggleMenu = (menuName: string) => {
      setExpandedMenu(expandedMenu === menuName ? '' : menuName);
  };

  const handleNavigation = (sector: Sector, tabSetter?: (val: any) => void, tabValue?: any) => {
      setActiveSector(sector);
      if (tabSetter && tabValue) {
          tabSetter(tabValue);
      }
  };

  const renderSectorContent = () => {
      switch (activeSector) {
          case Sector.CRM:
              return (
                <div className="animate-in fade-in duration-500">
                   {activeCrmTab === CrmTab.CONSUMERS && <ConsumerTab user={currentUser} />}
                   {activeCrmTab === CrmTab.BUSINESS && <BusinessTab user={currentUser} />}
                </div>
              );
          case Sector.ENERGY:
              return (
                <div className="animate-in fade-in duration-500">
                    {activeEnergyTab === EnergyTab.ANALYSIS && <AnalysisTab indices={indices} user={currentUser} />}
                    {activeEnergyTab === EnergyTab.PORTFOLIO && <EnergyPortfolio user={currentUser} />}
                    {activeEnergyTab === EnergyTab.INDICES && <IndicesTab data={indices} onRefresh={() => loadIndices(true)} loading={loadingIndices} />}
                    {activeEnergyTab === EnergyTab.CTE && <CteManagerTab user={currentUser} />}
                </div>
              );
          case Sector.TELEPHONY:
              return (
                <div className="animate-in fade-in duration-500">
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

  // --- Subcomponents for Menu ---

  const MenuGroup: React.FC<{ 
      title: string, 
      icon: React.ReactNode, 
      id: string,
      isActive: boolean
  }> = ({ title, icon, id, isActive }) => (
      <button 
          onClick={() => toggleMenu(id)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all mb-1 group ${isActive ? 'bg-white/10 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
      >
          <div className="flex items-center gap-3">
              {icon}
              <span className="text-sm font-bold tracking-wide">{title}</span>
          </div>
          {expandedMenu === id ? <ChevronDown className="w-4 h-4 opacity-50"/> : <ChevronRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 transition-transform"/>}
      </button>
  );

  const SubMenuItem: React.FC<{ 
      label: string, 
      active: boolean, 
      onClick: () => void 
  }> = ({ label, active, onClick }) => (
      <button 
          onClick={onClick}
          className={`w-full flex items-center gap-3 pl-12 pr-4 py-2 text-sm transition-all border-l-2 ml-5 ${
              active 
              ? 'border-brand-accent text-white font-medium bg-gradient-to-r from-brand-accent/10 to-transparent' 
              : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500'
          }`}
      >
          {label}
      </button>
  );

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-72 bg-brand-dark text-white flex flex-col flex-shrink-0 shadow-2xl z-50">
          {/* Logo Area */}
          <div className="p-6 flex items-center gap-3 border-b border-white/5 h-24">
              <div className="w-12 h-12 bg-gradient-to-br from-brand-accent to-teal-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow-lg shadow-brand-accent/20">MT</div>
              <div className="leading-tight">
                  <div className="font-bold tracking-wide text-lg text-white">DealerAI</div>
                  <div className="text-[10px] text-brand-accent font-bold uppercase tracking-widest">Enterprise Suite</div>
              </div>
          </div>

          {/* Scrollable Menu */}
          <div className="px-4 py-6 flex-1 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              
              {/* SECTION: CRM */}
              <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-4">Anagrafica</div>
                  <MenuGroup 
                      title="CRM Clienti" 
                      icon={<FolderOpen className="w-5 h-5"/>} 
                      id="CRM"
                      isActive={activeSector === Sector.CRM}
                  />
                  {expandedMenu === 'CRM' && (
                      <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                          <SubMenuItem 
                              label="Privati & Famiglie" 
                              active={activeSector === Sector.CRM && activeCrmTab === CrmTab.CONSUMERS} 
                              onClick={() => handleNavigation(Sector.CRM, setActiveCrmTab, CrmTab.CONSUMERS)}
                          />
                          <SubMenuItem 
                              label="Aziende & P.IVA" 
                              active={activeSector === Sector.CRM && activeCrmTab === CrmTab.BUSINESS} 
                              onClick={() => handleNavigation(Sector.CRM, setActiveCrmTab, CrmTab.BUSINESS)}
                          />
                      </div>
                  )}
              </div>

              {/* SECTION: CORE BUSINESS */}
              <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-4">Business Units</div>
                  
                  {/* Energy Group */}
                  <MenuGroup 
                      title="Energia & Gas" 
                      icon={<Zap className="w-5 h-5"/>} 
                      id="ENERGY"
                      isActive={activeSector === Sector.ENERGY}
                  />
                  {expandedMenu === 'ENERGY' && (
                      <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                          <SubMenuItem 
                              label="Nuova Analisi" 
                              active={activeSector === Sector.ENERGY && activeEnergyTab === EnergyTab.ANALYSIS} 
                              onClick={() => handleNavigation(Sector.ENERGY, setActiveEnergyTab, EnergyTab.ANALYSIS)}
                          />
                          <SubMenuItem 
                              label="Portafoglio Attivo" 
                              active={activeSector === Sector.ENERGY && activeEnergyTab === EnergyTab.PORTFOLIO} 
                              onClick={() => handleNavigation(Sector.ENERGY, setActiveEnergyTab, EnergyTab.PORTFOLIO)}
                          />
                          <SubMenuItem 
                              label="Listini CTE" 
                              active={activeSector === Sector.ENERGY && activeEnergyTab === EnergyTab.CTE} 
                              onClick={() => handleNavigation(Sector.ENERGY, setActiveEnergyTab, EnergyTab.CTE)}
                          />
                          <SubMenuItem 
                              label="Indici Mercato" 
                              active={activeSector === Sector.ENERGY && activeEnergyTab === EnergyTab.INDICES} 
                              onClick={() => handleNavigation(Sector.ENERGY, setActiveEnergyTab, EnergyTab.INDICES)}
                          />
                      </div>
                  )}

                  {/* Telephony Group */}
                  <MenuGroup 
                      title="Telefonia" 
                      icon={<Smartphone className="w-5 h-5"/>} 
                      id="TELEPHONY"
                      isActive={activeSector === Sector.TELEPHONY}
                  />
                  {expandedMenu === 'TELEPHONY' && (
                      <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                          <SubMenuItem 
                              label="Analisi Risparmio" 
                              active={activeSector === Sector.TELEPHONY && activeTelephonyTab === TelephonyTab.ANALYSIS} 
                              onClick={() => handleNavigation(Sector.TELEPHONY, setActiveTelephonyTab, TelephonyTab.ANALYSIS)}
                          />
                          <SubMenuItem 
                              label="Portafoglio Attivo" 
                              active={activeSector === Sector.TELEPHONY && activeTelephonyTab === TelephonyTab.PORTFOLIO} 
                              onClick={() => handleNavigation(Sector.TELEPHONY, setActiveTelephonyTab, TelephonyTab.PORTFOLIO)}
                          />
                          <SubMenuItem 
                              label="Canvas Offerte" 
                              active={activeSector === Sector.TELEPHONY && activeTelephonyTab === TelephonyTab.CANVAS} 
                              onClick={() => handleNavigation(Sector.TELEPHONY, setActiveTelephonyTab, TelephonyTab.CANVAS)}
                          />
                      </div>
                  )}
              </div>

              {/* SECTION: EXTRA MODULES */}
              <div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-4">Moduli Extra</div>
                  <button 
                      onClick={() => handleNavigation(Sector.EFFICIENCY)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-1 ${activeSector === Sector.EFFICIENCY ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                      <Leaf className="w-5 h-5"/>
                      <span className="text-sm font-bold tracking-wide">Green Tech</span>
                  </button>
                  <button 
                      onClick={() => handleNavigation(Sector.MOBILITY)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-1 ${activeSector === Sector.MOBILITY ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                      <Car className="w-5 h-5"/>
                      <span className="text-sm font-bold tracking-wide">Mobilità</span>
                  </button>
              </div>

              {/* SECTION: ADMIN */}
              {isAdmin && (
                  <div>
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-4">Amministrazione</div>
                      <button 
                          onClick={() => handleNavigation(Sector.MANAGEMENT)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-1 ${activeSector === Sector.MANAGEMENT ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                      >
                          <Settings className="w-5 h-5"/>
                          <span className="text-sm font-bold tracking-wide">Configurazione</span>
                      </button>
                  </div>
              )}
          </div>

          {/* User Profile Footer */}
          <div className="p-4 bg-gray-900/50 border-t border-white/5 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-white/5 border border-white/10 shadow-inner">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg ${currentUser.role === 'SUPER_ADMIN' ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white' : currentUser.role === 'AGENCY_ADMIN' ? 'bg-gradient-to-r from-brand-accent to-teal-600 text-brand-dark' : 'bg-gray-700 text-white'}`}>
                      {currentUser.full_name.charAt(0)}
                  </div>
                  <div className="overflow-hidden flex-1">
                      <p className="text-xs font-bold truncate text-white">{currentUser.full_name}</p>
                      <p className="text-[10px] text-gray-400 truncate uppercase tracking-wider font-medium">{currentUser.role.replace('_', ' ')}</p>
                  </div>
              </div>
              <button onClick={() => setCurrentUser(null)} className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all border border-transparent hover:border-red-500/30">
                  <LogOut className="w-4 h-4" /> Disconnetti
              </button>
          </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gray-50 relative">
        {/* Top Header Mobile/Desktop (Optional Breadcrumb/Title Area) */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 justify-between shadow-sm z-10">
            <div className="flex items-center gap-2 text-gray-500 text-sm font-medium">
                <Home className="w-4 h-4" />
                <ChevronRight className="w-4 h-4" />
                <span className="uppercase tracking-wider">{activeSector}</span>
            </div>
            {/* Can add search or notifications here */}
        </header>

        <main className="flex-1 overflow-y-auto scroll-smooth p-0">
             {renderSectorContent()}
        </main>
      </div>
    </div>
  );
};

const PlaceholderView: React.FC<{ icon: React.ReactNode, title: string, description: string }> = ({ icon, title, description }) => (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-6 border-4 border-white shadow-xl">{icon}</div>
        <h2 className="text-4xl font-black text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-500 max-w-md mx-auto mb-8 text-lg">{description}</p>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-6 py-3 rounded-full text-sm font-bold flex items-center gap-2"><Construction className="w-4 h-4" /> Modulo in Sviluppo</div>
    </div>
);

export default App;
