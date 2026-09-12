# Prompt usado na geração dos diagramas

Registro literal do prompt enviado ao modelo. O modelo recebeu **apenas este texto**:
não teve acesso ao código-fonte, ao repositório nem a documentos anteriores.

- Modelo: Claude (Anthropic), sessão sem acesso a ferramentas ou arquivos
- Data: 12/09/2026
- Resposta bruta, sem edição: [`resposta-bruta.md`](resposta-bruta.md)

---

Você é um arquiteto de software. Com base **apenas** na descrição abaixo, gere em Mermaid
(sintaxe compatível com a renderização do GitHub):

1. Um diagrama estrutural de **containers**, inspirado no C4 nível 2.
2. Um diagrama de **sequência** da jornada crítica "consultar o clima de uma cidade",
   incluindo os caminhos de erro, e não só o caminho feliz.

Depois dos diagramas, liste as suposições que você fez para preencher o que a descrição
não diz.

## Descrição do sistema — Dashboard de Clima

**O que é.** Aplicação web de página única para consultar o clima atual e a previsão dos
próximos 5 dias de qualquer cidade do mundo, a partir do nome digitado. Público: qualquer
pessoa com navegador, sem cadastro nem login. É um projeto acadêmico e não tem operação em
produção.

**Nível da visão.** Containers (peças que rodam ou são implantadas separadamente) e uma
jornada de comportamento. Não é preciso descer a componentes internos.

**Escopo.** Dentro: busca por nome de cidade (enquanto digita ou ao confirmar), clima atual
(temperatura, sensação térmica, mínima/máxima, umidade, vento, pressão, nuvens, ícone e
descrição), previsão de 5 dias com um cartão por dia, alternância °C/°F, tema claro/escuro,
histórico das 5 últimas cidades e mensagens de erro com opção de tentar novamente.
Fora: contas de usuário, favoritos, alertas, geolocalização, mapas e séries históricas.

**Peças que existem hoje.**

1. Aplicação web (Angular 19, TypeScript), executada no navegador do usuário. Concentra a
   lógica: busca, chamadas à API de clima, transformação dos dados, estado da tela e
   conversão de unidade.
2. Servidor web (nginx em container Docker), que entrega os arquivos compilados da aplicação.
3. Armazenamento local do navegador, que guarda o histórico, a unidade preferida e o tema.
4. OpenWeatherMap (serviço externo): API REST de clima, com um endpoint de condição atual e
   outro de previsão em intervalos de 3 horas, além de um servidor de ícones.
5. Google Fonts (serviço externo): fonte tipográfica usada pela interface.
6. Pipeline de CI (GitHub Actions): lint, testes e build.

**Integrações.** A API de clima é chamada via HTTPS e autenticada por uma chave de API
enviada como parâmetro da requisição, pedindo idioma pt_br e unidades métricas. Os ícones
são imagens referenciadas pelo código de ícone que a API devolve.

**Restrições.** Não há backend próprio. A chave de API entra na aplicação no momento do
build, a partir de um arquivo de ambiente que fica fora do controle de versão. O plano
gratuito da API limita a previsão a 5 dias em intervalos de 3 horas e impõe um limite de
requisições. Interface e dados em português do Brasil. Acesso anônimo. A implantação é uma
imagem Docker multi-stage (build com Node 22, execução com nginx).

**Lacunas conhecidas.** Não há metas definidas de desempenho, disponibilidade ou volume.
Não se decidiu se a chave de API deve ser protegida nem como reagir ao limite de requisições.
Não existe ambiente de produção definido.
