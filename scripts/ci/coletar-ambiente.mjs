#!/usr/bin/env node
/**
 * Registra o ambiente em que os testes vão rodar (sistema, fuso horário, localidade, Node e
 * navegador). O log do Karma não traz essas informações, e uma falha pode depender delas.
 *
 * Uso: node scripts/ci/coletar-ambiente.mjs [arquivo-de-saida]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, resolve } from 'node:path';

const destino = resolve(process.argv[2] ?? 'reports/ambiente.json');

function distribuicao() {
  try {
    const linha = readFileSync('/etc/os-release', 'utf8')
      .split('\n')
      .find((l) => l.startsWith('PRETTY_NAME='));
    return linha ? linha.slice('PRETTY_NAME='.length).replaceAll('"', '') : null;
  } catch {
    return null;
  }
}

function versaoDoNavegador() {
  const candidatos = [
    process.env.CHROME_BIN,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser'
  ].filter(Boolean);
  for (const binario of candidatos) {
    try {
      return execFileSync(binario, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      }).trim();
    } catch {
      // tenta o próximo candidato
    }
  }
  return 'não identificado';
}

function deslocamentoUtc() {
  const minutos = -new Date().getTimezoneOffset();
  const sinal = minutos < 0 ? '-' : '+';
  const hh = String(Math.floor(Math.abs(minutos) / 60)).padStart(2, '0');
  const mm = String(Math.abs(minutos) % 60).padStart(2, '0');
  return `UTC${sinal}${hh}:${mm}`;
}

function plataformaDeCi() {
  if (process.env.GITHUB_ACTIONS) {
    return `GitHub Actions (runner ${process.env.ImageOS ?? process.env.RUNNER_OS ?? 'desconhecido'})`;
  }
  if (process.env.GITLAB_CI) {
    return `GitLab CI (imagem ${process.env.CI_JOB_IMAGE ?? 'desconhecida'})`;
  }
  return 'execução local';
}

const formato = Intl.DateTimeFormat().resolvedOptions();

const ambiente = {
  plataforma: plataformaDeCi(),
  sistema: [distribuicao(), `${os.type()} ${os.release()}`, os.arch()].filter(Boolean).join(' · '),
  fusoHorario: {
    variavelTZ: process.env.TZ ?? '(não definida)',
    resolvido: formato.timeZone,
    deslocamento: deslocamentoUtc()
  },
  localidade: {
    LANG: process.env.LANG ?? '(não definida)',
    LC_ALL: process.env.LC_ALL ?? '(não definida)',
    resolvida: formato.locale
  },
  node: process.version,
  navegador: versaoDoNavegador()
};

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, `${JSON.stringify(ambiente, null, 2)}\n`);
console.log(`Ambiente registrado em ${destino}:`);
console.log(JSON.stringify(ambiente, null, 2));
