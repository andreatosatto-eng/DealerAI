
import React, { useState } from 'react';
import { User } from '../types';
import * as API from '../services/mockApi';
import { Lock, Zap, ArrowRight, Loader2, User as UserIcon, AlertCircle, ShieldCheck, Briefcase } from 'lucide-react';

interface Props {
  onLogin: (user: User) => void;
}

const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const executeLogin = async (u: string, p: string) => {
    setLoading(true);
    setError(null);
    try {
      const user = await API.login(u, p);
      if (user) {
        onLogin(user);
      } else {
        setError("Credenziali non valide o utente disabilitato.");
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError("Errore di connessione al server.");
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    await executeLogin(username, password);
  };

  const handleDemoLogin = () => {
    // Standard Demo Login
    const demoUser = 'admin';
    const demoPass = 'password';
    setUsername(demoUser);
    setPassword(demoPass);
    executeLogin(demoUser, demoPass);
  };

  const handleAndreaLogin = () => {
      // Requested Specific Login
      const u = 'andrea.tosatto@mt-tech.it';
      const p = 'MT2020srl!';
      setUsername(u);
      setPassword(p);
      executeLogin(u, p);
  };

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-brand-accent/5 rounded-full blur-3xl"></div>
          <div className="absolute top-[40%] -right-[10%] w-[40%] h-[60%] bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all z-10">
        {/* Brand Header */}
        <div className="bg-brand-primary p-8 text-center relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-full opacity-10">
               <Zap className="w-64 h-64 -translate-x-10 -translate-y-10 text-white" />
           </div>
           
           <div className="relative z-10 flex flex-col items-center animate-in fade-in slide-in-from-top-4 duration-700">
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
                  placeholder="Nome Utente o Email" 
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
                className="w-full py-4 bg-brand-primary hover:bg-brand-dark text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
             >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                {loading ? 'Verifica credenziali...' : 'Accedi al Portale'}
             </button>
           </form>

           <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-2 gap-3">
              <button 
                onClick={handleDemoLogin}
                disabled={loading}
                className="col-span-1 py-3 bg-gray-100 hover:bg-brand-accent/10 text-brand-primary hover:text-brand-dark font-bold rounded-xl flex flex-col items-center justify-center gap-1 transition-colors text-xs border border-transparent hover:border-brand-accent/20"
              >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Demo Admin</span>
              </button>

              <button 
                onClick={handleAndreaLogin}
                disabled={loading}
                className="col-span-1 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl flex flex-col items-center justify-center gap-1 transition-colors text-xs border border-transparent hover:border-blue-200"
              >
                  <Briefcase className="w-4 h-4" />
                  <span>Andrea Tosatto</span>
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
