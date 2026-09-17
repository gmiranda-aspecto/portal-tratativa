'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Printer, Copy, Check, BarChart3, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function RelatorioAnaliticoPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [vistoria, setVistoria] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    async function carregar() {
      if (!slug) return;
      const { data: v } = await supabase.from('vistorias').select('*').eq('slug', slug).single();
      if (v) {
        setVistoria(v);
        const { data: o } = await supabase
          .from('ocorrencias')
          .select('*, historico:tratativas_historico(*)')
          .eq('vistoria_id', v.id)
          .order('id_oficial');
        setItens(o || []);
      }
    }
    carregar();
  }, [slug]);

  const copiarTabelaTSV = () => {
    if (!itens.length) return;
    const cabecalho = "ID\tAspecto\tSeveridade\tDiagnóstico\tDiretriz\tStatus\tÚltimo Responsável\tParecer do Cliente\tData Resposta\n";
    const linhas = itens.map(i => 
      `${i.id_oficial}\t${i.sigla}\t${i.severidade}\t${(i.apontamento || '').replace(/\n/g, ' ')}\t${(i.recomendacao || '').replace(/\n/g, ' ')}\t${i.status_tratativa || 'Sem tratativa'}\t${i.responsavel_nome || '-'}\t${(i.parecer_cliente || '').replace(/\n/g, ' ')}\t${i.respondido_em ? new Date(i.respondido_em).toLocaleDateString('pt-BR') : '-'}`
    ).join('\n');

    navigator.clipboard.writeText(cabecalho + linhas);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  if (!vistoria) return <div className="p-8 text-xs font-mono text-slate-400">Compilando dados analíticos...</div>;

  const total = itens.length;
  const regularizados = itens.filter(i => i.status_tratativa?.toLowerCase().includes('regularizado')).length;
  const respondidos = itens.filter(i => !!i.respondido_em).length;
  const graves = itens.filter(i => i.severidade === 'Grave').length;
  const gravesTratados = itens.filter(i => i.severidade === 'Grave' && !!i.respondido_em).length;

  return (
    <div className="bg-white text-slate-900 font-sans min-h-screen p-8 print:p-0">
      {/* Barra Superior */}
      <div className="max-w-6xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link href="/admin" className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
        </Link>
        <div className="flex gap-2">
          <button onClick={copiarTabelaTSV} className="px-3 py-1.5 border border-slate-300 text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-slate-50">
            {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? 'Copiado para o Excel!' : 'Copiar p/ Excel (TSV)'}
          </button>
          <button onClick={() => window.print()} className="px-4 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-slate-800">
            <Printer className="w-3.5 h-3.5" /> Imprimir A4 Analítico
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto print:max-w-full">
        {/* Cabeçalho */}
        <div className="border-b-2 border-slate-900 pb-3 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-base font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                Painel Analítico de Conformidade e Acompanhamento Quinzenal
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                <strong>Empreendimento:</strong> {vistoria.empresa} — {vistoria.unidade} | <strong>Ciclo:</strong> {vistoria.data_vistoria} | <strong>Auditor:</strong> {vistoria.vistoriador}
              </p>
            </div>
            <span className="text-[10px] font-mono text-slate-500">Emitido em {new Date().toLocaleDateString('pt-BR')}</span>
          </div>

          {/* Cards Rápidos de Indicadores */}
          <div className="grid grid-cols-4 gap-3 mt-4">
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded">
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Total de Apontamentos</span>
              <span className="text-xl font-black text-slate-900">{total}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded">
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Manifestações Recebidas</span>
              <span className="text-xl font-black text-emerald-700">{respondidos} ({total ? Math.round((respondidos/total)*100) : 0}%)</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded">
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Efetivamente Regularizados</span>
              <span className="text-xl font-black text-blue-700">{regularizados}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded">
              <span className="text-[9px] uppercase font-bold text-slate-500 block">Desvios Graves Tratados</span>
              <span className="text-xl font-black text-rose-700">{gravesTratados} / {graves}</span>
            </div>
          </div>
        </div>

        {/* Tabela Analítica Compacta */}
        <table className="w-full text-left border-collapse text-[10px]">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 uppercase font-bold text-slate-700">
              <th className="p-2 w-14">ID</th>
              <th className="p-2 w-12">Cat</th>
              <th className="p-2 w-16">Grau</th>
              <th className="p-2">Diagnóstico Técnico</th>
              <th className="p-2 w-32">Status da Ação</th>
              <th className="p-2 w-28">Responsável</th>
              <th className="p-2 w-64">Parecer do Empreendimento</th>
              <th className="p-2 w-16 text-center">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {itens.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="p-2 font-mono font-bold">{item.id_oficial}</td>
                <td className="p-2 font-bold text-slate-600">{item.sigla}</td>
                <td className="p-2">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${item.severidade === 'Grave' ? 'bg-rose-100 text-rose-800' : (item.severidade === 'Moderado' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700')}`}>
                    {item.severidade}
                  </span>
                </td>
                <td className="p-2 leading-tight text-slate-800 max-w-xs">{item.apontamento}</td>
                <td className="p-2 font-semibold text-slate-700 text-[9px] leading-tight">
                  {item.status_tratativa || <span className="text-slate-400 italic">Pendente</span>}
                </td>
                <td className="p-2 text-slate-600 leading-tight">
                  {item.responsavel_nome ? (
                    <div>
                      <span className="font-bold text-slate-800 block">{item.responsavel_nome}</span>
                      <span className="text-[9px] text-slate-500">{item.responsavel_cargo || item.setor_designado}</span>
                    </div>
                  ) : '-'}
                </td>
                <td className="p-2 text-slate-700 leading-tight">
                  {item.parecer_cliente || <span className="text-slate-400 italic">Sem manifestação</span>}
                </td>
                <td className="p-2 font-mono text-[9px] text-slate-500 text-center">
                  {item.respondido_em ? new Date(item.respondido_em).toLocaleDateString('pt-BR') : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}