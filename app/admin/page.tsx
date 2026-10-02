'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  AlertCircle,
  BarChart3,
  Building2,
  Check,
  Copy,
  ExternalLink,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
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
  const [busca, setBusca] = useState('');
  const [copiado, setCopiado] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  async function carregar() {
    try {
      setErro(null);

      const { data: vList, error: errV } = await supabase
        .from('vistorias')
        .select('*');

      if (errV) throw errV;

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

        completas.sort((a, b) => {
          const da = String(a.data_vistoria || '').split('/').reverse().join('-');
          const db = String(b.data_vistoria || '').split('/').reverse().join('-');
          return db.localeCompare(da) || a.empresa.localeCompare(b.empresa);
        });

        setVistorias(completas);
      } else {
        setVistorias([]);
      }
    } catch (err: any) {
      setErro(err?.message || 'Falha ao buscar dados');
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return vistorias;

    return vistorias.filter((v) =>
      [v.empresa, v.unidade, v.data_vistoria, v.vistoriador]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(q))
    );
  }, [vistorias, busca]);

  async function copiarAnalitico(v: Vistoria) {
    const url = `${window.location.origin}/analitico/${v.slug}`;
    await navigator.clipboard.writeText(url);
    setCopiado(v.id);
    window.setTimeout(() => setCopiado(null), 1800);
  }

  async function excluirVistoria(v: Vistoria) {
    const confirmacao = window.confirm(
      `Excluir definitivamente esta vistoria?\n\n${v.empresa} — ${v.unidade}\nData: ${v.data_vistoria}\n\nIsso também excluirá as ocorrências e o histórico de tratativas vinculados a este ciclo. Esta ação não pode ser desfeita.`
    );

    if (!confirmacao) return;

    try {
      setExcluindo(v.id);
      setErro(null);

      const { data: ocorrencias, error: errOcorrencias } = await supabase
        .from('ocorrencias')
        .select('id')
        .eq('vistoria_id', v.id);

      if (errOcorrencias) throw errOcorrencias;

      const ids = (ocorrencias || []).map((o: any) => o.id);

      if (ids.length > 0) {
        const { error: errHistorico } = await supabase
          .from('tratativas_historico')
          .delete()
          .in('ocorrencia_id', ids);

        if (errHistorico) throw errHistorico;

        const { error: errItens } = await supabase
          .from('ocorrencias')
          .delete()
          .eq('vistoria_id', v.id);

        if (errItens) throw errItens;
      }

      const { error: errVistoria } = await supabase
        .from('vistorias')
        .delete()
        .eq('id', v.id);

      if (errVistoria) throw errVistoria;

      setVistorias((atual) => atual.filter((item) => item.id !== v.id));
    } catch (err: any) {
      setErro(
        `Não foi possível excluir "${v.empresa} — ${v.unidade}": ${
          err?.message || 'erro desconhecido'
        }`
      );
    } finally {
      setExcluindo(null);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-400 flex items-center justify-center font-sans text-xs">
        Carregando painel quinzenal...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-5 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              Controle de Tratativas Quinzenais
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Gestão dos ciclos publicados, tratativas e relatórios.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar empresa, unidade, data..."
              className="w-full bg-[#0f172a] border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-3">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Ciclos</span>
            <strong className="block text-lg text-slate-100 mt-1">{vistorias.length}</strong>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-3">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Ocorrências</span>
            <strong className="block text-lg text-slate-100 mt-1">
              {vistorias.reduce((acc, v) => acc + (v.total || 0), 0)}
            </strong>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-3 col-span-2 md:col-span-1">
            <span className="text-[10px] uppercase tracking-wide text-slate-500">Respondidas</span>
            <strong className="block text-lg text-emerald-400 mt-1">
              {vistorias.reduce((acc, v) => acc + (v.respondidos || 0), 0)}
            </strong>
          </div>
        </div>

        {erro && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        {vistorias.length === 0 && !erro ? (
          <div className="p-8 rounded-xl border border-slate-800 bg-[#0f172a] text-center">
            <p className="text-xs text-slate-400">Nenhuma vistoria cadastrada na base de dados.</p>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="p-8 rounded-xl border border-slate-800 bg-[#0f172a] text-center">
            <p className="text-xs text-slate-400">Nenhum ciclo encontrado para essa busca.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtradas.map((v) => {
              const total = v.total || 0;
              const respondidos = v.respondidos || 0;
              const completo = total > 0 && respondidos === total;
              const percentual = total > 0 ? Math.round((respondidos / total) * 100) : 0;

              return (
                <div
                  key={v.id}
                  className="p-4 rounded-xl border border-slate-800 bg-[#0f172a] hover:border-slate-700 transition"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-slate-100 block truncate">
                        {v.empresa}
                      </span>
                      <span className="text-xs font-semibold text-slate-300 block mt-0.5">
                        {v.unidade}
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-1">
                        {v.data_vistoria} • {v.vistoriador}
                      </span>

                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                            completo
                              ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30'
                              : 'bg-slate-900 text-slate-300 border-slate-700'
                          }`}
                        >
                          {respondidos} de {total} respondidos
                        </span>
                        <span className="text-[10px] text-slate-500">{percentual}%</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Link
                        href={`/t/${v.slug}`}
                        target="_blank"
                        className="px-3 py-2 text-slate-300 hover:text-white text-xs border border-slate-700 hover:border-slate-600 rounded-lg flex items-center gap-1.5 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Portal
                      </Link>

                      <Link
                        href={`/analitico/${v.slug}`}
                        target="_blank"
                        className="px-3 py-2 bg-cyan-950/40 hover:bg-cyan-950/70 border border-cyan-800/60 text-cyan-100 font-bold text-xs rounded-lg flex items-center gap-1.5 transition"
                      >
                        <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                        Analítico
                      </Link>

                      <button
                        type="button"
                        onClick={() => copiarAnalitico(v)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs rounded-lg flex items-center gap-1.5 transition"
                        title="Copiar link público do relatório analítico"
                      >
                        {copiado === v.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiado === v.id ? 'Copiado' : 'Copiar link'}
                      </button>

                      <Link
                        href={`/admin/relatorio/${v.slug}`}
                        target="_blank"
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Relatório PDF
                      </Link>

                      <button
                        type="button"
                        onClick={() => excluirVistoria(v)}
                        disabled={excluindo === v.id}
                        className="p-2.5 text-slate-500 hover:text-rose-300 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900 rounded-lg transition disabled:opacity-50"
                        title="Excluir este ciclo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
