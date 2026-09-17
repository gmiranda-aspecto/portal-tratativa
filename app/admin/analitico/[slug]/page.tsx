'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Printer, Copy, Check, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function RelatorioAnaliticoPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [vistoria, setVistoria] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [copiado, setCopiado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      if (!slug) return;
      try {
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
      } catch (err) {
        console.error(err);
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [slug]);

  if (carregando) {
    return <div className="p-8 text-xs font-mono text-slate-500">Compilando relatório analítico executivo...</div>;
  }

  if (!vistoria) {
    return <div className="p-8 text-xs font-mono text-rose-500">Vistoria não encontrada.</div>;
  }

  // =========================================================================
  // PROCESSAMENTO ESTRUTURADO DE DADOS E MÉTRICAS
  // =========================================================================
  // Consolida todas as devolutivas (do histórico ou do card principal)
  let totalDevolutivas = 0;
  const contagemStatusGeral: { [key: string]: number } = {
    'Regularizado': 0,
    'Ciente, regularização será providenciada': 0,
    'Situação de rotina operacional / monitorada': 0,
    'Designar ao responsável do turno / terminal': 0,
    'Deverá ser designado ao setor responsável': 0,
    'Permanece, depende de decisão administrativa / investimento / contratação': 0,
    'Necessita reavaliação técnica': 0,
    'Em andamento, ação corretiva em execução': 0,
    'Outro': 0
  };

  // Agrupamento por Categoria
  const categoriasMap: { [cat: string]: { itens: any[]; devolutivas: any[]; reg: number; dec: number; desig: number } } = {};

  itens.forEach((it) => {
    const cat = it.categoria_full || 'Geral';
    if (!categoriasMap[cat]) {
      categoriasMap[cat] = { itens: [], devolutivas: [], reg: 0, dec: 0, desig: 0 };
    }
    categoriasMap[cat].itens.push(it);

    // Pega as respostas do histórico ou a resposta principal
    const devList = (it.historico && it.historico.length > 0) ? it.historico : (it.respondido_em ? [{
      autor_nome: it.responsavel_nome || 'Respondente',
      autor_cargo: it.responsavel_cargo || '',
      status_definido: it.status_tratativa || 'Ciente, regularização será providenciada',
      parecer: it.parecer_cliente || it.status_tratativa
    }] : []);

    devList.forEach((d: any) => {
      totalDevolutivas++;
      const st = d.status_definido || 'Ciente, regularização será providenciada';
      if (contagemStatusGeral[st] !== undefined) contagemStatusGeral[st]++;
      else contagemStatusGeral['Outro']++;

      categoriasMap[cat].devolutivas.push({ ...d, ocorrencia: it });

      if (st.includes('Regularizado')) categoriasMap[cat].reg++;
      if (st.includes('decisão administrativa') || st.includes('investimento')) categoriasMap[cat].dec++;
      if (st.includes('designado') || st.includes('Designar')) categoriasMap[cat].desig++;
    });
  });

  const totalApontamentos = itens.length;
  const regTotal = contagemStatusGeral['Regularizado'];
  const desigTotal = contagemStatusGeral['Deverá ser designado ao setor responsável'] + contagemStatusGeral['Designar ao responsável do turno / terminal'];
  const decTotal = contagemStatusGeral['Permanece, depende de decisão administrativa / investimento / contratação'];
  const execTotal = contagemStatusGeral['Em andamento, ação corretiva em execução'];

  const percReg = totalDevolutivas > 0 ? ((regTotal / totalDevolutivas) * 100).toFixed(1) : '0.0';
  const percDesig = totalDevolutivas > 0 ? ((desigTotal / totalDevolutivas) * 100).toFixed(1) : '0.0';
  const percDec = totalDevolutivas > 0 ? ((decTotal / totalDevolutivas) * 100).toFixed(1) : '0.0';

  const maxQtdStatus = Math.max(...Object.values(contagemStatusGeral), 1);
  const maxQtdCat = Math.max(...Object.values(categoriasMap).map(c => c.itens.length), 1);

  const copiarMatrizTSV = () => {
    let tsv = "Item\tCategoria\tDiagnóstico\tRespondente\tStatus Consolidado\tDevolutiva Literal\n";
    itens.forEach(it => {
      const devList = (it.historico && it.historico.length > 0) ? it.historico : (it.respondido_em ? [{
        autor_nome: it.responsavel_nome,
        status_definido: it.status_tratativa,
        parecer: it.parecer_cliente
      }] : []);
      if (devList.length === 0) {
        tsv += `${it.id_oficial}\t${it.categoria_full}\t${(it.apontamento||'').replace(/\n/g, ' ')}\t-\tSem manifestação\t-\n`;
      } else {
        devList.forEach((d: any) => {
          tsv += `${it.id_oficial}\t${it.categoria_full}\t${(it.apontamento||'').replace(/\n/g, ' ')}\t${d.autor_nome || '-'}\t${d.status_definido || '-'}\t${(d.parecer||'').replace(/\n/g, ' ')}\n`;
        });
      }
    });
    navigator.clipboard.writeText(tsv);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div className="bg-white text-[#1e293b] font-sans min-h-screen p-10 print:p-0">
      
      {/* Barra de Ação Superior (Oculta na Impressão) */}
      <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between print:hidden">
        <Link href="/admin" className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Voltar ao Painel
        </Link>
        <div className="flex gap-2">
          <button onClick={copiarMatrizTSV} className="px-3 py-1.5 border border-slate-300 text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-slate-50">
            {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? 'Copiado TSV!' : 'Copiar p/ Excel'}
          </button>
          <button onClick={() => window.print()} className="px-4 py-1.5 bg-[#1e293b] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 hover:bg-slate-800">
            <Printer className="w-3.5 h-3.5" /> Imprimir / Salvar PDF
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-10 text-[13px] leading-relaxed text-slate-800 print:max-w-full">

        {/* CABEÇALHO DO RELATÓRIO ANALÍTICO */}
        <div className="border-b-2 border-slate-900 pb-6">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-emerald-700 block">Aspecto Ambiental</span>
              <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 mt-1">
                RELATÓRIO ANALÍTICO
              </h1>
              <p className="text-base font-semibold text-slate-600">Devolutivas das não conformidades</p>
              <p className="text-xs font-bold text-slate-800 mt-1">Vistoria técnica — {vistoria.empresa} | Unidade {vistoria.unidade}</p>
            </div>
            <div className="text-right text-xs">
              <span className="text-slate-500 block">Emissão: {new Date().toLocaleDateString('pt-BR')}</span>
              <span className="font-bold text-slate-800 block mt-1">Ref. Vistoria: {vistoria.data_vistoria}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div>
              <strong className="text-slate-500 block uppercase text-[10px]">Base analisada:</strong>
              <span className="font-bold text-slate-900">{totalApontamentos} apontamentos avaliados ({totalDevolutivas} devolutivas consolidadas)</span>
            </div>
            <div>
              <strong className="text-slate-500 block uppercase text-[10px]">Finalidade:</strong>
              <span>Consolidar as devolutivas dos colaboradores evidenciando quantidade, percentual, responsável e temas que demandam decisão, investimento, execução ou acompanhamento.</span>
            </div>
          </div>
        </div>

        {/* 1. SÍNTESE EXECUTIVA */}
        <section className="space-y-4">
          <h2 className="text-base font-black text-slate-900 uppercase border-b border-slate-200 pb-1">
            1. Síntese executiva
          </h2>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-y border-slate-300 font-bold text-slate-700">
                <th className="p-2">Indicador</th>
                <th className="p-2 w-32">Resultado</th>
                <th className="p-2">Leitura gerencial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="p-2 font-semibold">Apontamentos avaliados</td>
                <td className="p-2 font-bold">{totalApontamentos}</td>
                <td className="p-2 text-slate-600">Não conformidades distintas identificadas em campo</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold">Devolutivas recebidas</td>
                <td className="p-2 font-bold">{totalDevolutivas}</td>
                <td className="p-2 text-slate-600">Respostas e tratativas registradas no portal</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold text-emerald-800">Regularizado</td>
                <td className="p-2 font-bold text-emerald-800">{regTotal} ({percReg}%)</td>
                <td className="p-2 text-slate-600">Evidência de encerramento declarada</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold text-amber-800">Designação necessária</td>
                <td className="p-2 font-bold text-amber-800">{desigTotal} ({percDesig}%)</td>
                <td className="p-2 text-slate-600">Maior bloco; requer definição clara de dono e prazo</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold text-rose-800">Dependência administrativa / investimento</td>
                <td className="p-2 font-bold text-rose-800">{decTotal} ({percDec}%)</td>
                <td className="p-2 text-slate-600">Escalonar para decisão e priorização orçamentária</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold">Ação corretiva em execução</td>
                <td className="p-2 font-bold">{execTotal}</td>
                <td className="p-2 text-slate-600">Acompanhar prazo, evidência e eficácia</td>
              </tr>
            </tbody>
          </table>

          <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded text-xs text-amber-900 mt-3">
            <strong className="block uppercase text-[10px] tracking-wider mb-0.5">Leitura Prioritária:</strong>
            Apenas {percReg}% das devolutivas indicam regularização efetiva. Em contraste, {percDesig}% apontam necessidade de designação e {percDec}% dependem de decisão administrativa, investimento ou contratação. O principal ganho de governança está em converter “designar” em responsável nominal, prazo e evidência de conclusão.
          </div>

          {/* Gráfico de Barras Horizontais: Distribuição Geral das Devolutivas */}
          <div className="pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Distribuição geral das devolutivas</h3>
            <div className="space-y-2 text-xs">
              {Object.entries(contagemStatusGeral).map(([st, qtd]) => {
                if (qtd === 0) return null;
                const perc = totalDevolutivas > 0 ? ((qtd / totalDevolutivas) * 100).toFixed(1) : '0';
                const cor = st.includes('Regularizado') ? 'bg-emerald-600' : (st.includes('decisão') ? 'bg-rose-600' : (st.includes('designado') || st.includes('Designar') ? 'bg-amber-500' : 'bg-sky-500'));
                return (
                  <div key={st} className="grid grid-cols-12 items-center gap-2">
                    <span className="col-span-5 truncate text-slate-700 text-[11px] font-medium">{st}</span>
                    <div className="col-span-6 bg-slate-100 h-5 rounded overflow-hidden flex items-center">
                      <div className={`${cor} h-full transition-all`} style={{ width: `${(qtd / maxQtdStatus) * 100}%` }}></div>
                    </div>
                    <span className="col-span-1 text-right font-bold text-slate-900 font-mono text-[11px]">{qtd}</span>
                  </div>
                );
              })}
            </div>
            <span className="text-[10px] text-slate-400 block mt-2">Base: {totalDevolutivas} devolutivas. Percentuais detalhados no texto e nas tabelas.</span>
          </div>
        </section>

        {/* 2. PANORAMA POR CATEGORIA */}
        <section className="space-y-4 pt-6 border-t border-slate-200">
          <h2 className="text-base font-black text-slate-900 uppercase border-b border-slate-200 pb-1">
            2. Panorama por categoria
          </h2>

          {/* Gráfico Barras Horizontais por Categoria */}
          <div className="space-y-2 text-xs mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Apontamentos por categoria</h3>
            {Object.entries(categoriasMap).map(([cat, dados]) => (
              <div key={cat} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-4 truncate text-slate-700 text-[11px] font-medium">{cat}</span>
                <div className="col-span-7 bg-slate-100 h-5 rounded overflow-hidden flex items-center">
                  <div className="bg-[#3e564c] h-full" style={{ width: `${(dados.itens.length / maxQtdCat) * 100}%` }}></div>
                </div>
                <span className="col-span-1 text-right font-bold text-slate-900 font-mono text-[11px]">{dados.itens.length}</span>
              </div>
            ))}
          </div>

          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 border-y border-slate-300 font-bold text-slate-700">
                <th className="p-2">Categoria</th>
                <th className="p-2 text-center">Apontamentos</th>
                <th className="p-2 text-center">Devolutivas</th>
                <th className="p-2 text-center">Regularizado</th>
                <th className="p-2 text-center">Decisão / invest.</th>
                <th className="p-2 text-center">Designação*</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800">
              {Object.entries(categoriasMap).map(([cat, d]) => {
                const totalDevCat = d.devolutivas.length;
                const pReg = totalDevCat > 0 ? Math.round((d.reg / totalDevCat) * 100) : 0;
                const pDec = totalDevCat > 0 ? Math.round((d.dec / totalDevCat) * 100) : 0;
                const pDesig = totalDevCat > 0 ? Math.round((d.desig / totalDevCat) * 100) : 0;
                return (
                  <tr key={cat} className="hover:bg-slate-50">
                    <td className="p-2 font-semibold">{cat}</td>
                    <td className="p-2 text-center font-mono">{d.itens.length}</td>
                    <td className="p-2 text-center font-mono">{totalDevCat}</td>
                    <td className="p-2 text-center font-mono">{d.reg} ({pReg}%)</td>
                    <td className="p-2 text-center font-mono">{d.dec} ({pDec}%)</td>
                    <td className="p-2 text-center font-mono">{d.desig} ({pDesig}%)</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <span className="text-[10px] text-slate-500 block">* Designação = responsável do turno/terminal + setor responsável. Percentuais calculados sobre as devolutivas da categoria.</span>
        </section>

        {/* 3. RECOMENDAÇÕES PARA DECISÃO */}
        <section className="space-y-3 pt-6 border-t border-slate-200">
          <h2 className="text-base font-black text-slate-900 uppercase border-b border-slate-200 pb-1">
            3. Recomendações para decisão
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <strong className="text-slate-900 font-bold block mb-1">1. FORMALIZAR RESPONSÁVEIS</strong>
              <p className="text-slate-600 leading-relaxed">Para cada item classificado como designação, registrar nome/área, prazo, evidência esperada e aprovador do encerramento.</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <strong className="text-slate-900 font-bold block mb-1">2. CRIAR TRILHA DE APROVAÇÃO</strong>
              <p className="text-slate-600 leading-relaxed">Separar os itens dependentes de investimento/contratação, estimar custo, risco da postergação e data de decisão.</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <strong className="text-slate-900 font-bold block mb-1">3. VALIDAR ENCERRAMENTOS</strong>
              <p className="text-slate-600 leading-relaxed">Solicitar evidência objetiva para “Regularizado” (foto, ordem de serviço, registro de inspeção ou documento equivalente).</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded">
              <strong className="text-slate-900 font-bold block mb-1">4. TRATAR DIVERGÊNCIAS</strong>
              <p className="text-slate-600 leading-relaxed">Quando colaboradores atribuírem status diferentes ao mesmo apontamento, realizar validação com o responsável técnico e consolidar um status oficial.</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded md:col-span-2">
              <strong className="text-slate-900 font-bold block mb-1">5. ACOMPANHAR POR CADÊNCIA</strong>
              <p className="text-slate-600 leading-relaxed">Revisão semanal dos itens em execução e mensal dos itens administrativos, com indicador de prazo vencido e reincidência.</p>
            </div>
          </div>
        </section>

        {/* 4. ANÁLISE DETALHADA POR CATEGORIA E SUBCATEGORIA */}
        <section className="space-y-6 pt-6 border-t border-slate-200">
          <h2 className="text-base font-black text-slate-900 uppercase border-b border-slate-200 pb-1">
            4. Análise detalhada por categoria e subcategoria
          </h2>
          <p className="text-xs text-slate-600">
            Cada item apresenta a não conformidade, a recomendação original e as devolutivas de cada colaborador.
          </p>

          {Object.entries(categoriasMap).map(([cat, dados], catIdx) => (
            <div key={cat} className="space-y-4 pt-4">
              <div className="bg-slate-100 p-2.5 rounded border-l-4 border-slate-700">
                <h3 className="text-sm font-black text-slate-900 uppercase">
                  4.{catIdx + 1} {cat}
                </h3>
                <span className="text-[11px] font-bold text-slate-500 block mt-0.5">
                  {dados.itens.length} APONTAMENTO(S) | {dados.devolutivas.length} DEVOLUTIVAS REGISTRADAS
                </span>
              </div>

              {dados.itens.map((it) => {
                const devList = (it.historico && it.historico.length > 0) ? it.historico : (it.respondido_em ? [{
                  autor_nome: it.responsavel_nome || 'Respondente',
                  autor_cargo: it.responsavel_cargo || '',
                  status_definido: it.status_tratativa || 'Ciente, regularização será providenciada',
                  parecer: it.parecer_cliente || it.status_tratativa
                }] : []);

                return (
                  <div key={it.id} className="p-3 border border-slate-200 rounded-lg space-y-2 bg-white shadow-sm text-xs">
                    <div className="flex justify-between items-start border-b border-slate-100 pb-1.5">
                      <span className="font-bold text-slate-900">
                        {it.id_oficial} — {it.categoria_full}
                      </span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 uppercase font-bold">
                        {it.severidade}
                      </span>
                    </div>

                    <p className="text-slate-800">
                      <strong>Apontamento:</strong> {it.apontamento}
                    </p>
                    <p className="text-slate-600 italic">
                      <strong>Recomendação:</strong> {it.recomendacao}
                    </p>

                    {/* Tabela de Respondentes deste item */}
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                            <th className="p-1.5 w-40">Respondente</th>
                            <th className="p-1.5 w-52">Status consolidado</th>
                            <th className="p-1.5">Devolutiva literal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {devList.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="p-2 text-slate-400 italic text-center">
                                Nenhuma manifestação registrada até o momento.
                              </td>
                            </tr>
                          ) : (
                            devList.map((d: any, dIdx: number) => (
                              <tr key={d.id || dIdx}>
                                <td className="p-1.5 font-medium text-slate-800">
                                  {d.autor_nome} {d.autor_cargo ? `(${d.autor_cargo})` : ''}
                                </td>
                                <td className="p-1.5 font-bold text-slate-700">
                                  {d.status_definido}
                                </td>
                                <td className="p-1.5 text-slate-600">
                                  {d.parecer || d.status_definido}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </section>

        {/* 5. METODOLOGIA E CRITÉRIOS */}
        <section className="space-y-3 pt-6 border-t border-slate-200 text-xs text-slate-600 leading-relaxed">
          <h2 className="text-base font-black text-slate-900 uppercase border-b border-slate-200 pb-1">
            5. Metodologia e critérios
          </h2>

          <p><strong>FONTE 1 — FORMULÁRIO DE VISTORIA:</strong> Apontamentos técnicos contendo categorias, controles, descrições de desvios e recomendações normativas.</p>
          <p><strong>FONTE 2 — DEVOLUTIVAS:</strong> Manifestações cadastradas diretamente pelos responsáveis dos terminais no portal de tratativas quinzenais.</p>
          <p><strong>NORMALIZAÇÃO:</strong> Agrupamento de respostas com base no sentido operacional (designações para manutenção, turno e dependência orçamentária).</p>
          <p><strong>LIMITAÇÃO:</strong> Os status refletem as declarações dos respondentes e requerem comprovação e inspeção de eficácia in loco na próxima vistoria.</p>
        </section>

        {/* ANEXO A — MATRIZ CONSOLIDADA DOS APONTAMENTOS */}
        <section className="space-y-3 pt-6 border-t border-slate-200">
          <h2 className="text-base font-black text-slate-900 uppercase border-b border-slate-200 pb-1">
            Anexo A — Matriz consolidada de apontamentos e respostas
          </h2>

          <table className="w-full text-left border-collapse text-[10px]">
            <thead>
              <tr className="bg-slate-100 border-y border-slate-300 font-bold text-slate-700 uppercase">
                <th className="p-2 w-14">Item</th>
                <th className="p-2 w-28">Categoria</th>
                <th className="p-2">Diagnóstico</th>
                <th className="p-2 w-28">Respondente</th>
                <th className="p-2 w-48">Status Consolidado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {itens.map((it) => {
                const devList = (it.historico && it.historico.length > 0) ? it.historico : (it.respondido_em ? [{
                  autor_nome: it.responsavel_nome,
                  status_definido: it.status_tratativa
                }] : [{
                  autor_nome: '-',
                  status_definido: 'Sem manifestação'
                }]);

                return devList.map((d: any, idx: number) => (
                  <tr key={`${it.id}-${idx}`} className="hover:bg-slate-50">
                    <td className="p-1.5 font-mono font-bold">{it.id_oficial}</td>
                    <td className="p-1.5 font-semibold text-slate-700">{it.sigla}</td>
                    <td className="p-1.5 text-slate-800 leading-tight max-w-xs truncate">{it.apontamento}</td>
                    <td className="p-1.5 text-slate-600 font-medium">{d.autor_nome || '-'}</td>
                    <td className="p-1.5 font-semibold text-slate-700">{d.status_definido}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </section>

      </div>
    </div>
  );
}