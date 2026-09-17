'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Printer } from 'lucide-react';

export default function RelatorioImpressao() {
  const params = useParams();
  const slug = params?.slug as string;
  const [vistoria, setVistoria] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);

  useEffect(() => {
    async function carregar() {
      if (!slug) return;
      const { data: v } = await supabase.from('vistorias').select('*').eq('slug', slug).single();
      if (v) {
        setVistoria(v);
        const { data: o } = await supabase.from('ocorrencias').select('*').eq('vistoria_id', v.id).order('id_oficial');
        setItens(o || []);
      }
    }
    carregar();
  }, [slug]);

  if (!vistoria) return <div className="p-8 text-xs font-mono text-slate-500">Montando relatório...</div>;

  return (
    <div className="bg-white text-slate-900 font-sans min-h-screen p-8 print:p-0">
      {/* Botão flutuante na tela (oculto no PDF) */}
      <div className="max-w-5xl mx-auto mb-6 flex justify-end print:hidden">
        <button onClick={() => window.print()} className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow hover:bg-slate-800">
          <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
        </button>
      </div>

      <div className="max-w-5xl mx-auto border print:border-none p-8 print:p-0">
        {/* Cabeçalho Técnico */}
        <div className="border-b-2 border-slate-900 pb-3 mb-6">
          <h1 className="text-base font-bold uppercase tracking-wider text-slate-900">Relatório Executivo de Tratativas Ambientais</h1>
          <p className="text-xs text-slate-600 mt-1">
            <strong>Empreendimento:</strong> {vistoria.empresa} — {vistoria.unidade} | <strong>Data Base:</strong> {vistoria.data_vistoria} | <strong>Auditor:</strong> {vistoria.vistoriador}
          </p>
        </div>

        {/* Lista de Comparações */}
        <div className="space-y-6">
          {itens.map((item) => (
            <div key={item.id} className="border border-slate-300 rounded-lg overflow-hidden page-break-inside-avoid">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-300 flex justify-between items-center text-xs font-bold">
                <span>{item.id_oficial} — {item.categoria_full}</span>
                <span className="uppercase text-[10px] bg-white border border-slate-300 px-2 py-0.5 rounded">{item.status_tratativa || 'Sem Tratativa'}</span>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 text-xs">
                {/* Lado Esquerdo: Constatação Original */}
                <div className="space-y-2 border-r border-slate-200 pr-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Constatação em Campo</span>
                  <p className="leading-relaxed">{item.apontamento}</p>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mt-2">Diretriz Recomendada</span>
                  <p className="italic text-slate-600 leading-relaxed">{item.recomendacao}</p>
                  {item.foto_original_url && (
                    <img src={item.foto_original_url} alt="Original" className="w-full h-36 object-cover rounded border border-slate-300 mt-2" />
                  )}
                </div>

                {/* Lado Direito: Resposta do Cliente */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Parecer do Empreendimento</span>
                  <p className="leading-relaxed bg-slate-50 p-2 rounded border border-slate-200">
                    {item.parecer_cliente || 'Nenhuma manifestação registrada.'}
                  </p>
                  {item.responsavel_nome && (
                    <p className="text-[11px] text-slate-600">
                      <strong>Responsável:</strong> {item.responsavel_nome} {item.setor_designado ? `(${item.setor_designado})` : ''}
                    </p>
                  )}
                  {item.foto_comprovacao_url && (
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide block mb-1">Evidência de Regularização</span>
                      <img src={item.foto_comprovacao_url} alt="Comprovação" className="w-full h-36 object-cover rounded border border-slate-300" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}