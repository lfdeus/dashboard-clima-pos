#!/usr/bin/env node
/**
 * Portão de qualidade do CI.
 *
 * A suíte tem testes que falham por defeito conhecido e documentado (ci/falhas-conhecidas.json).
 * Se o pipeline simplesmente repassasse o código de saída do Karma, ficaria sempre vermelho e
 * deixaria de avisar quando algo NOVO quebra. Este script separa as duas coisas:
 *
 *   saída 0  nenhuma falha nova (só as da quarentena, se houver)
 *   saída 1  há falha nova                          -> aciona o diagnóstico com IA
 *   saída 2  a execução não terminou (erro de build, navegador caiu) -> aciona o diagnóstico
 *   saída 3  só a cobertura mínima não foi atingida
 *
 * Uso: node scripts/ci/avaliar-testes.mjs --codigo-karma <n>
 *        [--resultados reports/karma-resultados.json] [--log reports/karma.log]
 *        [--conhecidas ci/falhas-conhecidas.json] [--saida reports/avaliacao.json]
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

/** Diz se o nome completo do teste carrega o identificador (ex.: "CE-42" em "... CE-42: ..."). */
export function nomeTemId(nome, id) {
  const idEscapado = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${idEscapado}(?=[\\s:]|$)`).test(nome);
}

/** Classifica o resultado da suíte em relação à lista de falhas conhecidas. */
export function avaliar({ resultados, conhecidas, codigoKarma, log = '' }) {
  const incompleta =
    !resultados ||
    resultados.resumo.erroDeExecucao ||
    resultados.resumo.navegadorDesconectou ||
    resultados.testes.length === 0;

  if (incompleta) {
    return {
      status: codigoKarma === 0 ? 'ok' : 'execucao_incompleta',
      totais: null,
      falhasNovas: [],
      falhasConhecidas: [],
      conhecidasQuePassaram: [],
      conhecidasNaoEncontradas: []
    };
  }

  const falhas = resultados.testes.filter((t) => !t.sucesso && !t.pulado);
  const falhasNovas = [];
  const falhasConhecidas = [];
  for (const teste of falhas) {
    const conhecida = conhecidas.find((c) => nomeTemId(teste.nome, c.id));
    if (conhecida) {
      falhasConhecidas.push({ id: conhecida.id, defeito: conhecida.defeito, nome: teste.nome });
    } else {
      falhasNovas.push({ nome: teste.nome, mensagens: teste.mensagens });
    }
  }

  const conhecidasQuePassaram = [];
  const conhecidasNaoEncontradas = [];
  for (const c of conhecidas) {
    const testes = resultados.testes.filter((t) => nomeTemId(t.nome, c.id));
    if (testes.length === 0) conhecidasNaoEncontradas.push(c.id);
    else if (testes.every((t) => t.sucesso)) conhecidasQuePassaram.push(c.id);
  }

  const coberturaInsuficiente = /does not meet global threshold/.test(log);
  let status = 'ok';
  if (falhasNovas.length > 0) status = 'falhas_novas';
  else if (coberturaInsuficiente) status = 'cobertura_insuficiente';
  // O Karma reprovou, mas nenhum teste falhou e a cobertura está em dia: algo quebrou fora dos testes.
  else if (codigoKarma !== 0 && falhas.length === 0) status = 'execucao_incompleta';

  return {
    status,
    totais: {
      executados: resultados.testes.filter((t) => !t.pulado).length,
      passaram: resultados.testes.filter((t) => t.sucesso && !t.pulado).length,
      falharam: falhas.length,
      pulados: resultados.testes.filter((t) => t.pulado).length
    },
    falhasNovas,
    falhasConhecidas,
    conhecidasQuePassaram,
    conhecidasNaoEncontradas
  };
}

const CODIGO_DE_SAIDA = {
  ok: 0,
  falhas_novas: 1,
  execucao_incompleta: 2,
  cobertura_insuficiente: 3
};

const TITULO = {
  ok: '✅ Nenhuma falha nova',
  falhas_novas: '❌ Há falhas novas',
  execucao_incompleta: '❌ A execução dos testes não terminou',
  cobertura_insuficiente: '❌ Cobertura abaixo do mínimo configurado'
};

/** Resumo em Markdown, usado no console e no resumo da execução do GitHub Actions. */
export function resumoEmMarkdown(avaliacao) {
  const linhas = [`## Testes automatizados: ${TITULO[avaliacao.status]}`, ''];
  if (avaliacao.totais) {
    const t = avaliacao.totais;
    linhas.push(
      `${t.executados} executados · ${t.passaram} passaram · ${t.falharam} falharam ` +
        `(${avaliacao.falhasNovas.length} novas, ${avaliacao.falhasConhecidas.length} em quarentena)`,
      ''
    );
  } else {
    linhas.push('O Karma não gerou resultados por teste. Veja o log do job.', '');
  }
  if (avaliacao.falhasNovas.length > 0) {
    linhas.push('### Falhas novas', '');
    for (const f of avaliacao.falhasNovas) {
      const primeira = (f.mensagens[0] ?? '').split('\n')[0];
      linhas.push(`- **${f.nome}**`, `  - \`${primeira}\``);
    }
    linhas.push('');
  }
  if (avaliacao.falhasConhecidas.length > 0) {
    linhas.push('### Falhas conhecidas (quarentena, não reprovam o pipeline)', '');
    for (const f of avaliacao.falhasConhecidas) linhas.push(`- ${f.id} (defeito ${f.defeito})`);
    linhas.push('');
  }
  if (avaliacao.conhecidasQuePassaram.length > 0) {
    linhas.push(
      `> ⚠️ Estes testes estão na quarentena, mas passaram: ${avaliacao.conhecidasQuePassaram.join(', ')}. ` +
        'Remova-os de `ci/falhas-conhecidas.json`.',
      ''
    );
  }
  if (avaliacao.conhecidasNaoEncontradas.length > 0) {
    linhas.push(
      `> ⚠️ Estes itens da quarentena não correspondem a nenhum teste executado: ${avaliacao.conhecidasNaoEncontradas.join(', ')}.`,
      ''
    );
  }
  return linhas.join('\n');
}

function lerJson(caminho) {
  return existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')) : null;
}

function principal() {
  const { values: args } = parseArgs({
    options: {
      'codigo-karma': { type: 'string', default: '1' },
      resultados: { type: 'string', default: 'reports/karma-resultados.json' },
      log: { type: 'string', default: 'reports/karma.log' },
      conhecidas: { type: 'string', default: 'ci/falhas-conhecidas.json' },
      saida: { type: 'string', default: 'reports/avaliacao.json' }
    }
  });

  const codigoKarma = Number.parseInt(args['codigo-karma'], 10);
  const avaliacao = avaliar({
    resultados: lerJson(args.resultados),
    conhecidas: lerJson(args.conhecidas)?.falhas ?? [],
    codigoKarma: Number.isNaN(codigoKarma) ? 1 : codigoKarma,
    log: existsSync(args.log) ? readFileSync(args.log, 'utf8') : ''
  });
  const diagnosticar = ['falhas_novas', 'execucao_incompleta'].includes(avaliacao.status);

  mkdirSync(dirname(args.saida), { recursive: true });
  writeFileSync(args.saida, `${JSON.stringify(avaliacao, null, 2)}\n`);

  const resumo = resumoEmMarkdown(avaliacao);
  console.log(resumo);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${resumo}\n`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `status=${avaliacao.status}\ndiagnosticar=${diagnosticar}\n`
    );
  }

  process.exitCode = CODIGO_DE_SAIDA[avaliacao.status];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) principal();
