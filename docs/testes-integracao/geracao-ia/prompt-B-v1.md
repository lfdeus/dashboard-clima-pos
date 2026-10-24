# Prompt B, versão 1: casos de erro e dados de teste (genérico, zero-shot)

**Tipo:** geração de casos de erro, borda e dados de teste.
**Técnica:** zero-shot, sem contexto do código.
**Execução:** Claude Opus 5.5 numa sessão isolada, sem acesso ao repositório e sem o histórico
desta conversa. Resposta salva sem edição em [`resposta-B-v1.md`](resposta-B-v1.md).

---

Atue como especialista em testes de software. Gere casos de teste de integração de erro para
um dashboard de clima feito em Angular que consome a API do OpenWeatherMap, cobrindo dados
inválidos, falhas da API e casos de borda. Inclua o código dos testes e os dados de teste.
