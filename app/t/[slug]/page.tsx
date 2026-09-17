'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Clock, Upload, Trash2, ShieldAlert, Building2, User } from 'lucide-react';

interface Ocorrencia {
  id: string;
  id_oficial: string;
  sigla: string;
  categoria_full: string;
  apontamento: string;
  recomendacao: string;
  severidade: string;
  foto_original_url?: string;
  status_tratativa?: string;
  parecer_cliente?: string;
  foto_comprovacao_url?: string;
  responsavel_nome?: string;
  responsavel_cargo?: string;
  setor_designado?: string;
  previsao_conclusao?: string;
  respondido_em?: string;
}

interface Vistoria {
  id: string;
  empresa: string;
  unidade: string;
  data_vistoria: string;
  vistoriador: string;
}

const OPCOES_STATUS = [
  "Ciente, regularização será providenciada",
  "Regularizado",
  "Situação de rotina operacional / monitorada",
  "Em andamento, ação corretiva em execução",
  "Permanece, depende de decisão administrativa / investimento / contratação",
  "Não aplicável",
  "Necessita reavaliação técnica",
  "Deverá ser designado ao setor responsável",
  "Designar a organização ao responsável do turno / terminal",
  "Outro"
];

export default function PaginaTratativa() {
  const params = useParams();
  const slug = params?.slug as string;

  const [vistoria, setVistoria] = useState<Vistoria | null>(null);
  const [itens, setItens] = useState<Ocorrencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<{ [key: string]: string }>({});
  const [arquivosFoto, setArquivosFoto] = useState<{ [key: string]: File }>({});

  useEffect(() => {
    async function carregarDados() {
      if (!slug) return;
      const { data: v, error: errV } = await supabase
        .from('vistorias')
        .select('*')
        .eq('slug', slug)
        .single();

      if (errV || !v) {
        setCarregando(false);
        return;
      }

      setVistoria(v);

      const { data: o } = await supabase
        .from('ocorrencias')
        .select('*')
        .eq('vistoria_id', v.id)
        .order('id_oficial', { ascending: true });

      setItens(o || []);
      setCarregando(false);
    }
    carregarDados();
  }, [slug]);

  const atualizarItemLocal = (id: string, campo: keyof Ocorrencia, valor: any) => {
    setItens(prev => prev.map(item => item.id === id ? { ...item, [campo]: valor } : item));
  };

  const selecionarArquivo = (id: string, file: File | null) => {
    if (!file) {
      setArquivosFoto(prev => {
        const copia = { ...prev };
        delete copia[id];
        return copia;
      });
      setPreviews(prev => {
        const copia = { ...prev };
        delete copia[id];
        return copia;
      });
      return;
    }
    setArquivosFoto(prev => ({ ...prev, [id]: file }));
    setPreviews(prev => ({ ...prev, [id]: URL.createObjectURL(file) }));
  };

  const salvarTratativa = async (item: Ocorrencia) => {
    setSalvandoId(item.id);

    try {
      let novaUrlFoto = item.foto_comprovacao_url || '';

      if (arquivosFoto[item.id]) {
        const f = arquivosFoto[item.id];
        const nomeFinal = `${item.id_oficial}_${Date.now()}_${f.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { data: up, error: errUp } = await supabase.storage
          .from('evidencias-tratativas')
          .upload(nomeFinal, f);

        if (!errUp && up) {
          const { data: pub } = supabase.storage
            .from('evidencias-tratativas')
            .getPublicUrl(up.path);
          novaUrlFoto = pub.publicUrl;
        }
      }

      const { error: errUpdate } = await supabase
        .from('ocorrencias')
        .update({
          status_tratativa: item.status_tratativa,
          parecer_cliente: item.parecer_cliente,
          foto_comprovacao_url: novaUrlFoto,
          responsavel_nome: item.responsavel_nome,
          responsavel_cargo: item.responsavel_cargo,
          setor_designado: item.setor_designado,
          previsao_conclusao: item.previsao_conclusao || null,
          respondido_em: new Date().toISOString()
        })
        .eq('id', item.id);

      if (!errUpdate) {
        atualizarItemLocal(item.id, 'foto_comprovacao_url', novaUrlFoto);
        atualizarItemLocal(item.id, 'respondido_em', new Date().toISOString());
      }
    } catch (err) {
      alert('Erro ao salvar tratativa.');
    } finally {
      setSalvandoId(null);
    }
  };

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 animate-spin text-emerald-500" />
          <span className="text-sm font-semibold">Carregando plano de tratativas...</span>
        </div>
      </div>
    );
  }

  if (!vistoria) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6 text-center font-sans">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h1 className="text-base font-bold text-slate-100">Vistoria Não Encontrada</h1>
          <p className="text-xs text-slate-400 mt-2">Verifique o endereço fornecido ou entre em contato com a equipe técnica.</p>
        </div>
      </div>
    );
  }

  const concluidos = itens.filter(i => !!i.respondido_em).length;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans pb-16">
      <header className="bg-[#0f172a] border-b border-slate-800 px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                {vistoria.empresa} — {vistoria.unidade}
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Vistoria realizada em {vistoria.data_vistoria} • Resp. Técnico: {vistoria.vistoriador}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 px-3 py-1.5 rounded-lg">
              {concluidos} de {itens.length} tratativas enviadas
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-6 space-y-6">
        {itens.map((item) => {
          const jaRespondido = !!item.respondido_em;
          const exigeDelegacao = item.status_tratativa?.includes("designado") || item.status_tratativa?.includes("Designar");
          const previewAtual = previews[item.id] || item.foto_comprovacao_url;

          return (
            <div
              key={item.id}
              className={`rounded-xl border p-5 transition-all ${
                jaRespondido
                  ? 'border-emerald-500/40 bg-[#09151f]'
                  : 'border-slate-800 bg-[#0f172a]'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                    {item.id_oficial}
                  </span>
                  <span className="text-xs font-bold text-amber-400">
                    {item.categoria_full}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-slate-700 bg-slate-800/60 text-slate-300">
                    {item.severidade}
                  </span>
                  {jaRespondido && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Enviado
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Constatação em Campo:</span>
                    <p className="text-xs text-slate-200 mt-1 leading-relaxed">{item.apontamento}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Diretriz Solicitada:</span>
                    <p className="text-xs italic text-slate-400 mt-1 leading-relaxed">{item.recomendacao}</p>
                  </div>
                </div>

                <div className="md:col-span-2 space-y-4 border-t md:border-t-0 md:border-l border-slate-800/80 md:pl-5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Status da Ação:
                    </label>
                    <select
                      value={item.status_tratativa || OPCOES_STATUS[0]}
                      onChange={(e) => atualizarItemLocal(item.id, 'status_tratativa', e.target.value)}
                      className="w-full bg-[#020617] border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
                    >
                      {OPCOES_STATUS.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>

                  {exigeDelegacao && (
                    <div className="bg-[#020617] p-3.5 rounded-lg border border-amber-500/30 space-y-3">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block flex items-center gap-1.5">
                        <User className="w-3 h-3" /> Informações de Delegação (Evite o Limbo)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Setor Destino *</label>
                          <input
                            type="text"
                            placeholder="Ex: Manutenção, Operação, PCM"
                            value={item.setor_designado || ''}
                            onChange={(e) => atualizarItemLocal(item.id, 'setor_designado', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Responsável Designado *</label>
                          <input
                            type="text"
                            placeholder="Nome do encarregado"
                            value={item.responsavel_nome || ''}
                            onChange={(e) => atualizarItemLocal(item.id, 'responsavel_nome', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Função / Cargo</label>
                          <input
                            type="text"
                            placeholder="Ex: Supervisor de Turno"
                            value={item.responsavel_cargo || ''}
                            onChange={(e) => atualizarItemLocal(item.id, 'responsavel_cargo', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Prazo Acordado</label>
                          <input
                            type="date"
                            value={item.previsao_conclusao || ''}
                            onChange={(e) => atualizarItemLocal(item.id, 'previsao_conclusao', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Parecer do Empreendimento / Justificativa:
                    </label>
                    <textarea
                      rows={2}
                      value={item.parecer_cliente || ''}
                      onChange={(e) => atualizarItemLocal(item.id, 'parecer_cliente', e.target.value)}
                      placeholder="Descreva as medidas implementadas ou o plano adotado..."
                      className="w-full bg-[#020617] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Evidência Fotográfica:
                    </span>
                    <div className="flex items-center gap-4">
                      {previewAtual ? (
                        <div className="relative w-28 h-20 bg-black rounded-lg overflow-hidden border border-slate-700 shadow shrink-0">
                          <img src={previewAtual} alt="Evidência" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => selecionarArquivo(item.id, null)}
                            className="absolute top-1 right-1 bg-rose-600/80 hover:bg-rose-600 p-1 rounded-full text-white"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 transition">
                          <Upload className="w-4 h-4 text-emerald-400" />
                          <span>Anexar Comprovação</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => selecionarArquivo(item.id, e.target.files?.[0] || null)}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      disabled={salvandoId === item.id}
                      onClick={() => salvarTratativa(item)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-slate-950 font-bold text-xs rounded-lg transition shadow-md flex items-center gap-1.5"
                    >
                      {salvandoId === item.id ? (
                        <>
                          <Clock className="w-3.5 h-3.5 animate-spin" />
                          <span>Salvando...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{jaRespondido ? 'Atualizar Resposta' : 'Salvar Tratativa'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}