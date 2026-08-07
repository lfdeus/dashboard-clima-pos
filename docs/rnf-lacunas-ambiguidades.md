# Requisitos Não Funcionais, Lacunas e Ambiguidades — Dashboard de Clima

> **Atividade prática de Engenharia de Requisitos**
> Recorte da análise do documento de elicitação do sistema **Dashboard de Clima** (`dashboard-clima`), com apoio de **IA Generativa**, focado em **requisitos não funcionais**, **lacunas** e **ambiguidades**.
>
> Documento completo (com requisitos funcionais, regras de negócio e artefatos): [`analise-requisitos.md`](analise-requisitos.md).

---

## Identificação

| Campo | Conteúdo |
| --- | --- |
| **Disciplina** | Engenharia de Requisitos / Especificação de Software |
| **Curso** | Pós-Graduação |
| **Aluno(a)** | _[preencher]_ |
| **Sistema analisado** | Dashboard de Clima (`dashboard-clima`) |
| **Ferramenta de IA Generativa** | Claude (Anthropic) |
| **Data** | _[preencher]_ |

---

## Sumário

1. [Contexto](#1-contexto)
2. [Requisitos Não Funcionais (RNF)](#2-requisitos-não-funcionais-rnf)
3. [Lacunas identificadas](#3-lacunas-identificadas)
4. [Ambiguidades identificadas](#4-ambiguidades-identificadas)
5. [Síntese](#5-síntese)

---

## 1. Contexto

O **Dashboard de Clima** é uma _Single Page Application_ (SPA) que consome a API pública do [OpenWeatherMap](https://openweathermap.org/api) para exibir o clima atual e a previsão de cinco dias de qualquer cidade. Este recorte parte do mesmo **documento de elicitação** (transcrição de entrevista cliente↔analista) do documento principal, cujas falas estão marcadas com os identificadores `[E1]…[E22]` para rastreabilidade.

O foco aqui são as três dimensões de análise mais associadas à **qualidade** e ao **amadurecimento** do documento:

- **Requisitos Não Funcionais (RNF)** — atributos de qualidade e restrições (ISO/IEC 25010);
- **Lacunas** — informações **ausentes** que precisam ser confirmadas com o cliente;
- **Ambiguidades** — trechos **presentes**, porém abertos a mais de uma interpretação.

> **Papel da IA.** A IA Generativa foi usada como **apoio** para (i) traduzir falas subjetivas do cliente em atributos de qualidade objetivos, (ii) sinalizar o que o cliente **não disse** e (iii) apontar trechos dúbios. Todas as classificações e resoluções foram **validadas pelo analista**; suposições não confirmadas foram rebaixadas a _lacuna_ em vez de tratadas como fato.

---

## 2. Requisitos Não Funcionais (RNF)

> _Atributos de **qualidade** e restrições do sistema (ISO/IEC 25010)._

| ID | Requisito Não Funcional | Categoria | Origem |
| --- | --- | --- | --- |
| **RNF01** | A interface deve ser **responsiva**, funcionando em celular, tablet e desktop. | Usabilidade / Portabilidade | E13 |
| **RNF02** | Oferecer **tema escuro** e claro para conforto visual. | Usabilidade | E14 |
| **RNF03** | Tempo de resposta percebido baixo; feedback imediato de carregamento e busca com _debounce_. | Desempenho | E19 |
| **RNF04** | O sistema deve ser **acessível** (rótulos ARIA, navegação por teclado, contraste WCAG AA). | Acessibilidade | E13 (derivado / boa prática) |
| **RNF05** | Interface e mensagens em **Português (Brasil)**. | Usabilidade / i18n | E16 |
| **RNF06** | Falhas (rede, cidade inexistente, credencial inválida) devem ser tratadas **sem quebrar a interface**, com mensagem clara. | Confiabilidade / Robustez | E17, E18 |
| **RNF07** | O sistema deve ser **facilmente executável e implantável** (empacotamento em container, sem instalação complexa). | Portabilidade / Implantação | E20 |
| **RNF08** | Deve haver **testes automatizados** com cobertura mínima definida (≥ 70%). | Manutenibilidade / Qualidade | E21 |
| **RNF09** | O código deve ser **organizado e legível**, adequado a apresentação acadêmica (padrões de projeto, lint, formatação). | Manutenibilidade | E21 |
| **RNF10** | A disponibilidade dos dados depende de um **serviço externo de terceiros** (OpenWeatherMap); o sistema deve degradar graciosamente quando ele estiver indisponível. | Confiabilidade / Restrição | E17 (derivado) |
| **RNF11** | O acesso é **público/anônimo**, sem autenticação nesta versão. | Segurança / Restrição | E22 |

---

## 3. Lacunas identificadas

> _Informações **ausentes** no documento que o analista precisa **confirmar com o cliente** antes de especificar completamente. A IA foi usada para sinalizar o que o cliente não disse — não para inventar a resposta._

| ID | Lacuna | Impacto | Pergunta a levar ao cliente |
| --- | --- | --- | --- |
| **L01** | Nada foi dito sobre **cidades homônimas** (ex.: "Springfield", ou "São Paulo" cidade vs. estado). | Médio | Como desambiguar? Mostrar país/estado, lista de sugestões? |
| **L02** | **Comportamento offline** e ausência de rede não foram detalhados além de "avisar". | Médio | Deve haver cache do último resultado para exibição offline? |
| **L03** | **Retenção do histórico** não foi definida (por quanto tempo? persiste entre dispositivos?). | Baixo | Confirmar limite (assumido 5) e escopo (assumido local). |
| **L04** | **Geolocalização** ("clima da minha localização atual") não foi mencionada. | Médio | É desejável detectar a cidade automaticamente? |
| **L05** | **Limites de uso da API** (plano gratuito tem teto de requisições/minuto) não foram tratados. | Alto | Como reagir ao estouro do limite (HTTP 429)? Cache? Fila? |
| **L06** | **Privacidade / LGPD** do histórico e preferências armazenados no navegador. | Baixo | É necessário aviso de armazenamento local ao usuário? |
| **L07** | **Alertas meteorológicos**, favoritos ou notificações não foram citados. | Baixo | Fazem parte de versões futuras (fora do escopo atual)? |
| **L08** | **Critérios objetivos de desempenho** ("rápido") não foram quantificados. | Médio | Definir meta (ex.: resposta < 2 s em 3G, bundle < 200 KB). |
| **L09** | **Segurança da chave de API**: numa SPA a chave fica exposta no navegador. | Alto | Aceita o risco (uso acadêmico) ou exige _backend proxy_? |
| **L10** | **Navegadores/dispositivos suportados** não foram delimitados. | Baixo | Definir matriz mínima de suporte. |

---

## 4. Ambiguidades identificadas

> _Trechos **presentes** no documento, porém **imprecisos ou interpretáveis de mais de uma forma**. Foram resolvidos por decisão de projeto (com premissa explícita) ou marcados para validação._

| ID | Trecho ambíguo | Interpretações possíveis | Resolução adotada |
| --- | --- | --- | --- |
| **A01** | "os próximos dias / uma semaninha" `[E7]` | 3, 5 ou 7 dias | **5 dias** — limite prático da fonte gratuita. Validar com cliente. |
| **A02** | "essas coisas / quanto mais completo melhor" `[E2]` | Conjunto de campos indefinido | Definido escopo fechado de campos (clima atual). |
| **A03** | "lembrar as últimas cidades" `[E11]` | Quantidade e ordem indefinidas | **5 cidades, mais recente no topo, sem duplicatas**. |
| **A04** | "tem que ser rápido" `[E19]` | Métrica subjetiva | Traduzido em RNF03; **quantificação pendente** (ver L08). |
| **A05** | "funcionar no celular" `[E13]` | Só celular? Quais tamanhos? | Interpretado como **responsivo mobile/tablet/desktop** (RNF01). |
| **A06** | "em português" `[E16]` | Só PT-BR ou multi-idioma? | **Somente PT-BR** nesta versão (RNF05). |
| **A07** | "ícone bonitinho" `[E6]` | Estético e subjetivo | Traduzido em requisito objetivo (ícone + descrição textual). |
| **A08** | "rode em qualquer lugar sem dor de cabeça" `[E20]` | Multiplataforma? Web? Instalável? | Interpretado como **empacotamento em container** (RNF07). |
| **A09** | "modo escuro… que já abra do jeito do celular" `[E14, E15]` | Automático sempre ou só na 1ª vez? | **Automático na primeira visita; escolha do usuário prevalece depois**. |

---

## 5. Síntese

| Dimensão | Quantidade | Observação principal |
| --- | --- | --- |
| **Requisitos Não Funcionais** | 11 | Predominam **usabilidade** e **confiabilidade**; várias RNF nasceram de falas subjetivas ("rápido", "bonito", "sem dor de cabeça") traduzidas em atributos objetivos. |
| **Lacunas** | 10 | As de **maior impacto** são o limite de uso da API (**L05**) e a exposição da chave numa SPA (**L09**) — ambas de natureza técnica que o cliente não percebeu. |
| **Ambiguidades** | 9 | A mais crítica é a quantidade de dias da previsão (**A01**), resolvida por restrição da fonte de dados; as demais foram fechadas com premissa explícita. |

**Encaminhamento.** As **lacunas de impacto Alto/Médio** (L01, L02, L04, L05, L08, L09) devem virar **pauta de uma reunião de refinamento** com o cliente antes do fechamento da especificação. As **ambiguidades** já receberam resolução provisória com premissa registrada, permitindo o avanço do projeto sem bloqueio — sujeitas a confirmação.

---

> _Recorte elaborado como atividade prática de Engenharia de Requisitos, com apoio de IA Generativa (Claude). Sistema de referência: `dashboard-clima`. Dados meteorológicos: OpenWeatherMap._
