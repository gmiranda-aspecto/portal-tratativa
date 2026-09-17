'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Building2, ExternalLink, Printer, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Vistoria {
  id: string;
  slug: string;
  empresa: string;
  unidade: string;
  data_vistoria: string;
  vistoriador: string;
  total?: number;
  respondidos?: number;
}

export default function AdminPage() {
  const [vistorias, setVistorias] = useState<Vistoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregar() {
      try {
        // Busca vistorias sem ordenar por coluna inexistente
        const { data: vList, error: errV } = await supabase
          .from('vistorias')
          .select('*');

        if (errV) {
          setErro(errV.message);
          setCarregando(false);
          return;
        }

        if (vList && vList.length > 0) {
          const completas = await Promise.all(
            vList.map(async (v) => {
              const { count: total } = await supabase
                .from('ocorrencias')
                .select('*', { count: 'exact', head: true })
                .eq('vistoria_id', v.id);

              const { count: respondidos } = await supabase
                .from('ocorrencias')
                .select('*', { count: 'exact', head: true })
                .eq('vistoria_id', v.id)
                .not('respondido_em', 'is', null);

              return { ...v, total: total || 0, respondidos: respondidos || 0 };
            })
          );
          setVistorias(completas);
        }
      } catch (err: any) {
        setErro(err?.message || 'Falha ao buscar dados');
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, []);

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-400 flex items-center justify-center font-sans text-xs">
        Carregando painel quinzenal...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            Controle de Tratativas Quinzenais
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Selecione o ciclo para auditar e gerar o relatório para campo.
          </p>
        </div>

        {erro && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Erro na consulta: {erro}</span>
          </div>
        )}

        {vistorias.length === 0 && !erro ? (
          <div className="p-8 rounded-xl border border-slate-800 bg-[#0f172a] text-center">
            <p className="text-xs text-slate-400">Nenhuma vistoria cadastrada na base de dados.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vistorias.map((v) => (
              <div
                key={v.id}
                className="p-4 rounded-xl border border-slate-800 bg-[#0f172a] flex items-center justify-between"
              >
                <div>
                  <span className="text-xs font-bold text-slate-100 block">
                    {v.empresa} — {v.unidade}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Data Base: {v.data_vistoria} • Resp: {v.vistoriador}
                  </span>
                  <span className="inline-block mt-2 font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-500/30">
                    {v.respondidos} de {v.total} respondidos
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/t/${v.slug}`}
                    target="_blank"
                    className="p-2 text-slate-400 hover:text-slate-200 text-xs border border-slate-700 rounded-lg flex items-center gap-1 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Portal
                  </Link>
                  <Link
                    href={`/admin/relatorio/${v.slug}`}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow transition"
                  >
                    <Printer className="w-3.5 h-3.5" /> Gerar PDF
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}