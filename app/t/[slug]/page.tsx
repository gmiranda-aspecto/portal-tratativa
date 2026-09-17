'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  CheckCircle2, Clock, Upload, Trash2, ShieldAlert, 
  Building2, UserCheck, History, X, Filter, Check, ZoomIn
} from 'lucide-react';

interface HistoricoTratativa {
  id: string;
  autor_nome: string;
  autor_cargo?: string;
  status_definido: string;
  parecer?: string;
  foto_comprovacao_url?: string;
  criado_em: string;
}

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
  respondido_em?: string;
  historico?: HistoricoTratativa[];
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
  "Designar ao responsável do turno / terminal",
  "Outro"
];

export default function PaginaTratativa() {
  const params = useParams();
  const slug = params?.slug as string;

  const [vistoria, setVistoria] = useState<Vistoria | null>(null);
  const [itens, setItens] = useState<Ocorrencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  // Múltiplos arquivos e previews locais por ocorrência
  const [arquivosPorItem, setArquivosPorItem] = useState<{ [key: string]: File[] }>({});
  const [previewsLocais, setPreviewsLocais] = useState<{ [key: string]: string[] }>({});

  // Identificação Global do Respondente
  const [nomeGlobal, setNomeGlobal] = useState('');
  const [cargoGlobal, setCargoGlobal] = useState('');
  const [editandoPerfil, setEditandoPerfil] = useState(false);

  // Filtros dinâmicos
  const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendentes' | 'respondidas'>('todas');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');

  // Modal para tela cheia / Lightbox
  const [imagemModal, setImagemModal] = useState<string | null>(null);

  useEffect(() => {
    const nSalvo = localStorage.getItem('vistoria_respondente_nome') || '';
    const cSalvo = localStorage.getItem('vistoria_respondente_cargo') || '';
    setNomeGlobal(nSalvo);
    setCargoGlobal(cSalvo);
    if (!nSalvo) setEditandoPerfil(true);

    async function carregarDados() {
      if (!slug) return;
      const { data: v } = await supabase.from('vistorias').select('*').eq('slug', slug).single();

      if (!v) {
        setCarregando(false);
        return;
      }
      setVistoria(v);

      const { data: o } = await supabase
        .from('ocorrencias')
        .select('*, historico:tratativas_historico(*)')
        .eq('vistoria_id', v.id)
        .order('id_oficial', { ascending: true });

      if (o) {
        o.forEach(item => {
          if (item.historico) {
            item.historico.sort((a: any, b: any) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
          }
        });
        setItens(o);
      }
      setCarregando(false);
    }
    carregarDados();
  }, [slug]);

  const salvarPerfilGlobal = () => {
    if (!nomeGlobal.trim()) {
      alert("Por favor, digite seu Nome para continuar.");
      return;
    }
    localStorage.setItem('vistoria_respondente_nome', nomeGlobal.trim());
    localStorage.setItem('vistoria_respondente_cargo', cargoGlobal.trim());
    setEditandoPerfil(false);
  };

  const atualizarItemLocal = (id: string, campo: keyof Ocorrencia, valor: any) => {
    setItens(prev => prev.map(item => item.id === id ? { ...item, [campo]: valor } : item));
  };

  // Gerenciamento de Múltiplos Arquivos
  const adicionarArquivos = (id: string, novos: FileList | null) => {
    if (!novos || novos.length === 0) return;
    const novosArr = Array.from(novos);

    setArquivosPorItem(prev => ({
      ...prev,
      [id]: [...(prev[id] || []), ...novosArr]
    }));

    const novosPreviews = novosArr.map(f => URL.createObjectURL(f));
    setPreviewsLocais(prev => ({
      ...prev,
      [id]: [...(prev[id] || []), ...novosPreviews]
    }));
  };

  const removerArquivoNovo = (id: string, index: number) => {
    setArquivosPorItem(prev => ({
      ...prev,
      [id]: (prev[id] || []).filter((_, i) => i !== index)
    }));
    setPreviewsLocais(prev => ({
      ...prev,
      [id]: (prev[id] || []).filter((_, i) => i !== index)
    }));
  };

  const removerFotoJaSalva = (id: string, urlParaRemover: string) => {
    setItens(prev => prev.map(it => {
      if (it.id === id) {
        const urlsAtuais = (it.foto_comprovacao_url || '')
          .split(',')
          .map(u => u.trim())
          .filter(u => u && u !== urlParaRemover);
        return { ...it, foto_comprovacao_url: urlsAtuais.join(',') };
      }
      return it;
    }));
  };

  const salvarTratativa = async (item: Ocorrencia) => {
    if (!nomeGlobal.trim()) {
      setEditandoPerfil(true);
      alert("Por favor, informe seu Nome no topo da página antes de salvar.");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSalvandoId(item.id);

    try {
      // 1. Pega as fotos existentes já salvas
      const fotosExistentes = (item.foto_comprovacao_url || '')
        .split(',')
        .map(u => u.trim())
        .filter(Boolean);

      // 2. Sobe as novas fotos selecionadas para o Supabase Storage
      const novosArquivos = arquivosPorItem[item.id] || [];
      const urlsNovas: string[] = [];

      for (let i = 0; i < novosArquivos.length; i++) {
        const f = novosArquivos[i];
        const nomeFinal = `${item.id_oficial}_${Date.now()}_${i}_${f.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const { data: up, error: errUp } = await supabase.storage
          .from('evidencias-tratativas')
          .upload(nomeFinal, f);

        if (!errUp && up) {
          const { data: pub } = supabase.storage.from('evidencias-tratativas').getPublicUrl(up.path);
          urlsNovas.push(pub.publicUrl);
        }
      }

      const todasUrls = [...fotosExistentes, ...urlsNovas].join(',');

      // 3. Atualiza na tabela 'ocorrencias'
      await supabase
        .from('ocorrencias')
        .update({
          status_tratativa: item.status_tratativa || OPCOES_STATUS[0],
          parecer_cliente: item.parecer_cliente || '',
          foto_comprovacao_url: todasUrls,
          responsavel_nome: nomeGlobal.trim(),
          responsavel_cargo: cargoGlobal.trim(),
          respondido_em: new Date().toISOString()
        })
        .eq('id', item.id);

      // 4. Insere no Histórico
      const novoHistorico = {
        ocorrencia_id: item.id,
        autor_nome: nomeGlobal.trim(),
        autor_cargo: cargoGlobal.trim(),
        status_definido: item.status_tratativa || OPCOES_STATUS[0],
        parecer: item.parecer_cliente || '',
        foto_comprovacao_url: todasUrls
      };

      const { data: histCriado } = await supabase
        .from('tratativas_historico')
        .insert(novoHistorico)
        .select()
        .single();

      // Limpa os arquivos temporários locais desse item
      setArquivosPorItem(prev => { const c = { ...prev }; delete c[item.id]; return c; });
      setPreviewsLocais(prev => { const c = { ...prev }; delete c[item.id]; return c; });

      // Atualiza o estado local do card
      setItens(prev => prev.map(it => {
        if (it.id === item.id) {
          return {
            ...it,
            status_tratativa: item.status_tratativa || OPCOES_STATUS[0],
            foto_comprovacao_url: todasUrls,
            responsavel_nome: nomeGlobal.trim(),
            responsavel_cargo: cargoGlobal.trim(),
            respondido_em: new Date().toISOString(),
            historico: [histCriado || novoHistorico, ...(it.historico || [])]
          };
        }
        return it;
      }));

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
          <p className="text-xs text-slate-400 mt-2">Verifique o endereço fornecido ou contate a equipe técnica.</p>
        </div>
      </div>
    );
  }

  // Lista dinâmica de categorias para os filtros com contador
  const categoriasContador: { [sigla: string]: number } = {};
  itens.forEach(i => {
    const s = i.sigla || 'OUTRO';
    categoriasContador[s] = (categoriasContador[s] || 0) + 1;
  });
  const categoriasDisponiveis = Object.keys(categoriasContador).sort();

  // Aplica filtros combinados (Status + Categoria)
  const itensFiltrados = itens.filter(i => {
    const matchStatus = 
      filtroStatus === 'pendentes' ? !i.respondido_em :
      filtroStatus === 'respondidas' ? !!i.respondido_em : true;

    const matchCategoria = 
      filtroCategoria === 'TODAS' ? true : (i.sigla === filtroCategoria);

    return matchStatus && matchCategoria;
  });

  const concluidos = itens.filter(i => !!i.respondido_em).length;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans pb-24">
      
      {/* CABEÇALHO FIXO COM SESSÃO DO RESPONDENTE */}
      <header className="bg-[#0f172a] border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <h1 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  {vistoria.empresa} — {vistoria.unidade}
                </h1>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Vistoria: {vistoria.data_vistoria} • Auditor: {vistoria.vistoriador}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 px-3 py-1.5 rounded-lg">
                {concluidos} de {itens.length} tratadas
              </span>
            </div>
          </div>

          {/* BARRA DO RESPONDENTE ATIVO */}
          <div className="pt-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            {editandoPerfil ? (
              <div className="w-full bg-[#020617] p-3 rounded-lg border border-amber-500/40 flex flex-wrap items-center gap-3">
                <span className="text-amber-400 font-bold flex items-center gap-1 text-[11px]">
                  <UserCheck className="w-4 h-4" /> Quem está respondendo agora?
                </span>
                <input
                  type="text"
                  placeholder="Seu Nome completo *"
                  value={nomeGlobal}
                  onChange={(e) => setNomeGlobal(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 flex-1 min-w-[140px] focus:outline-none focus:border-emerald-500"
                />
                <input
                  type="text"
                  placeholder="Cargo / Setor (opcional)"
                  value={cargoGlobal}
                  onChange={(e) => setCargoGlobal(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 flex-1 min-w-[140px] focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={salvarPerfilGlobal}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded flex items-center gap-1 transition"
                >
                  <Check className="w-3.5 h-3.5" /> Salvar Identificação
                </button>
              </div>
            ) : (
              <div className="w-full flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Assinando como:</span>
                  <span className="font-bold text-slate-100 font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                    {nomeGlobal} {cargoGlobal ? `(${cargoGlobal})` : ''}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditandoPerfil(true)}
                  className="text-[11px] text-amber-400 hover:underline font-semibold"
                >
                  Trocar Respondente
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ÁREA DE FILTROS (STATUS + CATEGORIAS HORIZONTAIS) */}
      <div className="max-w-5xl mx-auto px-4 mt-4 space-y-2.5 text-xs">
        
        {/* Linha 1: Status */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-semibold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          <div className="bg-slate-900 p-0.5 rounded-lg border border-slate-800 flex gap-1">
            <button
              onClick={() => setFiltroStatus('todas')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                filtroStatus === 'todas' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas ({itens.length})
            </button>
            <button
              onClick={() => setFiltroStatus('pendentes')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                filtroStatus === 'pendentes' ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pendentes ({itens.length - concluidos})
            </button>
            <button
              onClick={() => setFiltroStatus('respondidas')}
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition ${
                filtroStatus === 'respondidas' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tratadas ({concluidos})
            </button>
          </div>
        </div>

        {/* Linha 2: Categorias com rolagem horizontal livre no celular */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scroll no-wrap">
          <span className="text-slate-500 font-semibold shrink-0 text-[11px]">Categorias:</span>
          
          <button
            onClick={() => setFiltroCategoria('TODAS')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition border ${
              filtroCategoria === 'TODAS'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            TODAS ({itens.length})
          </button>

          {categoriasDisponiveis.map(cat => (
            <button
              key={cat}
              onClick={() => setFiltroCategoria(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition border ${
                filtroCategoria === cat
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {cat} ({categoriasContador[cat]})
            </button>
          ))}
        </div>

      </div>

      {/* LISTA DAS OCORRÊNCIAS */}
      <main className="max-w-5xl mx-auto px-4 mt-4 space-y-5">
        {itensFiltrados.length === 0 ? (
          <div className="p-12 text-center bg-[#0f172a] rounded-xl border border-slate-800 text-slate-400 text-xs">
            Nenhuma ocorrência com os filtros selecionados ({filtroCategoria} • {filtroStatus}).
          </div>
        ) : (
          itensFiltrados.map((item) => {
            const jaRespondido = !!item.respondido_em;
            const historico = item.historico || [];

            // Fotos já salvas na base
            const fotosSalvas = (item.foto_comprovacao_url || '')
              .split(',')
              .map(u => u.trim())
              .filter(Boolean);

            // Fotos novas em estágio local
            const previewsNovos = previewsLocais[item.id] || [];

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 sm:p-5 transition-all shadow-md ${
                  jaRespondido
                    ? 'border-emerald-500/30 bg-[#09151f]'
                    : 'border-slate-800 bg-[#0f172a]'
                }`}
              >
                {/* Header do Card */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                      {item.id_oficial}
                    </span>
                    <span className="text-xs font-bold text-slate-200 truncate max-w-[200px] sm:max-w-md">
                      {item.categoria_full}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                      item.severidade === 'Grave' ? 'bg-rose-950/40 text-rose-300 border-rose-500/40' :
                      item.severidade === 'Moderado' ? 'bg-amber-950/40 text-amber-300 border-amber-500/40' :
                      'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      {item.severidade}
                    </span>
                    {jaRespondido && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Tratada
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  {/* Coluna Visual & Diagnóstico Técnico */}
                  <div className="md:col-span-5 space-y-3">
                    {item.foto_original_url && (
                      <div 
                        onClick={() => setImagemModal(item.foto_original_url || null)}
                        className="relative rounded-lg overflow-hidden border border-slate-700 bg-black aspect-[4/3] group shadow-inner cursor-pointer"
                        title="Clique para ampliar"
                      >
                        <img 
                          src={item.foto_original_url} 
                          alt="Evidência de Campo" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <span className="px-2.5 py-1 bg-black/80 rounded text-[11px] text-white flex items-center gap-1 font-semibold">
                            <ZoomIn className="w-3.5 h-3.5" /> Clique para Ampliar
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="bg-[#020617] p-3 rounded-lg border border-slate-800/80 space-y-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Constatação em Campo:</span>
                        <p className="text-slate-200 mt-0.5 leading-relaxed">{item.apontamento}</p>
                      </div>
                      <div className="border-t border-slate-800/80 pt-2">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Recomendação Solicitada:</span>
                        <p className="text-slate-300 italic mt-0.5 leading-relaxed">{item.recomendacao}</p>
                      </div>
                    </div>
                  </div>

                  {/* Coluna da Tratativa Operacional */}
                  <div className="md:col-span-7 space-y-3.5 border-t md:border-t-0 md:border-l border-slate-800/80 md:pl-5">
                    
                    {/* Linha do Tempo de Respostas Anteriores */}
                    {historico.length > 0 && (
                      <div className="bg-[#020617] border border-slate-800 p-3 rounded-lg space-y-1.5">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <History className="w-3.5 h-3.5" /> Manifestações Registradas ({historico.length})
                        </span>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 custom-scroll">
                          {historico.map((h, hIdx) => {
                            const fotosHist = (h.foto_comprovacao_url || '').split(',').map(u => u.trim()).filter(Boolean);
                            return (
                              <div key={h.id || hIdx} className="text-xs bg-[#0f172a] p-2 rounded border border-slate-800/80 text-slate-300">
                                <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-1 mb-1 font-mono">
                                  <span><strong>{h.autor_nome}</strong> {h.autor_cargo ? `(${h.autor_cargo})` : ''}</span>
                                  <span>{new Date(h.criado_em).toLocaleDateString('pt-BR')} {new Date(h.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-[11px] font-semibold text-amber-400">Status: {h.status_definido}</p>
                                {h.parecer && <p className="text-xs text-slate-200 mt-0.5">{h.parecer}</p>}
                                {fotosHist.length > 0 && (
                                  <div className="flex gap-2 mt-1.5 flex-wrap">
                                    {fotosHist.map((fu, fIdx) => (
                                      <button 
                                        key={fIdx} 
                                        type="button" 
                                        onClick={() => setImagemModal(fu)} 
                                        className="text-[10px] text-cyan-400 underline hover:text-cyan-300 flex items-center gap-1"
                                      >
                                        <ZoomIn className="w-3 h-3" /> Foto {fIdx + 1}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Status da Ação */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Status da Ação:
                      </label>
                      <select
                        value={item.status_tratativa || OPCOES_STATUS[0]}
                        onChange={(e) => atualizarItemLocal(item.id, 'status_tratativa', e.target.value)}
                        className="w-full bg-[#020617] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
                      >
                        {OPCOES_STATUS.map(op => (
                          <option key={op} value={op}>{op}</option>
                        ))}
                      </select>
                    </div>

                    {/* Parecer / O que foi feito */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Parecer da Operação / Providência Adotada:
                      </label>
                      <textarea
                        rows={2}
                        value={item.parecer_cliente || ''}
                        onChange={(e) => atualizarItemLocal(item.id, 'parecer_cliente', e.target.value)}
                        placeholder="Ex: Resíduos recolhidos da baia, OS de manutenção aberta..."
                        className="w-full bg-[#020617] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* COMPROVAÇÃO FOTOGRÁFICA (MÚLTIPLAS FOTOS) */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Comprovação Fotográfica:
                      </span>

                      {/* Grade de Miniaturas Anexadas */}
                      <div className="flex flex-wrap gap-2.5 mb-2">
                        {/* 1. Fotos que já estavam salvas na base */}
                        {fotosSalvas.map((url, fIdx) => (
                          <div key={`salva-${fIdx}`} className="relative w-20 h-16 bg-black rounded-lg overflow-hidden border border-slate-700 shadow shrink-0 group">
                            <img 
                              src={url} 
                              alt="Comprovação salva" 
                              className="w-full h-full object-cover cursor-pointer" 
                              onClick={() => setImagemModal(url)}
                            />
                            <button
                              type="button"
                              onClick={() => removerFotoJaSalva(item.id, url)}
                              className="absolute top-1 right-1 bg-rose-600 p-1 rounded-full text-white hover:bg-rose-500 shadow"
                              title="Remover foto"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}

                        {/* 2. Fotos novas selecionadas agora */}
                        {previewsNovos.map((url, fIdx) => (
                          <div key={`nova-${fIdx}`} className="relative w-20 h-16 bg-black rounded-lg overflow-hidden border-2 border-emerald-500 shadow shrink-0 group">
                            <img 
                              src={url} 
                              alt="Nova foto" 
                              className="w-full h-full object-cover cursor-pointer" 
                              onClick={() => setImagemModal(url)}
                            />
                            <button
                              type="button"
                              onClick={() => removerArquivoNovo(item.id, fIdx)}
                              className="absolute top-1 right-1 bg-rose-600 p-1 rounded-full text-white hover:bg-rose-500 shadow"
                              title="Remover anexo"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            <span className="absolute bottom-0 inset-x-0 bg-emerald-600 text-slate-950 font-bold text-[8px] text-center uppercase tracking-wider">
                              Novo
                            </span>
                          </div>
                        ))}

                        {/* Botão para adicionar mais fotos */}
                        <label className="flex flex-col items-center justify-center w-20 h-16 rounded-lg bg-slate-900 hover:bg-slate-800 border border-dashed border-slate-600 cursor-pointer text-slate-400 hover:text-slate-200 transition">
                          <Upload className="w-4 h-4 text-emerald-400 mb-0.5" />
                          <span className="text-[9px] font-bold">+ Foto</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => adicionarArquivos(item.id, e.target.files)}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Botão de Salvar individual */}
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        disabled={salvandoId === item.id}
                        onClick={() => salvarTratativa(item)}
                        className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-slate-950 font-bold text-xs rounded-lg transition shadow flex items-center justify-center gap-1.5"
                      >
                        {salvandoId === item.id ? (
                          <>
                            <Clock className="w-3.5 h-3.5 animate-spin" />
                            <span>Salvando...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Salvar Tratativa</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* MODAL LIGHTBOX EM TELA CHEIA (AMPLIAÇÃO RÁPIDA E CLARA) */}
      {imagemModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 p-4 flex flex-col items-center justify-center animate-fadeIn"
          onClick={() => setImagemModal(null)}
        >
          <button
            type="button"
            onClick={() => setImagemModal(null)}
            className="absolute top-4 right-4 p-2.5 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full flex items-center gap-1 text-xs font-bold transition"
          >
            <X className="w-5 h-5" />
          </button>
          
          <img 
            src={imagemModal} 
            alt="Evidência Ampliada" 
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-slate-800"
            onClick={(e) => e.stopPropagation()} 
          />
          <span className="text-slate-400 text-xs mt-3 select-none">Toque no 'X' ou fora da foto para fechar</span>
        </div>
      )}

    </div>
  );
}