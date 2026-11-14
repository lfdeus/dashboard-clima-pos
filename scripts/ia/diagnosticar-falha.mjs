#!/usr/bin/env node
/**
 * Agente de diagnóstico: quando o job de testes falha, monta o contexto da falha e pede a um
 * modelo de IA generativa (Groq, API compatível com a da OpenAI) uma hipótese de causa raiz.
 *
 * O agente é só leitura: não altera código, não muda o resultado do pipeline e nunca termina
 * com erro. Sem a chave GROQ_API_KEY ele não chama ninguém e deixa o prompt pronto como artefato.
 *
 * Entradas (geradas pelo job de testes, na pasta de relatórios):
 *   avaliacao.json   falhas novas x quarentena (scripts/ci/avaliar-testes.mjs)
 *   ambiente.json    sistema, fuso, localidade, Node e navegador (scripts/ci/coletar-ambiente.mjs)
 *   karma.log        log bruto, usado só quando a execução não chegou a rodar os testes
 *
 * Variáveis de ambiente:
 *   GROQ_API_KEY                 chave da API (segredo do CI)
 *   GROQ_MODEL                   padrão: openai/gpt-oss-120b
 *   GROQ_BASE_URL                padrão: https://api.groq.com/openai/v1
 *   DIAG_BASE_SHA                commit de base, para anexar o diff da entrega
 *   DIAG_COMPARAR_SEM_AMBIENTE   "true" gera também a variante sem a seção de ambiente
 *   DIAG_ORCAMENTO_CARACTERES    tamanho máximo do prompt (padrão 13000)
 *   DIAG_MAX_TOKENS_RESPOSTA     padrão 3000
 *
 * Uso: node scripts/ia/diagnosticar-falha.mjs [--relatorios reports] [--saida reports/diagnostico]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { parseArgs } from 'node:util';

import {
  INSTRUCAO_DE_SISTEMA,
  estimarTokens,
  extrairReferencias,
  mascararSegredos,
  montarPrompt,
  recortar,
  removerAnsi,
  removerSecaoDeAmbiente,
  resolverImportsLocais
} from './contexto.mjs';

const { values: args } = parseArgs({
  options: {
    relatorios: { type: 'string', default: 'reports' },
    saida: { type: 'string', default: 'reports/diagnostico' }
  }
});

const config = {
  chave: process.env.GROQ_API_KEY || '',
  modelo: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  baseUrl: (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/$/, ''),
  baseSha: process.env.DIAG_BASE_SHA || '',
  compararSemAmbiente: process.env.DIAG_COMPARAR_SEM_AMBIENTE === 'true',
  orcamento: Number(process.env.DIAG_ORCAMENTO_CARACTERES) || 13000,
  maxTokensResposta: Number(process.env.DIAG_MAX_TOKENS_RESPOSTA) || 3000
};

const TITULO = '## 🤖 Diagnóstico automático da falha (IA generativa)';
const LIMITE_ARQUIVO_INTEIRO = 160;
const LIMITE_DIFF = 4000;

function lerJson(caminho) {
  return existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')) : null;
}

function gravar(nome, conteudo) {
  mkdirSync(args.saida, { recursive: true });
  writeFileSync(join(args.saida, nome), conteudo.endsWith('\n') ? conteudo : `${conteudo}\n`);
}

function linguagemDe(arquivo) {
  if (arquivo.endsWith('.html')) return 'html';
  return arquivo.endsWith('.ts') ? 'ts' : 'js';
}

/** Final do log, sem cores e sem as linhas de progresso do Karma. */
function finalDoLog(caminho, linhas = 60) {
  if (!existsSync(caminho)) return '(log não encontrado)';
  return removerAnsi(readFileSync(caminho, 'utf8'))
    .split('\n')
    .filter((l) => l.trim() && !/Executed \d+ of \d+/.test(l))
    .slice(-linhas)
    .join('\n');
}

/** Código citado no rastro de pilha: arquivo inteiro se for pequeno, senão a janela das linhas. */
function blocosCitados(referencias) {
  const porArquivo = new Map();
  for (const { arquivo, linha } of referencias) {
    if (!existsSync(arquivo)) continue;
    const linhas = porArquivo.get(arquivo) ?? [];
    linhas.push(linha);
    porArquivo.set(arquivo, linhas);
  }

  return [...porArquivo].map(([arquivo, linhas]) => {
    const conteudo = readFileSync(arquivo, 'utf8');
    const total = conteudo.replace(/\n$/, '').split('\n').length;
    const citadas = [...new Set(linhas)].sort((a, b) => a - b).join(', ');
    const trecho =
      total <= LIMITE_ARQUIVO_INTEIRO
        ? recortar(conteudo, 1, total)
        : recortar(conteudo, Math.min(...linhas) - 40, Math.max(...linhas) + 10);
    return {
      arquivo,
      rotulo: `${arquivo} (linhas ${trecho.inicio}–${trecho.fim} de ${total}; o rastro aponta: ${citadas})`,
      linguagem: linguagemDe(arquivo),
      corpo: trecho.corpo
    };
  });
}

/**
 * Módulos locais importados pelos arquivos citados, separados em dois grupos: o código sob teste
 * (o módulo que dá nome ao arquivo de teste) e os demais. A causa de uma falha costuma estar no
 * primeiro, que não aparece no rastro de pilha.
 */
function blocosImportados(citados) {
  const jaIncluidos = new Set(citados.map((c) => c.arquivo));
  const candidatos = new Map();

  for (const { arquivo } of citados) {
    const conteudo = readFileSync(arquivo, 'utf8');
    const alvoDoTeste = basename(arquivo).replace(/\.spec\.ts$/, '.ts');
    for (const importado of resolverImportsLocais(conteudo, arquivo)) {
      if (jaIncluidos.has(importado) || candidatos.has(importado) || !existsSync(importado)) {
        continue;
      }
      let prioridade = 2;
      if (dirname(importado) === dirname(arquivo)) prioridade = 1;
      if (basename(importado) === alvoDoTeste) prioridade = 0;
      candidatos.set(importado, prioridade);
    }
  }

  const blocos = [...candidatos]
    .sort((a, b) => a[1] - b[1])
    .map(([arquivo, prioridade]) => {
      const trecho = recortar(readFileSync(arquivo, 'utf8'), 1, LIMITE_ARQUIVO_INTEIRO);
      const parcial =
        trecho.fim < trecho.total ? ` (primeiras ${trecho.fim} de ${trecho.total} linhas)` : '';
      return {
        prioridade,
        rotulo: `${arquivo}${parcial}`,
        linguagem: linguagemDe(arquivo),
        corpo: trecho.corpo
      };
    });

  return {
    sobTeste: blocos.filter((b) => b.prioridade === 0),
    demais: blocos.filter((b) => b.prioridade > 0)
  };
}

/**
 * Diff da entrega em relação ao commit de base: só o código de produção em src/. Os arquivos de
 * teste ficam de fora porque o teste que falhou já entra inteiro no contexto.
 */
function diffDaEntrega() {
  if (!/^[0-9a-f]{7,40}$/.test(config.baseSha) || /^0+$/.test(config.baseSha)) return '';
  try {
    execFileSync('git', ['cat-file', '-e', `${config.baseSha}^{commit}`], { stdio: 'ignore' });
    const diff = execFileSync(
      'git',
      [
        'diff',
        '--unified=3',
        '--no-color',
        config.baseSha,
        'HEAD',
        '--',
        'src',
        ':(exclude)*.spec.ts'
      ],
      { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 }
    );
    return diff.length > LIMITE_DIFF
      ? `${diff.slice(0, LIMITE_DIFF)}\n[... diff cortado: ${diff.length} caracteres no total]`
      : diff;
  } catch (erro) {
    console.log(`Diff da entrega indisponível (${erro.message.split('\n')[0]}).`);
    return '';
  }
}

async function consultarModelo(prompt) {
  for (let tentativa = 1; ; tentativa++) {
    const resposta = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.modelo,
        temperature: 0.2,
        max_completion_tokens: config.maxTokensResposta,
        messages: [
          { role: 'system', content: INSTRUCAO_DE_SISTEMA },
          { role: 'user', content: prompt }
        ]
      }),
      signal: AbortSignal.timeout(120_000)
    });

    // Limite por minuto do plano gratuito: espera o tempo indicado e tenta de novo.
    if (resposta.status === 429 && tentativa < 3) {
      const segundos = Math.min(Number(resposta.headers.get('retry-after')) || 30, 90) + 1;
      console.log(`Limite de requisições atingido (HTTP 429). Nova tentativa em ${segundos}s.`);
      await esperar(segundos * 1000);
      continue;
    }

    const corpo = await resposta.text();
    if (!resposta.ok) {
      const erro = new Error(`HTTP ${resposta.status}: ${corpo.slice(0, 400)}`);
      erro.status = resposta.status;
      throw erro;
    }
    const json = JSON.parse(corpo);
    const escolha = json.choices?.[0];
    return {
      texto: (escolha?.message?.content ?? '').trim(),
      motivoDoFim: escolha?.finish_reason ?? 'desconhecido',
      uso: json.usage ?? {}
    };
  }
}

async function principal() {
  const avaliacao = lerJson(join(args.relatorios, 'avaliacao.json'));
  if (!avaliacao || !['falhas_novas', 'execucao_incompleta'].includes(avaliacao.status)) {
    console.log('Não há falha nova para diagnosticar. Nada a fazer.');
    return;
  }

  const ambiente = lerJson(join(args.relatorios, 'ambiente.json'));
  const quarentena = lerJson('ci/falhas-conhecidas.json')?.falhas ?? [];
  const idsQueFalharam = new Set(avaliacao.falhasConhecidas.map((f) => f.id));
  const conhecidas = quarentena.filter((c) => idsQueFalharam.has(c.id));

  const falhas = avaliacao.falhasNovas;
  const logBruto = falhas.length === 0 ? finalDoLog(join(args.relatorios, 'karma.log')) : '';
  const referencias = extrairReferencias(
    falhas.length > 0 ? falhas.flatMap((f) => f.mensagens) : [logBruto]
  );

  const citados = blocosCitados(referencias);
  const importados = blocosImportados(citados);
  const diff = diffDaEntrega();
  // A ordem dos grupos é a prioridade: o que não couber no orçamento fica de fora, do fim para o começo.
  const grupos = [
    { titulo: 'Código citado no rastro de pilha', blocos: citados },
    { titulo: 'Código sob teste', blocos: importados.sobTeste },
    {
      titulo: 'Alterações desta entrega',
      blocos: diff
        ? [
            {
              rotulo: `git diff ${config.baseSha.slice(0, 7)}..HEAD -- src (sem os arquivos de teste)`,
              linguagem: 'diff',
              corpo: diff.trim()
            }
          ]
        : []
    },
    { titulo: 'Outros módulos importados pelos arquivos citados', blocos: importados.demais }
  ];

  const variantes = [
    { id: 'com-ambiente', rotulo: 'Com o ambiente de execução no contexto', semAmbiente: false }
  ];
  if (config.compararSemAmbiente && ambiente) {
    variantes.push({
      id: 'sem-ambiente',
      rotulo: 'Sem o ambiente de execução no contexto',
      semAmbiente: true
    });
  }

  // As variantes saem do mesmo prompt: a única diferença entre elas é a seção de ambiente.
  const construir = (variante, orcamento) => {
    const { prompt } = montarPrompt({ falhas, conhecidas, ambiente, grupos, logBruto, orcamento });
    return mascararSegredos(
      variante.semAmbiente ? removerSecaoDeAmbiente(prompt) : prompt,
      process.env
    );
  };

  for (const variante of variantes) {
    variante.prompt = construir(variante, config.orcamento);
    gravar(`prompt-${variante.id}.md`, variante.prompt);
    console.log(
      `Prompt "${variante.id}": ${variante.prompt.length} caracteres (~${estimarTokens(variante.prompt)} tokens estimados).`
    );
  }

  const commit = (process.env.GITHUB_SHA || process.env.CI_COMMIT_SHA || '').slice(0, 7);
  const cabecalho = [
    TITULO,
    '',
    '> Hipótese gerada por IA a partir do log, do código e do ambiente do job. **Valide antes de aplicar.** O agente não altera código nem o resultado do pipeline.',
    ''
  ];

  if (!config.chave) {
    gravar(
      'diagnostico.md',
      [
        ...cabecalho,
        'A chave `GROQ_API_KEY` não está configurada neste job, então nenhuma chamada foi feita.',
        'O prompt completo está nos artefatos do job (`prompt-com-ambiente.md`) e pode ser enviado manualmente a um modelo.'
      ].join('\n')
    );
    console.log('GROQ_API_KEY ausente: prompt salvo, nenhuma chamada feita.');
    return;
  }

  const secoes = [];
  for (const variante of variantes) {
    let resultado;
    try {
      try {
        resultado = await consultarModelo(variante.prompt);
      } catch (erro) {
        if (erro.status !== 413) throw erro;
        // Requisição grande demais para o limite de tokens do plano: reduz o contexto e repete.
        console.log(
          'Contexto grande demais para o limite do modelo (HTTP 413). Reduzindo e repetindo.'
        );
        variante.prompt = construir(variante, Math.round(config.orcamento * 0.65));
        gravar(`prompt-${variante.id}.md`, variante.prompt);
        resultado = await consultarModelo(variante.prompt);
      }
    } catch (erro) {
      const motivo = mascararSegredos(String(erro.message ?? erro), process.env);
      console.log(`Falha ao consultar o modelo (${variante.id}): ${motivo}`);
      secoes.push({
        variante,
        texto: `⚠️ Não foi possível obter o diagnóstico: \`${motivo}\``,
        rodape: ''
      });
      continue;
    }

    const texto =
      resultado.texto ||
      `⚠️ O modelo não devolveu texto (motivo do fim: \`${resultado.motivoDoFim}\`). Tente aumentar \`DIAG_MAX_TOKENS_RESPOSTA\`.`;
    gravar(`diagnostico-${variante.id}.md`, texto);
    const uso = resultado.uso;
    secoes.push({
      variante,
      texto,
      rodape: `contexto de ${variante.prompt.length} caracteres; tokens: ${uso.prompt_tokens ?? '?'} de entrada, ${uso.completion_tokens ?? '?'} de saída`
    });
    console.log(`Diagnóstico "${variante.id}" recebido (${texto.length} caracteres).`);
  }

  const linhas = [
    ...cabecalho,
    `**Modelo:** \`${config.modelo}\` (Groq) · **Falhas novas:** ${falhas.length}${commit ? ` · **Commit:** \`${commit}\`` : ''}`,
    ''
  ];
  secoes.forEach((secao, i) => {
    if (i === 0) {
      linhas.push(`### ${secao.variante.rotulo}`, '', secao.texto, '');
    } else {
      linhas.push(
        '<details>',
        `<summary><strong>Comparação: ${secao.variante.rotulo.toLowerCase()}</strong></summary>`,
        '',
        secao.texto,
        '',
        '</details>',
        ''
      );
    }
  });
  const rodapes = secoes.filter((s) => s.rodape).map((s) => `${s.variante.id}: ${s.rodape}`);
  linhas.push(
    `<sub>${rodapes.join(' · ')}${rodapes.length ? '. ' : ''}Os prompts completos estão nos artefatos do job.</sub>`
  );
  gravar('diagnostico.md', linhas.join('\n'));
}

try {
  await principal();
} catch (erro) {
  // O diagnóstico é um apoio: uma falha aqui não pode mascarar nem agravar a falha original.
  const motivo = mascararSegredos(String(erro?.stack ?? erro), process.env);
  console.log(`O agente de diagnóstico falhou: ${motivo}`);
  gravar(
    'diagnostico.md',
    `${TITULO}\n\n⚠️ O agente de diagnóstico falhou antes de concluir:\n\n\`\`\`text\n${motivo}\n\`\`\``
  );
}
