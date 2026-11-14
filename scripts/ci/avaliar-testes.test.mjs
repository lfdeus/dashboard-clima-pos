import assert from 'node:assert/strict';
import { test } from 'node:test';

import { avaliar, nomeTemId, resumoEmMarkdown } from './avaliar-testes.mjs';

const CONHECIDAS = [
  { id: 'CI-15', defeito: 'D01' },
  { id: 'CE-42', defeito: 'A2' }
];

const teste = (nome, sucesso = true) => ({
  nome,
  sucesso,
  pulado: false,
  mensagens: sucesso ? [] : ['Expected a to be b.']
});

function resultados(...testes) {
  return {
    resumo: {
      passaram: testes.filter((t) => t.sucesso).length,
      falharam: testes.filter((t) => !t.sucesso).length,
      erroDeExecucao: false,
      navegadorDesconectou: false
    },
    testes
  };
}

test('reconhece o identificador no nome completo do teste, sem casar prefixos', () => {
  assert.ok(nomeTemId('Integração persistência CE-42: `clima:history` com 7 itens', 'CE-42'));
  assert.ok(nomeTemId('Integração CI-15 exibe o dia da semana', 'CI-15'));
  assert.ok(!nomeTemId('Integração CI-150 outro teste', 'CI-15'));
  assert.ok(!nomeTemId('Integração XCI-15 outro teste', 'CI-15'));
});

test('só falhas da quarentena: pipeline aprovado', () => {
  const avaliacao = avaliar({
    resultados: resultados(
      teste('a passa'),
      teste('x CI-15 dia da semana', false),
      teste('y CE-42: histórico', false)
    ),
    conhecidas: CONHECIDAS,
    codigoKarma: 1
  });

  assert.equal(avaliacao.status, 'ok');
  assert.deepEqual(
    avaliacao.falhasConhecidas.map((f) => f.id),
    ['CI-15', 'CE-42']
  );
  assert.deepEqual(avaliacao.falhasNovas, []);
});

test('uma falha fora da quarentena reprova e é a única listada como nova', () => {
  const avaliacao = avaliar({
    resultados: resultados(
      teste('x CI-15 dia da semana', false),
      teste('WeatherCard exibe nascer do sol', false)
    ),
    conhecidas: CONHECIDAS,
    codigoKarma: 1
  });

  assert.equal(avaliacao.status, 'falhas_novas');
  assert.deepEqual(
    avaliacao.falhasNovas.map((f) => f.nome),
    ['WeatherCard exibe nascer do sol']
  );
  assert.match(resumoEmMarkdown(avaliacao), /Há falhas novas/);
});

test('avisa quando um teste da quarentena volta a passar ou some', () => {
  const avaliacao = avaliar({
    resultados: resultados(teste('x CI-15 dia da semana')),
    conhecidas: CONHECIDAS,
    codigoKarma: 0
  });

  assert.equal(avaliacao.status, 'ok');
  assert.deepEqual(avaliacao.conhecidasQuePassaram, ['CI-15']);
  assert.deepEqual(avaliacao.conhecidasNaoEncontradas, ['CE-42']);
});

test('sem resultado por teste e Karma com erro: execução incompleta', () => {
  assert.equal(
    avaliar({ resultados: null, conhecidas: CONHECIDAS, codigoKarma: 1 }).status,
    'execucao_incompleta'
  );

  const caiu = resultados();
  caiu.resumo.navegadorDesconectou = true;
  assert.equal(
    avaliar({ resultados: caiu, conhecidas: CONHECIDAS, codigoKarma: 1 }).status,
    'execucao_incompleta'
  );
});

test('cobertura abaixo do mínimo reprova mesmo sem falha nova', () => {
  const avaliacao = avaliar({
    resultados: resultados(teste('a passa')),
    conhecidas: CONHECIDAS,
    codigoKarma: 1,
    log: 'ERROR [coverage]: Coverage for lines (61.2%) does not meet global threshold (70%)'
  });

  assert.equal(avaliacao.status, 'cobertura_insuficiente');
});

test('Karma reprovou sem nenhum teste falhando: trata como execução incompleta', () => {
  const avaliacao = avaliar({
    resultados: resultados(teste('a passa')),
    conhecidas: [],
    codigoKarma: 1
  });
  assert.equal(avaliacao.status, 'execucao_incompleta');
});
