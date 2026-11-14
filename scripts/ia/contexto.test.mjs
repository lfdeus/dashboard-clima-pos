import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  extrairReferencias,
  mascararSegredos,
  montarPrompt,
  recortar,
  removerSecaoDeAmbiente,
  resolverImportsLocais
} from './contexto.mjs';

const MENSAGEM = [
  "Expected 'a' to contain 'b'.",
  '    at <Jasmine>',
  '    at UserContext.apply (src/app/shared/components/weather-card/weather-card.component.spec.ts:70:18)',
  '    at UserContext.apply (node_modules/zone.js/fesm2015/zone-testing.js:1715:26)'
].join('\n');

const AMBIENTE = {
  plataforma: 'GitHub Actions (runner ubuntu24)',
  sistema: 'Ubuntu 24.04 LTS · Linux 6.8 · x64',
  fusoHorario: { variavelTZ: '(não definida)', resolvido: 'UTC', deslocamento: 'UTC+00:00' },
  localidade: { LANG: 'C.UTF-8', LC_ALL: '(não definida)', resolvida: 'en-US' },
  node: 'v22.0.0',
  navegador: 'Google Chrome 140'
};

test('mascara segredos conhecidos e o valor das variáveis sensíveis do job', () => {
  const texto = [
    'GET https://api.openweathermap.org/data/2.5/weather?q=Lisboa&appid=abc123def456&units=metric',
    'Authorization: Bearer gsk_AbCdEfGhIjKlMnOpQrStUvWxYz012345',
    'token interno: valor-super-secreto-do-job',
    'C:\\Users\\fulano\\projeto\\src e /home/fulano/projeto/src'
  ].join('\n');

  const saida = mascararSegredos(texto, {
    MEU_TOKEN: 'valor-super-secreto-do-job',
    PATH: '/usr/bin'
  });

  assert.ok(!saida.includes('abc123def456'));
  assert.ok(!saida.includes('gsk_AbCdEf'));
  assert.ok(!saida.includes('valor-super-secreto-do-job'));
  assert.ok(!saida.includes('fulano'));
  assert.ok(saida.includes('q=Lisboa'), 'o que não é segredo continua legível');
  assert.ok(saida.includes('[SEGREDO:MEU_TOKEN]'));
});

test('extrai do rastro só os arquivos do projeto, com a linha', () => {
  assert.deepEqual(extrairReferencias([MENSAGEM, MENSAGEM]), [
    { arquivo: 'src/app/shared/components/weather-card/weather-card.component.spec.ts', linha: 70 }
  ]);
});

test('resolve os imports locais do arquivo de teste até o código sob teste', () => {
  const spec = [
    "import { TestBed } from '@angular/core/testing';",
    "import { WeatherCardComponent } from './weather-card.component';",
    "import { CurrentWeather } from '../../../core/models/weather.model';"
  ].join('\n');

  assert.deepEqual(
    resolverImportsLocais(
      spec,
      'src/app/shared/components/weather-card/weather-card.component.spec.ts'
    ),
    [
      'src/app/shared/components/weather-card/weather-card.component.ts',
      'src/app/core/models/weather.model.ts'
    ]
  );
});

test('inclui o template externo de um componente', () => {
  const componente = "@Component({ templateUrl: './dashboard.component.html' })";
  assert.deepEqual(
    resolverImportsLocais(componente, 'src/app/features/dashboard/dashboard.component.ts'),
    ['src/app/features/dashboard/dashboard.component.html']
  );
});

test('recorta o intervalo pedido e numera as linhas', () => {
  const trecho = recortar('a\nb\nc\nd\n', 2, 99);
  assert.equal(trecho.corpo, '2 | b\n3 | c\n4 | d');
  assert.deepEqual([trecho.inicio, trecho.fim, trecho.total], [2, 4, 4]);
});

test('o prompt traz falha, quarentena, ambiente e código, sem o rastro de node_modules', () => {
  const { prompt, omitidos } = montarPrompt({
    falhas: [{ nome: 'WeatherCardComponent exibe algo', mensagens: [MENSAGEM] }],
    conhecidas: [{ id: 'CI-15', defeito: 'D01', resumo: 'dias da semana em inglês' }],
    ambiente: AMBIENTE,
    grupos: [
      {
        titulo: 'Código citado no rastro de pilha',
        blocos: [{ rotulo: 'a.spec.ts', linguagem: 'ts', corpo: '1 | x' }]
      }
    ]
  });

  assert.ok(prompt.includes('# Falhas novas (1)'));
  assert.ok(prompt.includes('CI-15 (defeito D01)'));
  assert.ok(prompt.includes('resolvido = UTC (UTC+00:00)'));
  assert.ok(prompt.includes('## a.spec.ts'));
  assert.ok(!prompt.includes('node_modules/'));
  assert.ok(prompt.trimEnd().endsWith('e justifique.'), 'o formato da resposta fecha o prompt');
  assert.deepEqual(omitidos, []);
});

test('a variante sem ambiente difere só pela seção de ambiente', () => {
  const dados = {
    falhas: [{ nome: 't', mensagens: [MENSAGEM] }],
    grupos: [{ titulo: 'Código', blocos: [{ rotulo: 'a.ts', linguagem: 'ts', corpo: '1 | x' }] }]
  };
  const comAmbiente = montarPrompt({ ...dados, ambiente: AMBIENTE }).prompt;
  const semAmbiente = removerSecaoDeAmbiente(comAmbiente);

  assert.ok(comAmbiente.includes('Fuso horário'));
  assert.ok(!semAmbiente.includes('Ambiente em que os testes rodaram'));
  assert.ok(!semAmbiente.includes('Fuso horário'));
  assert.equal(semAmbiente, montarPrompt({ ...dados, ambiente: null }).prompt);
});

test('respeita o orçamento e avisa a IA sobre o que ficou de fora', () => {
  const grande = { rotulo: 'grande.ts', linguagem: 'ts', corpo: 'x'.repeat(20000) };
  const pequeno = { rotulo: 'pequeno.ts', linguagem: 'ts', corpo: '1 | y' };
  const { prompt, omitidos } = montarPrompt({
    falhas: [{ nome: 't', mensagens: [MENSAGEM] }],
    grupos: [{ titulo: 'Código', blocos: [grande, pequeno] }],
    orcamento: 6000
  });

  assert.ok(prompt.length <= 6000);
  assert.deepEqual(omitidos, ['grande.ts']);
  assert.ok(prompt.includes('## pequeno.ts'), 'um bloco grande não impede os seguintes');
  assert.ok(prompt.includes('ficaram de fora do contexto: grande.ts'));
});

test('sem resultado por teste, o prompt leva o final do log', () => {
  const { prompt } = montarPrompt({
    falhas: [],
    logBruto: 'error TS2339: Property x does not exist'
  });
  assert.ok(prompt.includes('# Log da execução'));
  assert.ok(prompt.includes('error TS2339'));
});
