# Lacunas conhecidas

São pontos **ainda não decididos**. Enquanto uma lacuna estiver aberta, nenhum número ou
comportamento dela deve aparecer nos diagramas como fato, e um agente de desenvolvimento não
deve escolher uma resposta por conta própria.

A coluna **Req.** aponta para a lacuna equivalente na
[análise de requisitos](https://github.com/lfdeus/dashboard-clima-pos/blob/6bc8a92/docs/rnf-lacunas-ambiguidades.md)
feita antes deste trabalho. As lacunas sem correspondência surgiram ao confrontar o
código com os diagramas.

| ID | Lacuna | O que o código faz hoje | Pergunta a decidir | Req. |
| --- | --- | --- | --- | --- |
| **L01** | Metas de desempenho | Nada é medido. Nenhum número de latência ou tamanho de bundle foi acordado. | Existe meta de tempo de resposta percebido ou de tamanho do bundle? | L08 |
| **L02** | Disponibilidade e degradação quando a OpenWeatherMap cai | Mostra erro e oferece "Tentar novamente" manual. Não guarda o último resultado. | Basta o erro com retry manual, ou é preciso exibir o último resultado conhecido? | L02 |
| **L03** | Limite de requisições do plano gratuito | O valor do limite não foi levantado. Um 429 cai em `UNKNOWN` com mensagem genérica, sem backoff. Uma busca confirmada com Enter antes do fim do debounce dispara **duas** buscas, ou seja, 4 requisições. | Qual é o limite real do plano usado? Como reagir ao 429? Deduplicar os gatilhos de busca? | L05 |
| **L04** | Proteção da chave de API | A chave fica no bundle e vai na query string de toda requisição, visível no DevTools. Trocar a chave exige novo build. | Aceitar o risco (uso acadêmico) ou criar um proxy? Criar o proxy muda a INV01. | L09 |
| **L05** | Concorrência entre buscas | Cada busca abre uma nova assinatura sem cancelar a anterior, e o campo de texto continua habilitado durante o carregamento. Uma resposta atrasada de uma busca antiga pode sobrescrever a atual, e um erro atrasado pode apagar um resultado válido. | Regra esperada: a última busca vence? Se sim, é defeito a corrigir com cancelamento. | — |
| **L06** | Resultado parcial | Se só a previsão falha, o clima atual, que chegou com sucesso, é descartado (INV05). | Vale mostrar o clima atual com um aviso de "previsão indisponível"? | — |
| **L07** | Referência de fuso horário | A previsão é agrupada pela data de `dt_txt`, que está em **UTC**. O ponto "das 12h" que representa o dia é 12:00 UTC. O "Atualizado em" usa o fuso do **navegador**, não o da cidade, e o campo `timezone` da API é lido mas não usado. O 1º cartão de "Próximos dias" é o dia corrente, parcial. | Os dias devem seguir o fuso da cidade consultada? "Próximos 5 dias" inclui hoje? | — |
| **L08** | Busca com termo parcial | Toda pausa de 400 ms com pelo menos 2 caracteres consulta a API. Um prefixo pode casar com outra cidade e entrar no histórico (o screenshot do repositório mostra "Goi" ao lado de "Goiânia"). | Buscar só ao confirmar? Usar a API de geocoding para sugerir cidades? | L01 |
| **L09** | Cidades homônimas | O primeiro resultado da API é usado, sem desambiguação. | Mostrar estado/país e deixar o usuário escolher? | L01 |
| **L10** | Ambiente de produção | Não existe. O CI não publica imagem, e TLS, domínio e registro de imagem não estão definidos. | Onde e como o sistema seria implantado, se for implantado? | — |
| **L11** | Observabilidade | Não há log nem telemetria no cliente. Só existe o access log padrão do nginx. | É preciso saber, por exemplo, a taxa de erros da API? Se for, com qual ferramenta? | — |
| **L12** | Privacidade (LGPD) | O Google Fonts recebe o IP de cada visitante, a OpenWeatherMap recebe IP e termo buscado e o histórico fica no navegador. Não há aviso. | É preciso aviso? Hospedar a fonte junto com a aplicação? | L06 |
| **L13** | Cabeçalhos de segurança efetivos | O `nginx.conf` declara `X-Content-Type-Options`, `X-Frame-Options` e `Referrer-Policy` no nível `server`, mas os blocos `location` que atendem `index.html` e os assets têm `add_header` próprio. Pela regra de herança do nginx, nesse caso os cabeçalhos do `server` **não** são herdados. Não há CSP. *Hipótese lida na configuração, ainda não verificada com uma requisição real (ver D03).* | Quais cabeçalhos são obrigatórios? Precisa de CSP? | — |

| **L14** | `localStorage` indisponível | Só a leitura do histórico está protegida por `try/catch`. As leituras de unidade e tema, feitas na criação da tela, e todas as gravações não estão. *Hipótese:* com o armazenamento do site bloqueado pelo navegador, a tela do dashboard nem chega a ser criada. Não foi reproduzido. | Garantir que a tela funcione sem persistência? | — |

## Como verificar a L13

```bash
docker compose up -d --build
curl -sI http://localhost:8080/ | grep -iE "x-content-type|x-frame|referrer"
```

Se o comando não imprimir nada, a hipótese está confirmada e os cabeçalhos precisam ser
repetidos em cada `location`, ou movidos para um `include`.
