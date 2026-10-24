# Prompt A, versão 1: cenários de integração (genérico, zero-shot)

**Tipo:** geração de cenários de integração (fluxo principal).
**Técnica:** zero-shot, sem contexto do código.
**Execução:** Claude Opus 5.5 numa sessão isolada, sem acesso ao repositório e sem o histórico
desta conversa. Resposta salva sem edição em [`resposta-A-v1.md`](resposta-A-v1.md).

---

Atue como especialista em testes de software. Gere casos de teste de integração para um
dashboard de clima feito em Angular que consome a API do OpenWeatherMap. Inclua o código dos
testes.
