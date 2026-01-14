
import React, { useState } from 'react';
import { User } from '../types';
import * as API from '../services/mockApi';
import { Lock, Zap, ArrowRight, Loader2, User as UserIcon, AlertCircle } from 'lucide-react';

interface Props {
  onLogin: (user: User) => void;
}

const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    setLoading(true);
    setError(null);
    try {
      const user = await API.login(username, password);
      if (user) {
        onLogin(user);
      } else {
        setError("Credenziali non valide o utente disabilitato.");
      }
    } catch (err) {
      setError("Errore di connessione al server.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setUsername('admin');
    setPassword('password');
    // We let the form handle submit via useEffect or just call it
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all hover:scale-[1.01]">
        {/* Brand Header */}
        <div className="bg-brand-primary p-8 text-center relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full opacity-10">
               <Zap className="w-64 h-64 -translate-x-10 -translate-y-10 text-white" />
           </div>
           
           <div className="relative z-10 flex flex-col items-center">
             <div className="w-16 h-16 bg-brand-accent rounded-xl flex items-center justify-center mb-4 shadow-lg border-2 border-white/20">
                <span className="text-3xl font-black text-brand-dark">MT</span>
             </div>
             <h1 className="text-2xl font-bold text-white tracking-tight">MT Technology</h1>
             <p className="text-brand-accent font-semibold text-sm uppercase tracking-widest">DealerAI Suite</p>
           </div>
        </div>

        {/* Login Form */}
        <div className="p-8">
           <div className="text-center mb-8">
             <h2 className="text-gray-700 font-bold text-lg">Area Riservata</h2>
             <p className="text-gray-400 text-sm">Inserisci le credenziali per accedere al portale</p>
           </div>

           {error && (
               <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                   <AlertCircle className="w-5 h-5 shrink-0" />
                   {error}
               </div>
           )}

           <form onSubmit={handleLogin} className="space-y-4">
             <div className="relative group">
                <UserIcon className="absolute left-3 top-3.5 text-gray-400 w-5 h-5 group-focus-within:text-brand-accent transition-colors" />
                <input 
                  type="text" 
                  required
                  placeholder="Nome Utente" 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-brand-accent focus:bg-white outline-none transition-all"
                />
             </div>

             <div className="relative group">
                <Lock className="absolute left-3 top-3.5 text-gray-400 w-5 h-5 group-focus-within:text-brand-accent transition-colors" />
                <input 
                  type="password" 
                  required
                  placeholder="Password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-brand-accent focus:bg-white outline-none transition-all"
                />
             </div>
             
             <button
                type="submit"
                disabled={loading} 
                className="w-full py-4 bg-brand-primary hover:bg-brand-dark text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
             >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                {loading ? 'Accesso in corso...' : 'Accedi al Portale'}
             </button>
           </form>

           <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col gap-3">
              <button 
                onClick={handleDemoLogin}
                className="text-xs text-brand-primary font-bold hover:text-brand-accent transition-colors flex items-center justify-center gap-1"
              >
                  Usa credenziali Demo (Admin)
              </button>
              <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                Questo sistema è ad uso esclusivo dei partner autorizzati MT Technology.<br/>
                Gli accessi sono monitorati e loggati.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
