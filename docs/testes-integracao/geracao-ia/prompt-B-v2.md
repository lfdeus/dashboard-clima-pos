# Prompt B, versão 2: casos de erro, borda e dados de teste (few-shot, orientado a contrato)

**Tipo:** geração de casos de erro, borda e dados de teste guiados pelo contrato.
**Técnica:** few-shot (um exemplo completo do formato esperado), com uma taxonomia de falhas por
camada e a separação explícita entre regra decidida (invariante) e regra em aberto (lacuna).
**Execução:** Claude Opus 5.5 numa sessão isolada, sem o histórico desta conversa, com leitura
apenas dos arquivos listados no prompt. Resposta salva sem edição em
[`resposta-B-v2.md`](resposta-B-v2.md). O código gerado foi copiado para
[`src/app/integration/erros-e-contrato.integration.spec.ts`](../../../src/app/integration/erros-e-contrato.integration.spec.ts)
e depois executado. Os ajustes feitos à mão estão no [README](../README.md#5-o-que-precisou-de-ajuste-humano).

**O que mudou em relação à v1** (cada item corrige um problema observado em
[`resposta-B-v1.md`](resposta-B-v1.md)):

| Problema na v1 | Ajuste na v2 |
| --- | --- |
| Inventou retry (3 tentativas), timeout de 10 s, códigos `AUTH`, `SERVER`, `TIMEOUT` e `RATE_LIMIT` | Dá a taxonomia real de erros (INV02) e manda ler o service |
| Esperava mensagens que não existem ("Serviço indisponível", "Muitas requisições") | Manda usar as mensagens exatas do código como oráculo |
| Tratou como requisito o que é lacuna (resultado parcial, `switchMap`, fuso da cidade) | Exige teste de caracterização marcado `[Lxx]` para regra não decidida |
| Dados de teste soltos, sem ligação com o contrato | Pede dados derivados do OpenAPI consumido, com o campo violado em cada caso |
| Testes de serviço isolado misturados com os de tela | Fixa a fronteira: a tela inteira com o serviço e o interceptor reais |
| Testou validações locais que o código não tem ("Informe o nome de uma cidade") | Exemplo few-shot mostra o estilo e o nível de verificação esperados |

---

Atue como testador especializado em testes negativos, análise de valor limite e testes de
contrato entre consumidor e provedor.

**Contexto.** Mesmo sistema e mesma cadeia de integração do prompt anterior: usuário →
`SearchBarComponent` → `DashboardComponent` → `WeatherService` → `apiKeyInterceptor` →
`HttpClient` → OpenWeatherMap (`/weather` e `/forecast`, chamadas em paralelo com `forkJoin`).
Leia estes arquivos antes de responder e não presuma nada que não esteja neles:

- `src/app/features/dashboard/dashboard.component.ts` e `.html`
- `src/app/shared/components/search-bar/search-bar.component.ts`
- `src/app/shared/components/error-message/error-message.component.ts`
- `src/app/core/services/weather.service.ts`
- `src/app/core/interceptors/api-key.interceptor.ts`
- `docs/arquitetura/invariantes.md` e `docs/arquitetura/lacunas.md`
- `docs/arquitetura/contratos/openweathermap-consumido.openapi.yaml` e `localstorage.schema.json`

**Taxonomia de falhas** (gere casos em todas as classes):

| Classe | Onde nasce | O que a tela deve mostrar (INV02) |
| --- | --- | --- |
| Rede | status 0 | mensagem de `NETWORK` |
| Autenticação | 401 | mensagem de `UNAUTHORIZED` |
| Negócio | 404 | mensagem de `NOT_FOUND` |
| Limite e servidor | 429, 500, 502, 503 | mensagem de `UNKNOWN` (não há tratamento próprio, L03) |
| Contrato quebrado | 200 com corpo fora do OpenAPI: campo obrigatório ausente, corpo não JSON, `weather: []`, `list: []` | o que o código faz, comparado com o que o contrato diz |
| Atomicidade | uma das duas chamadas falha | INV05: nada parcial na tela |
| Entrada | termo com 0, 1 e 2 caracteres, só espaços, `&`, `=`, `#`, acentos | INV09 e INV03 (a chave não pode ser sobrescrita pela query) |
| Estado e ordem | erro depois de sucesso, sucesso depois de erro, "Tentar novamente", duas buscas sobrepostas, Enter antes do fim do debounce | INV06; L03 e L05 são lacunas |
| Persistência | `localStorage` com JSON inválido ou formato fora do schema | INV07 e L14 |

**Exemplo do formato esperado (few-shot).** Siga este estilo em todos os casos: tela real, só o
HTTP simulado, interação pelo DOM, AAA, ID estável e verificação de tela e de efeitos colaterais.

```ts
it('CE-00: 404 em /weather mostra "Cidade não encontrada" e não grava histórico (INV02, INV06)', fakeAsync(() => {
  // Arrange
  const fixture = criarTela();
  // Act
  buscar(fixture, 'Atlantida');
  responder('/weather', { cod: '404', message: 'city not found' }, 404);
  descartarPendentes('/forecast'); // forkJoin cancela a outra chamada
  tick();
  fixture.detectChanges();
  // Assert
  expect(alerta(fixture)?.textContent).toContain('Cidade não encontrada.');
  expect(localStorage.getItem('clima:history')).toBe('[]');
}));
```

**Oráculo.** Use as mensagens exatas que estão no `WeatherService` e no `DashboardComponent`. Se
o código atual contrariar uma invariante ou o contrato, mantenha o teste com o comportamento
correto e registre o defeito como achado (o teste vai falhar, e isso é esperado). Se o caso cair
numa lacuna, **não decida a regra**: escreva um teste de caracterização que documente o
comportamento atual, com `[Lxx]` no nome, para que ele quebre quando a lacuna for decidida.

**Restrições.** Jasmine + Karma, sem dependência nova, sem alterar o código de produção, sem
`spyOn` em classes da aplicação. Localize elementos por papel ARIA, `aria-label` ou texto.
`fakeAsync`/`tick`, `httpMock.verify()` e `localStorage.clear()` no `afterEach`.

**Formato de saída.**

1. Os dados de teste como uma constante TypeScript `CASOS_HTTP` (id, descrição, endpoint que
   falha, status, corpo, código esperado, mensagem esperada, campo do contrato violado quando
   houver), usada por testes parametrizados.
2. Uma tabela com: ID `CE-xx`, classe, entrada, resultado esperado, regra de origem e se o teste
   é de requisito ou de caracterização.
3. Um único arquivo TypeScript completo, pronto para ser salvo em
   `src/app/integration/erros-e-contrato.integration.spec.ts`, com helpers próprios (não importe
   o arquivo do prompt A).
4. A lista de achados: defeitos reais e perguntas para o time.
