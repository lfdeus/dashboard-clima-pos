# Prompts para testes de integração com GenAI

Atividade da Unidade III: definir pelo menos dois tipos de prompt para apoiar testes de
integração, executar os prompts numa LLM e registrar os casos gerados, e depois avaliar como
cada tipo de prompt influenciou a qualidade e a diversidade dos testes e quais ajustes foram
necessários.

**Resumo.** Dois tipos de prompt, cada um em duas versões. As versões genéricas (v1) geraram 63
casos plausíveis, mas nenhum deles roda contra o código: a LLM inventou um sistema. As versões
com contexto (v2) também geraram 63 casos, e todos rodam: **60 passam e 3 falham, os três por
defeito real do código**. Nenhum falhou por erro do próprio teste. A única alteração manual no
código gerado foi de formatação.

## Sumário

1. [Cenário de integração](#1-cenário-de-integração)
2. [Os dois tipos de prompt](#2-os-dois-tipos-de-prompt)
3. [Resultados](#3-resultados)
4. [Como cada tipo de prompt influenciou a qualidade e a diversidade](#4-como-cada-tipo-de-prompt-influenciou-a-qualidade-e-a-diversidade)
5. [O que precisou de ajuste humano](#5-o-que-precisou-de-ajuste-humano)
6. [Achados](#6-achados)
7. [Os testes pegam defeitos? Teste de mutação](#7-os-testes-pegam-defeitos-teste-de-mutação)
8. [Como executar](#8-como-executar)
9. [Arquivos](#9-arquivos)

## 1. Cenário de integração

O sistema é o próprio Dashboard de Clima deste repositório: uma SPA Angular 19 que consulta a
OpenWeatherMap direto do navegador, sem backend (ver [arquitetura](../arquitetura/README.md)).
A integração testada é o fluxo **front-end → API REST** da jornada "consultar o clima de uma
cidade":

```text
usuário (DOM) → SearchBarComponent → DashboardComponent → WeatherService → apiKeyInterceptor → HttpClient ⇄ OpenWeatherMap
                                          │                                                                    (simulada)
                                          └→ WeatherCard / ForecastCard / pipe temperatureUnit → DOM
                                          └→ localStorage
```

**Fronteira do teste.** Tudo o que pertence à aplicação roda de verdade: componentes,
template, serviço, interceptor, pipes, signals e `localStorage`. Só a OpenWeatherMap é
simulada, com `HttpTestingController`, e as respostas simuladas seguem o
[contrato consumido](../arquitetura/contratos/openweathermap-consumido.openapi.yaml). O teste
é dirigido pelo DOM, como um usuário: digita, confirma, clica.

**Oráculo.** O resultado esperado vem das [invariantes](../arquitetura/invariantes.md) e do
contrato, e não da implementação. Quando o caso cai numa [lacuna](../arquitetura/lacunas.md)
(regra ainda não decidida), o teste é de **caracterização**: registra o comportamento atual,
leva `[Lxx]` no nome e foi feito para quebrar quando a regra for decidida.

## 2. Os dois tipos de prompt

| | Prompt A: cenários de integração | Prompt B: casos de erro e dados de teste |
| --- | --- | --- |
| Objetivo | Fluxo principal de ponta a ponta: o que sai na requisição, o que aparece na tela e o que fica gravado | Falhas por camada, valores limite, contrato quebrado, ordem e concorrência, persistência corrompida |
| Técnica na v2 | Zero-shot com contexto estruturado: papel, arquivos, cadeia, fronteira, oráculo, restrições e formato | Few-shot (um teste completo de exemplo), mais uma taxonomia de falhas e dados derivados do contrato |
| v1 (genérica) | [prompt](geracao-ia/prompt-A-v1.md) · [resposta bruta](geracao-ia/resposta-A-v1.md) | [prompt](geracao-ia/prompt-B-v1.md) · [resposta bruta](geracao-ia/resposta-B-v1.md) |
| v2 (refinada) | [prompt](geracao-ia/prompt-A-v2.md) · [resposta bruta](geracao-ia/resposta-A-v2.md) | [prompt](geracao-ia/prompt-B-v2.md) · [resposta bruta](geracao-ia/resposta-B-v2.md) |

**Como os prompts foram executados.** Cada prompt rodou no Claude Opus 5.5, numa sessão
isolada, sem o histórico da conversa em que o experimento foi planejado. A v1 rodou sem
nenhum acesso ao repositório. A v2 só podia ler os arquivos que o próprio prompt lista. As
respostas foram salvas sem edição. O código da v2 foi copiado para `src/app/integration/` e só
depois executado. Os arquivos de prompt da v2 mostram, numa tabela, qual problema da v1
motivou cada ajuste.

## 3. Resultados

| Versão | Casos gerados | Rodam contra o código? | Passam | Falham | Falhas por defeito real |
| --- | --- | --- | --- | --- | --- |
| A v1 | 31 (CT-01 a CT-31) | **Não.** Importa arquivos e métodos que não existem (`weather.models.ts`, `getByCoords`, `environment.openWeather.apiUrl`) e depende de 35 ocorrências de `data-testid` que o template não tem | — | — | — |
| B v1 | 32 (DI, FA e CB) | **Não.** Supõe um `weather-error.interceptor` com retry e timeout e um `WeatherDashboardComponent`, que não existem | — | — | — |
| A v2 | 15 (CI-01 a CI-15) | Sim | 14 | 1 | 1 (CI-15) |
| B v2 | 48 (CE-00 a CE-47) | Sim | 46 | 2 | 2 (CE-12, CE-42) |

A suíte completa do projeto passou de 28 para 91 testes: 88 passam e 3 falham, e as três falhas
são as descritas na [seção 6](#6-achados). O [catálogo](casos-de-teste.md) lista os 63 casos com
o tipo, o resultado e os mutantes que cada um detecta.

## 4. Como cada tipo de prompt influenciou a qualidade e a diversidade

**v1 contra v2: a diversidade aparente engana.** As duas versões genéricas geraram 63 casos, e
vários pareciam ótimos: retry em 5xx, cache, timeout de 10 s, cancelamento com `switchMap`,
busca por geolocalização. Só que o sistema não faz nada disso. A LLM descreveu um dashboard
"de boas práticas", e não este dashboard. Pior: alguns casos *contrariam* regras decididas.
Trocar °C/°F refazia a busca com `units=imperial`, quando a INV04 diz que a conversão é feita no
cliente. Esses casos servem como lista de requisitos a discutir, mas não como testes. É o mesmo
padrão da atividade de *diagrams as code*: sem contexto, a IA descreve o sistema como ele
*deveria* ser e esconde o que ele *é*.

**Prompt A (cenários): profundidade no fluxo principal.** Com o contexto, os casos ficaram
menos numerosos e muito mais precisos. Eles conferem o que de fato sai na requisição (o
`appid`, `units` e `lang` do interceptor, `q` aparado), o limite exato do debounce (nada em
399 ms, uma busca em 400 ms), a mínima e a máxima vindas de pontos diferentes do mesmo dia, e o
histórico gravado com o nome devolvido pela API, não com o termo digitado. A diversidade é
menor porque o prompt pede o caminho feliz. Mesmo assim ele achou um defeito (CI-15) e um
defeito latente (A5) e caracterizou duas lacunas (L03 e L07).

**Prompt B (erros e dados, few-shot): diversidade organizada.** Este prompt gerou três vezes
mais casos, e a diversidade veio da **taxonomia**: cada classe da tabela (rede, autenticação,
negócio, limite, contrato quebrado, atomicidade, entrada, ordem, persistência) virou um grupo
de testes. O exemplo few-shot fixou o estilo, os nomes dos helpers e o nível de verificação
(tela **e** efeito colateral). Isso evitou testes que só olham uma coisa. Gerar os dados a
partir do contrato fez a LLM testar cada campo obrigatório, e foi assim que apareceu o A1:
o *próprio contrato que eu escrevi* promete um comportamento que o código não tem. Os 7
testes de caracterização deixaram registradas, com execução, as perguntas abertas de L02, L03,
L05, L06 e L14.

**Os dois juntos.** O A garante que a integração funciona no fluxo normal e cobre a
configuração (unidade, tema, histórico). O B cobre o que quebra e documenta o que ainda não
foi decidido. Isolados, cada um dá uma falsa sensação de cobertura em um dos lados.

## 5. O que precisou de ajuste humano

### Nos prompts (v1 → v2)

1. **Ancorar no código.** Listar os arquivos a ler e proibir presumir comportamento. Esse foi
   o ajuste de maior impacto: tirou os casos de "0 executáveis" para "todos executáveis".
2. **Definir a fronteira.** Tudo real, só o HTTP simulado, dirigido pelo DOM, sem `spyOn` em
   classes da aplicação. Sem isso, a v1 misturou teste de serviço isolado, TestBed, Cypress e
   Jest, e chamou tudo de integração.
3. **Dar um oráculo independente.** As invariantes e o contrato, não a implementação. Isso
   permite que um teste falhe por defeito em vez de só confirmar o que o código faz.
4. **Separar regra decidida de regra em aberto.** Sem essa instrução, a LLM escolhe a regra
   sozinha (a v1 decidiu que a última busca vence e que o resultado parcial aparece). Com ela,
   os casos de lacuna viraram testes de caracterização marcados.
5. **Restrições de projeto.** Usar a stack existente, sem dependência nova, sem alterar
   produção e sem `data-testid`, localizando elementos por papel ARIA, `aria-label` ou texto.
6. **Formato de saída.** IDs estáveis, tabela com regra de origem, um arquivo por prompt e uma
   lista de achados. Isso deixou a suíte rastreável até as invariantes.
7. **No prompt B:** o exemplo few-shot e a taxonomia de falhas, que acabaram com mensagens e
   códigos de erro inventados (`AUTH`, `TIMEOUT`, "Serviço indisponível").

### Depois da geração

1. **Formatação.** Os dois arquivos gerados passaram no ESLint, mas não no Prettier, que o CI
   exige. Rodei `prettier --write`. Foi a única alteração no código gerado.
2. **Conferência das premissas que a LLM declarou.** Por exemplo: "não li o
   `api-config.token.ts`" e "talvez seja preciso `TestBed.flushEffects()`". Nenhuma exigiu
   mudança.
3. **Revisão das asserções.** O CE-35 (resposta atrasada sobrescreve a atual, L05) prova o
   problema pela ordem do histórico, mas não confere o cartão exibido, porque o prompt B não
   deu acesso ao `WeatherCardComponent` e a LLM avisou isso. Fica como melhoria. O CI-05 evita
   de propósito vento decimal, porque o separador depende do locale, que já é um defeito (D01).
4. **Decidir o que fazer com os testes vermelhos.** Mantive os três falhando. O prompt pediu
   isso, e é o registro executável do defeito: quando o código for corrigido, eles passam sem
   que ninguém precise lembrar de escrevê-los. Corrigir o código está fora do escopo desta
   atividade.
5. **Verificar se os testes detectam defeitos,** e não só se passam (seção 7).

## 6. Achados

**Defeitos com teste vermelho**

| ID | Teste | Defeito | Regra violada |
| --- | --- | --- | --- |
| D01 | CI-15 | Os dias da semana da previsão saem em inglês ("Tue") numa interface pt-BR. Já era conhecido (ver [arquitetura](../arquitetura/README.md)), e agora tem um teste | INV10 |
| A1 | CE-12 | Se falta um campo obrigatório **escalar** na resposta (`name`, `dt`, `main.temp`...), a busca vira sucesso com `undefined`. Sem `name`, a tela mostra um resultado sem cidade e grava `[null]` no histórico. Se o histórico já tem itens, `toLowerCase()` lança `TypeError` sem tratamento. O contrato diz que todo campo obrigatório ausente vira `UNKNOWN`, mas isso só acontece quando falta um **objeto**. É preciso decidir entre validar a resposta no service ou corrigir o contrato | Contrato, INV06 |
| A2 | CE-42 | A leitura do histórico não aplica o limite de 5 nem remove duplicatas. Com 7 itens gravados, a tela mostra 7 e regrava 7 | INV06, schema |

**Defeitos encontrados na leitura do código, sem teste que falhe**

- **A3:** a mensagem "Ocorreu um erro inesperado. Tente novamente." nunca aparece. Um erro de
  programação na normalização passa pelo `catchError` e chega ao usuário como "Falha ao
  consultar o serviço de clima", sem log nenhum (L11).
- **A4:** "Sem previsão disponível." é código morto. O `@empty` está dentro de um
  `@if (forecast().length > 0)`.
- **A5:** o `SearchBarComponent` lê `debounceMs()` no construtor, antes de o Angular aplicar o
  binding. O `[debounceMs]="400"` do dashboard é ignorado. Hoje não aparece porque o padrão
  também é 400.

**Lacunas agora caracterizadas com teste:** L02 (CE-31), L03 (CI-13, CE-06, CE-37), L05
(CE-35, CE-36), L06 (CE-20), L07 (CI-14) e L14 (CE-47). O CE-47 reproduz a hipótese da L14,
que estava como não reproduzida: com a leitura do `localStorage` bloqueada, a tela nem chega a
ser criada.

**Perguntas novas para o time,** levantadas pela LLM no prompt B: a mensagem de 401 ("Confira
o environment.ts") é instrução para o desenvolvedor e aparece para o usuário final; o status 0
também cobre CORS e DNS, mas a mensagem culpa a internet do usuário; e o tema é gravado já na
primeira visita, então a preferência do sistema deixa de valer a partir da segunda.

## 7. Os testes pegam defeitos? Teste de mutação

Testes gerados por IA podem só confirmar a implementação. Para conferir, injetei seis
defeitos no código, um por vez, e rodei **só** os 63 testes de integração. Os 3 testes que já
falhavam foram descontados.

| Mutante | Defeito injetado | Regra | Novos testes falhando | Detectado? |
| --- | --- | --- | --- | --- |
| M1 | O interceptor anexa a chave em requisições para qualquer host | INV03 | 0 | **Não** |
| M2 | O interceptor pede a API em `imperial` | INV04 | 5 | Sim |
| M3 | O service deixa de traduzir 404 | INV02 | 4 | Sim |
| M4 | O histórico grava o termo digitado antes do sucesso | INV06 | 28 | Sim |
| M5 | O histórico diferencia maiúsculas ao deduplicar | INV06 | 2 | Sim |
| M6 | O histórico guarda 6 itens | INV06 | 2 | Sim |

**5 de 6 detectados.** O M1 sobreviveu por um motivo estrutural, e não por descuido de um
caso. Nesta jornada, toda requisição do `HttpClient` vai para o `baseUrl`, e os ícones são
carregados pelo `<img>`, fora do `HttpClient`. Por isso, nenhum teste de integração tem como
observar a chave indo para outro host. Quem pega esse defeito é o teste **unitário**
do interceptor que já existia ("does not modify requests to other domains"). É um bom exemplo
de que integração não substitui teste unitário: as duas camadas cobrem riscos diferentes.

## 8. Como executar

O projeto exige Node 22 (ver [README](../../README.md#pré-requisitos)).

```bash
# suíte completa (unitários + integração)
npm test

# só os testes de integração
npx ng test --watch=false --browsers=ChromeHeadless --include "src/app/integration/**/*.spec.ts"
```

O resultado esperado hoje é `3 FAILED`: CI-15, CE-12 e CE-42 (ver seção 6).

## 9. Arquivos

```text
docs/testes-integracao/
├── README.md                  este documento
├── casos-de-teste.md          catálogo dos 63 casos, com resultado e mutantes detectados
└── geracao-ia/
    ├── prompt-A-v1.md         cenários, genérico
    ├── resposta-A-v1.md       resposta bruta, sem edição
    ├── prompt-A-v2.md         cenários, com contexto (e o que mudou em relação à v1)
    ├── resposta-A-v2.md
    ├── prompt-B-v1.md         erros e dados, genérico
    ├── resposta-B-v1.md
    ├── prompt-B-v2.md         erros e dados, few-shot e taxonomia
    └── resposta-B-v2.md
src/app/integration/
├── consultar-clima.integration.spec.ts    15 casos (CI), gerados pelo prompt A v2
└── erros-e-contrato.integration.spec.ts   48 casos (CE), gerados pelo prompt B v2
```
