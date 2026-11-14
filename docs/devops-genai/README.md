# Pipeline de CI com diagnóstico de falhas por IA generativa

Atividade da Unidade V (miniprojeto de DevOps com GenAI): um pipeline de integração contínua que
roda os testes automatizados e, quando eles falham, aciona um agente de IA generativa para
analisar a falha e sugerir a causa raiz e uma correção.

**Resumo.** O pipeline tem um job de testes com um portão de qualidade e um job de diagnóstico
que só roda quando aparece uma falha nova. O agente monta o contexto (falha, ambiente de execução,
código citado no rastro, código sob teste e diff da entrega), mascara segredos e consulta um
modelo no Groq. O resultado vira comentário no Pull Request. O agente é só leitura: não altera
código nem o resultado do pipeline.

## Sumário

1. [Pipeline](#1-pipeline)
2. [Quarentena de falhas conhecidas](#2-quarentena-de-falhas-conhecidas)
3. [Agente de diagnóstico](#3-agente-de-diagnóstico)
4. [Configuração](#4-configuração)
5. [Como reproduzir na sua máquina](#5-como-reproduzir-na-sua-máquina)
6. [Limitações](#6-limitações)
7. [Arquivos](#7-arquivos)

## 1. Pipeline

O repositório está no GitHub, então o pipeline que roda é o do GitHub Actions
([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)). O
[`.gitlab-ci.yml`](../../.gitlab-ci.yml) é o equivalente para o GitLab CI, com as mesmas etapas e
os mesmos scripts.

```mermaid
flowchart LR
    E([push ou pull request]) --> Q["qualidade<br/>lint, formatação, build"]
    E --> T["testes<br/>Karma + portão de qualidade"]
    T -- "falha nova" --> D["diagnóstico com IA<br/>(Groq)"]
    D --> C["comentário no PR,<br/>resumo e artefatos"]
```

| Job | O que faz | Quando reprova |
| --- | --- | --- |
| `qualidade` | ESLint, Prettier, testes dos scripts de CI (`node --test`) e build de produção | Qualquer um desses passos falha |
| `testes` | Registra o ambiente, roda a suíte no Karma (ChromeHeadless) e aplica o portão de qualidade | Há falha **nova**, a execução não termina ou a cobertura fica abaixo do mínimo |
| `diagnostico-ia` | Monta o contexto, consulta o modelo e publica o diagnóstico | Nunca: é um apoio, não um portão |

Dois detalhes do job de testes:

- **Código de saída.** O log vai para a tela e para um arquivo com `npm run test:ci | tee`. Num
  pipe, o código de saída é o do `tee`, que sempre dá certo. Por isso o do Karma é lido de
  `PIPESTATUS`, e quem decide o resultado do job é o portão de qualidade.
- **Resultado por teste.** O `karma.conf.js` tem um reporter próprio, ativado pela variável
  `KARMA_RESULTADOS_JSON`, que grava o resultado de cada teste em JSON. O portão e o agente leem
  esse arquivo, e não o log, que é feito para pessoas.

## 2. Quarentena de falhas conhecidas

A suíte tem três testes que falham de propósito: eles registram defeitos reais do código, já
documentados (CI-15, CE-12 e CE-42, ver
[achados dos testes de integração](../testes-integracao/README.md#6-achados)). Com eles, o
`ng test` sempre termina com erro. Se o pipeline só repassasse esse código de saída, ficaria
vermelho para sempre e deixaria de avisar quando algo novo quebra.

O portão de qualidade ([`scripts/ci/avaliar-testes.mjs`](../../scripts/ci/avaliar-testes.mjs))
compara as falhas com a lista de [`ci/falhas-conhecidas.json`](../../ci/falhas-conhecidas.json):

| Situação | Resultado do job | Diagnóstico com IA |
| --- | --- | --- |
| Só falham testes da quarentena | Aprovado | Não roda |
| Falha um teste fora da quarentena | Reprovado | Roda |
| O Karma não chega a rodar os testes (erro de build, navegador caiu) | Reprovado | Roda, com o final do log |
| Cobertura abaixo do mínimo do `karma.conf.js` | Reprovado | Não roda |

O portão também avisa quando um teste da quarentena volta a passar ou deixa de existir, para a
lista não envelhecer. As falhas conhecidas vão para o prompt marcadas como "ignore", para a IA
não gastar a análise com elas.

## 3. Agente de diagnóstico

[`scripts/ia/diagnosticar-falha.mjs`](../../scripts/ia/diagnosticar-falha.mjs) lê os relatórios
do job de testes e chama a API do Groq (compatível com a da OpenAI). É Node puro, sem
dependências, então o job não precisa de `npm ci`.

**O que entra no prompt, em ordem de prioridade:**

1. As falhas novas: nome do teste, mensagem e rastro de pilha (sem as linhas de `node_modules`).
2. As falhas conhecidas, marcadas para ignorar.
3. O **ambiente em que os testes rodaram**: plataforma, sistema, fuso horário, localidade, Node e
   navegador. Essa informação não aparece no log do Karma.
4. O código citado no rastro de pilha. Arquivo pequeno entra inteiro, para a IA ver também os
   dados de teste definidos no topo.
5. O **código sob teste**: o módulo que o arquivo de teste importa e que dá nome a ele. A causa
   costuma estar ali, e esse arquivo quase nunca aparece no rastro.
6. O diff da entrega em relação ao commit de base, só do código de produção.
7. Os outros módulos importados.

O prompt tem um orçamento de caracteres (13.000 por padrão), porque o plano gratuito do Groq
limita os tokens por minuto. O que não cabe fica de fora, do fim da lista para o começo, e o
próprio prompt diz à IA o que ela não viu.

**Formato da resposta.** O prompt pede sete seções fixas: resumo, evidências, causa raiz com
classificação (defeito no código, defeito no teste ou problema de ambiente), correção sugerida em
diff, como validar, confiança e premissas, e prevenção. Também proíbe sugerir que o teste seja
enfraquecido ou que o pipeline seja alterado só para esconder a falha.

**Comparação com e sem ambiente.** Com `DIAG_COMPARAR_SEM_AMBIENTE=true`, o agente faz uma segunda
consulta com o mesmo prompt, sem a seção de ambiente. As duas respostas saem no mesmo comentário,
o que permite ver quanto essa informação muda o diagnóstico.

**Segurança.**

- Antes de sair do runner, o texto passa por uma máscara: valor das variáveis sensíveis do job,
  chave da OpenWeatherMap na URL (`appid=`), formatos conhecidos de credenciais e o nome de
  usuário em caminhos de pasta pessoal.
- A chave do Groq fica num segredo do CI e nunca é impressa nem gravada nos artefatos.
- Sem a chave, o agente não chama ninguém: grava o prompt como artefato e termina sem erro. É o
  que acontece em Pull Requests de forks, que não recebem segredos.
- Log, código e diff vão no prompt como dados, com a instrução de não tratar esse conteúdo como
  ordem.

**Robustez.** Erro 429 (limite por minuto) espera o tempo indicado pela API e repete. Erro 413
(requisição grande demais) reduz o contexto e repete. Qualquer outra falha vira um aviso no
comentário. O agente sempre termina com sucesso, para não mascarar nem agravar a falha original.

Os scripts têm testes próprios (`npm run test:agente`), que rodam no job `qualidade`. Eles
garantem, entre outras coisas, que os imports do arquivo de teste são resolvidos até o código sob
teste, que os segredos são mascarados e que o prompt respeita o orçamento.

## 4. Configuração

**GitHub** (Settings → Secrets and variables → Actions):

| Tipo | Nome | Valor |
| --- | --- | --- |
| Secret | `GROQ_API_KEY` | Chave criada em <https://console.groq.com/keys> |
| Variable (opcional) | `GROQ_MODEL` | Modelo a usar. Padrão: `openai/gpt-oss-120b` |

O comentário no Pull Request usa o `GITHUB_TOKEN` do próprio job, com a permissão
`pull-requests: write` declarada no workflow.

**GitLab** (Settings → CI/CD → Variables, mascaradas): `GROQ_API_KEY` e `GITLAB_API_TOKEN`, um
token de projeto com escopo `api`, usado para comentar no Merge Request.

## 5. Como reproduzir na sua máquina

Requer Node 22 e Chrome.

```bash
# os mesmos passos do job de testes (os relatórios ficam em reports/, fora do Git)
node scripts/ci/coletar-ambiente.mjs reports/ambiente.json
KARMA_RESULTADOS_JSON=reports/karma-resultados.json npm run test:ci > reports/karma.log 2>&1
node scripts/ci/avaliar-testes.mjs --codigo-karma $?

# se houver falha nova: o prompt que o agente enviaria (sem a chave, ele só grava o arquivo)
node scripts/ia/diagnosticar-falha.mjs
cat reports/diagnostico/prompt-com-ambiente.md

# testes dos scripts
npm run test:agente
```

No PowerShell, defina a variável antes do comando: `$env:KARMA_RESULTADOS_JSON = 'reports/karma-resultados.json'`.

Para rodar a suíte no fuso do runner (UTC), defina `TZ` antes: `TZ=UTC npm test` no bash, ou
`$env:TZ = 'UTC'; npm test` no PowerShell.

## 6. Limitações

- O `.gitlab-ci.yml` foi escrito como equivalente e validado só quanto à sintaxe: não foi
  executado num runner do GitLab.
- O agente enxerga o que cabe no orçamento do prompt. Uma causa que esteja a dois ou mais níveis
  de import do arquivo de teste pode ficar de fora.
- O diagnóstico é uma hipótese. Um pipeline verde depois da correção sugerida mostra que os
  testes existentes passam, e não que a correção está certa.
- O plano gratuito do Groq tem limite de requisições e de tokens por minuto. Em pipelines com
  muitas falhas simultâneas, o diagnóstico pode demorar ou não sair.

## 7. Arquivos

```text
.github/workflows/ci.yml            pipeline do GitHub Actions
.gitlab-ci.yml                      equivalente para o GitLab CI
ci/falhas-conhecidas.json           quarentena: testes que falham por defeito documentado
karma.conf.js                       reporter que grava o resultado de cada teste em JSON
scripts/ci/
├── coletar-ambiente.mjs            registra sistema, fuso, localidade, Node e navegador
├── avaliar-testes.mjs              portão de qualidade (falhas novas x quarentena)
└── avaliar-testes.test.mjs
scripts/ia/
├── contexto.mjs                    monta o prompt, mascara segredos (funções puras)
├── contexto.test.mjs
└── diagnosticar-falha.mjs          lê os relatórios, chama a API e grava o diagnóstico
```
