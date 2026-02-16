
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { IndicesResponse } from '../types';
import { Container, Section } from './ui/Layouts';

interface Props {
  data: IndicesResponse | null;
  onRefresh: () => void;
  loading: boolean;
}

const IndicesTab: React.FC<Props> = ({ data, onRefresh, loading }) => {
  if (!data) return <div className="p-8 text-center">Caricamento dati di mercato...</div>;

  // Transform data for chart
  const chartData = data.pun.map((punItem, idx) => ({
    month: punItem.month,
    PUN: parseFloat(punItem.value.toFixed(4)),
    PSV: parseFloat((data.psv[idx]?.value || 0).toFixed(4)),
  }));

  const isStale = (new Date().getTime() - new Date(data.updated_at).getTime()) > (30 * 24 * 60 * 60 * 1000);

  return (
    <Container>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-brand-primary">Indici di Mercato</h2>
          <p className="text-sm text-gray-500">
            Ultimo aggiornamento: {new Date(data.updated_at).toLocaleDateString()}
            {isStale && <span className="text-red-500 font-bold ml-2">(Dati obsoleti!)</span>}
          </p>
        </div>
        <button 
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded shadow hover:bg-gray-50 text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Aggiorna da A2A/GME
        </button>
      </div>

      <Section title="Andamento 12 Mesi (Media)">
        <div className="h-64 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="month" tick={{fontSize: 10}} />
              <YAxis yAxisId="left" label={{ value: '€/kWh', angle: -90, position: 'insideLeft' }} />
              <YAxis yAxisId="right" orientation="right" label={{ value: '€/Smc', angle: 90, position: 'insideRight' }} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="PUN" stroke="#2dd4bf" strokeWidth={2} dot={false} name="PUN Avg (Luce)" />
              <Line yAxisId="right" type="monotone" dataKey="PSV" stroke="#fbbf24" strokeWidth={2} dot={false} name="PSV (Gas)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-4 rounded shadow-sm">
          <div className="flex justify-between items-center mb-4">
             <h4 className="font-bold text-brand-primary">PUN (Luce) - Dettaglio Fasce</h4>
             <a href="https://www.a2a.it/assistenza/tutela-cliente/indici/indice-pun" target="_blank" rel="noreferrer" className="text-xs text-blue-600 flex items-center gap-1">
               Fonte A2A <ExternalLink className="w-3 h-3" />
             </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b text-xs">
                  <th className="pb-2">Mese</th>
                  <th className="pb-2 text-right">Avg (F0)</th>
                  <th className="pb-2 text-right text-orange-600">F1</th>
                  <th className="pb-2 text-right text-teal-600">F2</th>
                  <th className="pb-2 text-right text-indigo-600">F3</th>
                  <th className="pb-2 text-right text-purple-600">F23</th>
                </tr>
              </thead>
              <tbody>
                {data.pun.slice(-6).reverse().map((item) => (
                  <tr key={item.month} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 text-gray-800 font-mono">{item.month}</td>
                    <td className="py-2 text-right font-bold">{item.value.toFixed(4)}</td>
                    <td className="py-2 text-right text-xs text-gray-600">{item.f1?.toFixed(4) || '-'}</td>
                    <td className="py-2 text-right text-xs text-gray-600">{item.f2?.toFixed(4) || '-'}</td>
                    <td className="py-2 text-right text-xs text-gray-600">{item.f3?.toFixed(4) || '-'}</td>
                    <td className="py-2 text-right text-xs text-gray-600">{item.f23?.toFixed(4) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-4 rounded shadow-sm">
          <div className="flex justify-between items-center mb-4">
             <h4 className="font-bold text-brand-primary">PSV (Gas)</h4>
             <a href="https://www.a2a.it/assistenza/tutela-cliente/indici/indice-psv" target="_blank" rel="noreferrer" className="text-xs text-blue-600 flex items-center gap-1">
               Fonte A2A <ExternalLink className="w-3 h-3" />
             </a>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Mese</th>
                <th className="pb-2 text-right">Valore (€/Smc)</th>
              </tr>
            </thead>
            <tbody>
              {data.psv.slice(-6).reverse().map((item) => (
                <tr key={item.month} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 text-gray-800 font-mono">{item.month}</td>
                  <td className="py-2 text-right font-medium">{item.value.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Container>
  );
};

export default IndicesTab;
