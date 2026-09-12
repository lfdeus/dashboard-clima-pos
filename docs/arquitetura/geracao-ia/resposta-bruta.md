# Resposta bruta do modelo

Resposta ao prompt de [`prompt.md`](prompt.md), registrada **sem edição**. Ela serve de
linha de base: os diagramas ajustados estão em [`../diagrams/`](../diagrams/), e cada
diferença é explicada na seção "O que a IA inferiu, o que foi ajustado e por quê" do
[README](../README.md#9-o-que-a-ia-inferiu-o-que-foi-ajustado-e-por-quê).

> Os diagramas abaixo **não** representam o sistema real. Não use este arquivo como
> contexto de implementação.

---

## 1. Diagrama de containers (inspirado no C4 nível 2)

```mermaid
flowchart TB
    user(["Pessoa usuária<br/>[Pessoa]<br/>Acesso anônimo, qualquer navegador"])

    subgraph sistema["Sistema: Dashboard de Clima"]
        direction TB
        nginx["Servidor web<br/>[Container: nginx em Docker]<br/>Entrega os arquivos estáticos compilados da SPA"]
        spa["Aplicação web SPA<br/>[Container: Angular 19 / TypeScript, executa no navegador]<br/>Busca, chamadas à API, transformação dos dados,<br/>estado da tela, conversão °C/°F, tema"]
        ls[("Armazenamento local<br/>[Container: localStorage do navegador]<br/>Histórico das 5 últimas cidades, unidade preferida, tema")]
    end

    subgraph externos["Sistemas externos"]
        owm["OpenWeatherMap API<br/>[Sistema externo: REST / JSON]<br/>Condição atual e previsão de 5 dias em intervalos de 3 h"]
        ico["OpenWeatherMap - servidor de ícones<br/>[Sistema externo: imagens PNG]"]
        gf["Google Fonts<br/>[Sistema externo: CSS + arquivos de fonte]"]
    end

    subgraph entrega["Construção e entrega (fora do tempo de execução)"]
        direction TB
        dev(["Pessoa desenvolvedora"])
        ci["Pipeline de CI<br/>[GitHub Actions]<br/>Lint, testes, build"]
        img["Build da imagem Docker multi-stage<br/>[Estágio 1: Node 22 compila / Estágio 2: nginx serve]"]
        envf["Arquivo de ambiente<br/>[Configuração fora do Git]<br/>Chave da API"]
    end

    user -->|"Acessa a URL (HTTP/HTTPS)"| nginx
    nginx -->|"Entrega index.html, JS, CSS e assets"| spa
    user -->|"Interage: busca, histórico, °C/°F, tema"| spa
    spa -->|"Lê e grava JSON (Web Storage API)"| ls
    spa -->|"GET condição atual e previsão<br/>HTTPS / JSON, appid na query, lang=pt_br, units=metric"| owm
    spa -->|"Carrega ícones pelo código devolvido pela API (HTTPS)"| ico
    spa -->|"Carrega fonte tipográfica (HTTPS)"| gf

    dev -->|"Envia código (push / pull request)"| ci
    dev -->|"Executa docker build"| img
    envf -.->|"Lido no ng build: a chave fica embutida no bundle JS"| img
    img -.->|"Gera a imagem que contém o servidor e os arquivos compilados"| nginx

    classDef person fill:#08427b,stroke:#052e56,color:#ffffff
    classDef container fill:#1168bd,stroke:#0b4884,color:#ffffff
    classDef external fill:#8a8a8a,stroke:#6b6b6b,color:#ffffff
    classDef build fill:#eeeeee,stroke:#888888,color:#000000,stroke-dasharray: 5 5

    class user,dev person
    class nginx,spa,ls container
    class owm,ico,gf external
    class ci,img,envf build

    style sistema fill:none,stroke:#1168bd,stroke-width:2px,stroke-dasharray: 5 5
    style externos fill:none,stroke:#8a8a8a,stroke-dasharray: 5 5
    style entrega fill:none,stroke:#888888,stroke-dasharray: 5 5
```

## 2. Diagrama de sequência: "consultar o clima de uma cidade"

```mermaid
sequenceDiagram
    autonumber
    actor U as Pessoa usuária
    participant SPA as Aplicação web (Angular 19, no navegador)
    participant LS as Armazenamento local (localStorage)
    participant API as OpenWeatherMap API REST
    participant ICO as OpenWeatherMap servidor de ícones

    Note over U,LS: Pré-condição. SPA já servida pelo nginx. Tema, unidade e histórico já lidos do localStorage.

    alt Busca por digitação ou confirmação
        U ->> SPA: Digita o nome da cidade (ou pressiona Enter)
        SPA ->> SPA: Debounce de cerca de 500 ms (Enter dispara na hora), trim, cancela consulta pendente
    else Seleção no histórico
        U ->> SPA: Escolhe uma das 5 últimas cidades
    end

    alt Termo inválido (vazio ou com menos de 2 caracteres)
        SPA -->> U: Não chama a API e mantém a tela atual
    else Termo válido
        SPA -->> U: Exibe indicador de carregamento
        par Condição atual
            SPA ->> API: GET /data/2.5/weather (q, appid, lang=pt_br, units=metric)
        and Previsão de 5 dias em intervalos de 3 h
            SPA ->> API: GET /data/2.5/forecast (q, appid, lang=pt_br, units=metric)
        end
        Note over SPA,API: As duas chamadas são combinadas no modo tudo ou nada. Falha em qualquer uma leva ao ramo de erro correspondente.

        alt Ambas respondem 200 OK com payload válido
            API -->> SPA: JSON da condição atual
            API -->> SPA: JSON com 40 pontos de 3 h
            SPA ->> SPA: Mapeia para o modelo de tela e agrupa a previsão por dia local da cidade (mín, máx, ícone do dia)
            SPA ->> SPA: Converte para °F se esta for a unidade preferida
            SPA -->> U: Renderiza o clima atual e os 5 cartões de previsão
            SPA ->> ICO: GET ícone por código (ex. 10d@2x.png)
            alt Ícone carregado
                ICO -->> SPA: Imagem PNG
            else Falha ao carregar o ícone
                ICO --x SPA: Erro de rede ou 404
                SPA -->> U: Mostra ícone genérico e mantém a descrição em texto
            end
            SPA ->> LS: Grava a cidade no histórico (sem duplicatas, mais recente primeiro, máx. 5)
            alt Armazenamento indisponível ou cota excedida
                LS --x SPA: Exceção ao gravar
                SPA ->> SPA: Ignora o erro e segue sem atualizar o histórico
            end
        else 404 cidade não encontrada
            API -->> SPA: 404 city not found
            SPA -->> U: Cidade não encontrada, verifique o nome + Tentar novamente
        else 401 chave de API inválida ou ausente
            API -->> SPA: 401 Invalid API key
            SPA -->> U: Serviço de clima indisponível no momento + Tentar novamente
        else 429 limite de requisições excedido
            API -->> SPA: 429 Too Many Requests
            SPA -->> U: Limite de consultas atingido, aguarde alguns instantes + Tentar novamente
        else 5xx, falha de rede ou timeout
            API --x SPA: Erro 5xx, status 0 ou sem resposta em 10 s
            SPA -->> U: Não foi possível obter o clima + Tentar novamente
        else 200 com payload inesperado
            SPA ->> SPA: Falha ao transformar os dados
            SPA -->> U: Erro ao processar os dados do clima + Tentar novamente
        end

        opt Usuária aciona Tentar novamente
            U ->> SPA: Clica em Tentar novamente
            SPA ->> SPA: Reexecuta a mesma consulta a partir das requisições paralelas (sem retentativa automática)
        end
    end

    opt Alternância de unidade após o resultado
        U ->> SPA: Alterna °C / °F
        SPA ->> SPA: Reconverte os valores já carregados, sem nova chamada à API
        SPA ->> LS: Grava a unidade preferida
    end
```

## 3. Suposições

**Estrutura e integrações**

1. O armazenamento local é o `localStorage`, com valores serializados em JSON. Não é `sessionStorage` nem IndexedDB. Aparece como container porque a descrição o lista como peça, mas na prática faz parte do navegador.
2. Os endpoints são os do plano gratuito, `/data/2.5/weather` e `/data/2.5/forecast`, com a cidade passada pelo parâmetro `q`. Não se usa a API de geocodificação. A previsão devolve 40 pontos de 3 horas.
3. O navegador carrega os ícones direto do servidor de ícones da OpenWeatherMap, por uma URL montada com o código do ícone (padrão do tipo `.../img/wn/{código}@2x.png`). Não há proxy nem cópia local.
4. A OpenWeatherMap aceita requisições cross-origin (CORS) vindas do navegador, já que não existe backend próprio nem proxy.
5. O Google Fonts é carregado por um `<link>` no `index.html`. Se falhar, a interface usa uma fonte do sistema. Esse caminho não aparece na sequência porque não afeta a jornada.
6. O protocolo entre navegador e nginx fica como HTTP/HTTPS, porque não há ambiente de produção nem TLS definidos.
7. Uma consequência da restrição de build: a chave de API fica embutida no bundle JavaScript e qualquer pessoa que abrir a aplicação consegue vê-la. O diagrama registra esse fato, mas não decide se a chave deve ser protegida.
8. O repositório fica no GitHub, o que se deduz do uso do GitHub Actions. O pipeline roda a cada push ou pull request, faz lint, testes e build, e não gera nem publica a imagem Docker. O `docker build` é executado à mão. Como o CI obtém a chave (secret ou valor fictício) não está definido.

**Comportamento da jornada**

9. "Enquanto digita" quer dizer disparar a busca sozinha depois de um debounce (cerca de 500 ms), com mínimo de 2 caracteres. Não há lista de sugestões. O Enter dispara na hora. Uma nova digitação cancela a requisição pendente (padrão `switchMap`). Esses valores são arbitrários.
10. As duas chamadas (condição atual e previsão) saem em paralelo e o resultado é tudo ou nada: não se exibe resultado parcial.
11. O cliente usa um timeout de 10 segundos, porque o HttpClient do Angular não tem timeout padrão.
12. Não há retentativa automática, backoff nem cache de respostas, inclusive para o 429. Como a reação ao limite de requisições é uma lacuna, a opção mais simples foi mostrar a mensagem e deixar a pessoa tentar de novo.
13. Os erros são tratados pelo status HTTP (404, 401, 429, 5xx/status 0, payload inválido). As mensagens em pt-BR são sugestões. "Tentar novamente" aparece em todos os erros, incluindo o 404, como pede o escopo.
14. A mensagem de erro substitui a área de resultados, e o indicador de carregamento some em todos os ramos.
15. A cidade só entra no histórico quando a consulta dá certo. O histórico não tem duplicatas (comparação sem diferenciar maiúsculas), a mais recente fica em primeiro e o limite é 5. Falhas ao gravar no `localStorage` são ignoradas e não bloqueiam a tela.
16. A API sempre é chamada com `units=metric`, e a conversão para °F acontece no cliente (°F = °C × 9/5 + 32). Por analogia, o vento passa de m/s para mph. Trocar a unidade não gera nova requisição.
17. A previsão é agrupada por dia local da cidade usando o fuso (`timezone`) que a API devolve. Mínima e máxima saem dos pontos de 3 horas de cada dia, e o ícone do cartão é o do ponto mais perto do meio-dia (ou o mais frequente). O primeiro ou o último cartão pode representar um dia incompleto.
18. Nomes ambíguos ficam com a primeira correspondência que a API devolve. Não há desambiguação por país, a não ser que a pessoa digite algo como "Cidade,BR".
19. Na primeira visita, sem tema salvo, o tema segue a preferência do sistema (`prefers-color-scheme`) e a unidade começa em °C.
20. A jornada começa com a aplicação já carregada. A entrega dos arquivos pelo nginx aparece apenas no diagrama de containers.
