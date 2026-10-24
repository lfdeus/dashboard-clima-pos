# Catálogo dos casos de teste de integração

Os 63 casos gerados pelas versões finais dos prompts e executados contra o código. A fonte de
verdade é o próprio código dos testes:

- **CI-xx:** [`consultar-clima.integration.spec.ts`](../../src/app/integration/consultar-clima.integration.spec.ts), gerado pelo [prompt A v2](geracao-ia/prompt-A-v2.md)
- **CE-xx:** [`erros-e-contrato.integration.spec.ts`](../../src/app/integration/erros-e-contrato.integration.spec.ts), gerado pelo [prompt B v2](geracao-ia/prompt-B-v2.md). CE-01 a CE-18 vêm da tabela `CASOS_HTTP` e rodam num teste parametrizado

As tabelas completas, com pré-condição, passos e resultado esperado de cada caso, estão nas
respostas brutas: [A v2](geracao-ia/resposta-A-v2.md#1-cenários) e
[B v2](geracao-ia/resposta-B-v2.md#2-tabela-de-casos).

**Legenda**

- **Requisito:** o resultado esperado vem de uma invariante (INVxx) ou do contrato. Se falha,
  existe um defeito.
- **Caracterização:** o caso cai numa lacuna (Lxx), uma regra que ainda não foi decidida. O
  teste registra o comportamento atual e foi feito para quebrar quando a lacuna for decidida.
- **Mutantes que detecta:** defeitos injetados de propósito no código, um por vez (ver
  [README, seção 7](README.md#7-os-testes-pegam-defeitos-teste-de-mutação)). O sinal "—" não
  quer dizer que o teste é fraco: nenhum dos seis mutantes tocava aquela regra.

**Resultado em 24/10/2026:** 63 casos, 54 de requisito e 9 de caracterização. 60 passam e 3
falham, todos por defeito real do código.

| ID | Caso (nome do teste) | Tipo | Resultado hoje | Mutantes que detecta |
| --- | --- | --- | --- | --- |
| CI-01 | busca confirmada com Enter consulta clima e previsão e exibe o resultado | Requisito | Passa | M4 |
| CI-02 | busca pela digitação consulta só o termo final, 400 ms após a última tecla (INV09) | Requisito | Passa | — |
| CI-03 | termo com menos de 2 caracteres não consulta a API, nem por digitação nem por Enter (INV09) | Requisito | Passa | — |
| CI-04 | requisições levam q do service e appid, units=metric e lang=pt_br do interceptor (contrato, INV03, INV04) | Requisito | Passa | M2 |
| CI-05 | renderiza o clima atual normalizado, com ícone sem a chave da API (contrato, INV03) | Requisito | Passa | — |
| CI-06 | agrupa a previsão por dia, com mínima e máxima do dia e no máximo 5 cartões (contrato) | Requisito | Passa | — |
| CI-07 | grava no histórico só após o sucesso e com o nome devolvido pela API (INV06) | Requisito | Passa | M4 |
| CI-08 | histórico põe a mais recente no topo, sem repetir (sem diferenciar caixa) e com no máximo 5 (INV06) | Requisito | Passa | M5, M6 |
| CI-09 | clicar num item do histórico consulta aquela cidade e a move para o topo (INV06) | Requisito | Passa | M2 |
| CI-10 | alterna °C/°F no cliente, sem nova requisição, e persiste a unidade (INV04, INV07) | Requisito | Passa | — |
| CI-11 | restaura unidade, tema e histórico do localStorage ao abrir a tela (INV07, INV04) | Requisito | Passa | M2 |
| CI-12 | valores inválidos no localStorage voltam ao padrão do contrato (localstorage.schema.json) | Requisito | Passa | — |
| CI-13 | [L03] caracteriza: Enter antes do fim do debounce dispara duas buscas (4 requisições) | Caracterização | Passa | — |
| CI-14 | [L07] caracteriza: a previsão é agrupada pela data UTC de dt_txt, sem usar o fuso da cidade | Caracterização | Passa | — |
| CI-15 | exibe o dia da semana da previsão em português do Brasil (INV10) | Requisito | **Falha (defeito D01, INV10)** | — |
| CE-00 | 404 em /weather mostra "Cidade não encontrada" e não grava histórico (INV02, INV06) | Requisito | Passa | M3, M4 |
| CE-01 | status 0 em /weather mostra a mensagem de NETWORK e cancela /forecast | Requisito | Passa | M4 |
| CE-02 | status 0 em /forecast mostra a mensagem de NETWORK e cancela /weather | Requisito | Passa | M4 |
| CE-03 | 401 em /weather mostra a mensagem de UNAUTHORIZED | Requisito | Passa | M4 |
| CE-04 | 401 em /forecast depois de /weather 200 descarta o clima atual | Requisito | Passa | M4 |
| CE-05 | 404 em /forecast depois de /weather 200 mostra NOT_FOUND e nada parcial | Requisito | Passa | M3, M4 |
| CE-06 | [L03] 429 em /weather cai em UNKNOWN, sem mensagem própria | Caracterização | Passa | M4 |
| CE-07 | 500 em /weather depois de /forecast 200 mostra UNKNOWN e nada parcial | Requisito | Passa | M4 |
| CE-08 | 502 com página HTML em /forecast mostra UNKNOWN | Requisito | Passa | M4 |
| CE-09 | 503 em /weather mostra UNKNOWN | Requisito | Passa | M4 |
| CE-10 | 200 em /weather sem `main` mostra UNKNOWN | Requisito | Passa | M4 |
| CE-11 | 200 em /weather sem `sys` mostra UNKNOWN | Requisito | Passa | M4 |
| CE-12 | 200 em /weather sem `name` mostra UNKNOWN e não grava histórico | Requisito | **Falha (defeito A1)** | — |
| CE-13 | 200 em /weather com corpo não JSON mostra UNKNOWN | Requisito | Passa | M4 |
| CE-14 | 200 em /forecast sem `list` depois de /weather 200 mostra UNKNOWN | Requisito | Passa | M4 |
| CE-15 | 200 em /forecast com item sem `dt_txt` mostra UNKNOWN | Requisito | Passa | M4 |
| CE-16 | 200 em /forecast com item sem `main` mostra UNKNOWN | Requisito | Passa | M4 |
| CE-17 | 200 em /forecast com o ponto das 12:00 sem `weather` mostra UNKNOWN | Requisito | Passa | M4 |
| CE-18 | 200 em /forecast com corpo não JSON depois de /weather 200 mostra UNKNOWN | Requisito | Passa | M4 |
| CE-19 | /weather com `weather: []` é aceito e grava o nome da API (contrato: "a lista pode vir vazia") | Requisito | Passa | — |
| CE-20 | [L06] /forecast com `list: []` mostra só o clima atual, sem aviso de previsão (caracterização) | Caracterização | Passa | — |
| CE-21 | /weather respondido não aparece enquanto /forecast não responde (INV05) | Requisito | Passa | M4 |
| CE-22 | termo vazio não dispara requisição, nem digitado nem confirmado (INV09) | Requisito | Passa | — |
| CE-23 | termo com 1 caractere não dispara requisição, nem digitado nem confirmado (INV09) | Requisito | Passa | — |
| CE-24 | termo só com espaços ou com 1 caractere entre espaços não dispara requisição (INV09) | Requisito | Passa | — |
| CE-25 | termo com 2 caracteres só busca ao completar 400 ms de debounce (INV09, valor limite) | Requisito | Passa | M4 |
| CE-26 | espaços nas pontas são removidos antes de enviar `q` (contrato: parâmetro q, INV09) | Requisito | Passa | — |
| CE-27 | `&`, `=` e `#` no termo não sobrescrevem appid, units nem lang (INV03, INV04) | Requisito | Passa | M2, M4 |
| CE-28 | termo acentuado vai codificado em UTF-8 em `q` (contrato: parâmetro q) | Requisito | Passa | — |
| CE-29 | o histórico guarda o nome devolvido pela API, não o termo digitado (INV06) | Requisito | Passa | M4 |
| CE-30 | erro depois de sucesso mostra a nova mensagem e mantém o histórico (INV02, INV06) | Requisito | Passa | M3, M4 |
| CE-31 | [L02] erro depois de sucesso descarta o último resultado exibido (caracterização) | Caracterização | Passa | — |
| CE-32 | sucesso depois de erro remove o alerta e grava o histórico (INV02, INV06) | Requisito | Passa | M4 |
| CE-33 | "Tentar novamente" repete a mesma busca e, com sucesso, remove o alerta (INV02, INV06) | Requisito | Passa | — |
| CE-34 | "Tentar novamente" que falha com outro status troca a mensagem (INV02) | Requisito | Passa | M4 |
| CE-35 | [L05] resposta atrasada de uma busca antiga sobrescreve a busca atual (caracterização) | Caracterização | Passa | — |
| CE-36 | [L05] erro atrasado de uma busca antiga apaga um resultado válido (caracterização) | Caracterização | Passa | M3, M4 |
| CE-37 | [L03] Enter antes do fim do debounce dispara duas buscas, 4 requisições (caracterização) | Caracterização | Passa | — |
| CE-38 | alternar °C/°F não gera requisição e a API segue em `metric` (INV04, INV07) | Requisito | Passa | M2 |
| CE-39 | `clima:history` com JSON inválido abre a tela sem histórico e regrava `[]` (INV07, schema) | Requisito | Passa | — |
| CE-40 | `clima:history` que não é array vira lista vazia (INV07, schema) | Requisito | Passa | — |
| CE-41 | itens de `clima:history` que não são string são descartados (INV07, schema) | Requisito | Passa | — |
| CE-42 | `clima:history` com 7 itens nunca exibe nem regrava mais de 5 (INV06, schema maxItems) | Requisito | **Falha (defeito A2)** | — |
| CE-43 | com 5 itens, uma nova cidade entra no topo e a mais antiga sai (INV06, valor limite) | Requisito | Passa | M6 |
| CE-44 | cidade repetida com outra caixa sobe para o topo sem duplicar (INV06) | Requisito | Passa | M5 |
| CE-45 | `clima:unit` fora do schema é lido como celsius (INV07, schema) | Requisito | Passa | — |
| CE-46 | `clima:theme` fora do schema cai na preferência do sistema e fica coerente (INV07, schema) | Requisito | Passa | — |
| CE-47 | [L14] com o localStorage bloqueado, a tela nem é criada (caracterização) | Caracterização | Passa | — |
