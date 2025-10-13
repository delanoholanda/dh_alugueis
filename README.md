
# Firebase Studio

This is a NextJS starter in Firebase Studio.

## Rodando a Aplicação Localmente

Siga os passos abaixo para configurar e rodar esta aplicação no seu ambiente local.

### Pré-requisitos

*   **Node.js**: Certifique-se de que você tem o Node.js instalado. Você pode baixá-lo em [nodejs.org](https://nodejs.org/). O npm (Node Package Manager) geralmente é instalado junto com o Node.js.
*   **Código-Fonte**: Você precisará ter o código-fonte completo desta aplicação.

### Passos para Execução

1.  **Navegue até a Pasta do Projeto (Raiz)**:
    **Este é o passo mais importante.** Abra seu terminal ou prompt de comando e navegue até o diretório **raiz** do projeto (a pasta que contém o arquivo `package.json`, e não as subpastas `src` ou `app`).
    ```bash
    cd caminho/para/seu-projeto
    ```

2.  **Instale as Dependências**:
    Na pasta raiz, execute o comando abaixo para instalar todas as dependências.
    ```bash
    npm install
    ```
    Ou, se você usa Yarn:
    ```bash
    yarn install
    ```

3.  **Inicie o Servidor de Desenvolvimento Next.js**:
    Ainda na pasta raiz, execute o comando para iniciar a aplicação.
    ```bash
    npm run dev
    ```
    Ou, se você usa Yarn:
    ```bash
    yarn dev
    ```

4.  **Acesse a Aplicação no Navegador**:
    Após o servidor iniciar com sucesso (você verá uma mensagem no terminal, geralmente indicando que está pronto em `http://localhost:3000`), abra seu navegador e acesse:
    [http://localhost:3000](http://localhost:3000)

### Configuração de Email (Opcional)

Para habilitar o envio de emails (ex: notificações de aluguel), você precisa configurar as variáveis de ambiente no arquivo `.env`. Adicione as seguintes linhas e preencha com as informações do seu servidor SMTP.

**Regra geral:** Não use aspas (`'` ou `"`), a menos que o valor contenha espaços. Se houver espaços, use aspas duplas.

**Exemplo de preenchimento no arquivo `.env`:**

```env
# Configurações do Servidor de Email SMTP

# O endereço do seu servidor. Ex: smtp.gmail.com
EMAIL_SERVER_HOST=smtp.example.com
# A porta do seu servidor. Ex: 587
EMAIL_SERVER_PORT=587
# O email completo que você usa para fazer login no servidor. Ex: seu_usuario@example.com
EMAIL_SERVER_USER=seu_usuario@example.com
# A senha correspondente ao email acima. Ex: umaSenhaForte123!
EMAIL_SERVER_PASS=sua_senha_aqui
# O nome que aparecerá como remetente. Use aspas duplas por causa dos espaços. Ex: "Minha Empresa"
EMAIL_FROM_NAME="DH Alugueis"
# O endereço de email que aparecerá como remetente. Ex: nao-responda@suaempresa.com
EMAIL_FROM_ADDRESS=nao-responda@example.com
```

*   `EMAIL_SERVER_HOST`: O endereço do seu servidor SMTP.
*   `EMAIL_SERVER_PORT`: A porta do seu servidor SMTP (geralmente 587 para TLS ou 465 para SSL).
*   `EMAIL_SERVER_USER`: O nome de usuário para autenticação no servidor.
*   `EMAIL_SERVER_PASS`: A senha para autenticação.
*   `EMAIL_FROM_NAME`: O nome que aparecerá como remetente (ex: "DH Alugueis").
*   `EMAIL_FROM_ADDRESS`: O endereço de email que aparecerá como remetente.

### Banco de Dados e Persistência de Dados

A aplicação foi projetada para ser robusta e garantir que seus dados não sejam perdidos.

*   **Local de Armazenamento:** Todos os dados persistentes, incluindo o banco de dados (`dhalugueis.db`), logos da empresa e todas as fotos de clientes, inventário e aluguéis, são salvos na pasta `data`, localizada na raiz do seu projeto.

*   **Persistência com Docker:** Ao usar o Docker com o arquivo `docker-compose.yml` fornecido, a linha `volumes: - ./data:/app/data` é crucial. Ela "espelha" a pasta `data` do seu computador para dentro do container. Isso significa que, mesmo que você pare, remova ou reconstrua o container, **seus dados estarão sempre seguros**, pois estão fisicamente armazenados no seu computador.

*   **Variáveis de Ambiente com Docker**: O arquivo `docker-compose.yml` também está configurado para ler seu arquivo `.env` na raiz do projeto. Isso garante que configurações sensíveis, como as credenciais do servidor de email, sejam carregadas para dentro do container. **Importante:** Se você alterar o arquivo `.env`, precisará recriar o container com os comandos `docker-compose down` seguido de `docker-compose up -d --build` para que as mudanças tenham efeito.

*   **Usuário Padrão:** Se a aplicação for iniciada sem um banco de dados existente, um novo será criado com um usuário administrador padrão:
    *   **Email**: `admin@dhalugueis.com`
    *   **Senha**: `dhdh1234`
    É altamente recomendável alterar essa senha após o primeiro login.

### Backup e Restauração

Para garantir a segurança de todos os seus dados, é fundamental entender como fazer o backup corretamente.

*   **Como Fazer um Backup Seguro:**
    1.  Navegue até a página **Configurações** na sua aplicação.
    2.  Encontre o card **"Backup do Banco de Dados"**.
    3.  Clique no botão **"Criar Backup do Banco de Dados"**.
    4.  A aplicação criará uma cópia segura e completa do seu banco de dados na pasta `data/backups/` dentro do diretório do seu projeto. O arquivo terá um nome com data e hora (ex: `backup-2024-08-16_10-30-00.db`).
    5.  Copie este novo arquivo de backup para um local seguro (um HD externo, um serviço de nuvem, etc.). **Importante:** Não copie apenas o arquivo `dhalugueis.db` da pasta `data`, pois ele pode não conter as últimas alterações. Use sempre a função de backup.
    6.  **Lembre-se de fazer backup da pasta de uploads também:** Para um backup completo, copie também a pasta `data/uploads`. Ela contém todas as imagens (logos, fotos de clientes, etc.).

*   **Como Restaurar um Backup:**
    1.  Pare a aplicação (`docker-compose down` se estiver usando Docker, ou `Ctrl+C` no terminal).
    2.  Apague os arquivos `dhalugueis.db`, `dhalugueis.db-shm` e `dhalugueis.db-wal` da sua pasta `data`, se existirem.
    3.  Copie o seu arquivo de backup (ex: `backup-2024-08-16_10-30-00.db`) para dentro da pasta `data`.
    4.  **Renomeie** o arquivo de backup para `dhalugueis.db`.
    5.  Se você tiver um backup da pasta `uploads`, substitua a pasta `data/uploads` existente pela sua.
    6.  Inicie a aplicação novamente. Todos os seus dados estarão restaurados.

### Funcionalidades de Inteligência Artificial (Genkit)

*   As funcionalidades que utilizam Genkit para interagir com modelos de IA (como a determinação de notificação do WhatsApp) requerem conexão com a internet para se comunicar com os serviços do Google AI.
*   Para desenvolvimento e teste das funcionalidades de IA com Genkit, você pode precisar rodar o servidor do Genkit em um terminal separado:
    ```bash
    npm run genkit:dev
    ```
    Ou, se quiser que ele reinicie automaticamente ao detectar mudanças nos arquivos de IA:
    ```bash
    npm run genkit:watch
    ```
    Pode ser necessário configurar variáveis de ambiente ou chaves de API para os modelos de IA, dependendo do provedor (Google AI). Verifique o arquivo `.env` para quaisquer configurações necessárias.

### Observações

*   **Modo Offline**: A maior parte da aplicação (gerenciamento de clientes, inventário, aluguéis, finanças, usuários) funcionará offline uma vez que o servidor local esteja rodando, pois depende do banco de dados SQLite local. A exceção são as funcionalidades de IA e de envio de email.
*   **Primeiro Carregamento**: No primeiro acesso ou após limpar o cache do navegador, pode ser necessária conexão com a internet para baixar assets como fontes do Google Fonts ou imagens de placeholder.

### Solução de Problemas (Troubleshooting)

*   **Erro `'next' não é reconhecido como um comando interno`**:
    *   Este erro acontece se você tentar rodar o comando `npm run dev` de uma subpasta (como `src` ou `app`).
    *   **Solução**: Certifique-se de que você está no **diretório raiz** do projeto antes de rodar qualquer comando `npm`.

*   **Erro `is not a valid Win32 application` ao rodar em Windows**:
    *   Este erro geralmente acontece se você copiou a pasta `node_modules` de um ambiente diferente (como Linux ou macOS). Pacotes como o `better-sqlite3` (usado para o banco de dados) são compilados especificamente para o sistema operacional onde são instalados.
    *   **Solução**:
        1.  Apague completamente a pasta `node_modules` do seu projeto.
        2.  Apague o arquivo `package-lock.json`.
        3.  Rode `npm install` novamente no seu terminal Windows. Isso forçará o npm a baixar e compilar as dependências corretamente para o seu sistema.
        4.  Após a instalação, tente rodar `npm run dev` novamente.

*   **Erro `database disk image is malformed`**:
    *   Este erro indica que o arquivo do banco de dados (`data/dhalugueis.db`) foi corrompido. Isso pode acontecer por vários motivos, incluindo o desligamento incorreto do computador, falhas de disco ou restauração de um backup danificado.
    *   **Solução (Reset do Banco de Dados):**
        1.  **Atenção:** Este procedimento apagará todos os dados existentes. Certifique-se de ter um backup seguro, se necessário.
        2.  Pare a aplicação, se estiver rodando (`Ctrl+C` no terminal).
        3.  Vá para a pasta `data` na raiz do seu projeto.
        4.  **Apague** o arquivo `dhalugueis.db`.
        5.  Inicie a aplicação novamente com `npm run dev`. Um novo banco de dados limpo será criado automaticamente com os dados padrão (usuário admin, tipos de equipamento, etc.).

*   **Migração de Dados do Container Docker (Para versões antigas)**
    *   **Problema:** Se você estava usando uma versão antiga do `docker-compose.yml` que não mapeava a pasta `data`, seus dados (banco de dados, imagens) podem estar "presos" dentro do container Docker e não estarem refletidos na pasta `data` do seu projeto.
    *   **Solução (Passo a Passo para Migrar os Dados sem Perda):**
        1.  **Encontre o nome do seu container:** No terminal, na pasta do seu projeto, rode `docker ps`. Você verá uma lista. Na coluna `NAMES`, encontre o nome do seu container (ex: `dhalugueis_container`).
        2.  **Copie os dados de dentro do container para fora:** Use o comando abaixo, substituindo `NOME_DO_CONTAINER` pelo nome que você encontrou. O `.` no final é importante, pois significa "para a pasta atual".
            ```bash
            docker cp NOME_DO_CONTAINER:/app/data ./
            ```
            Isso criará (ou substituirá) a pasta `data` no seu projeto com os dados mais recentes que estavam dentro do container.
        3.  **Pare o container antigo:**
            ```bash
            docker-compose down
            ```
        4.  **Inicie o novo container com a configuração correta:** Após garantir que seu `docker-compose.yml` está atualizado (com `volumes: - ./data:/app/data`), recrie o container:
            ```bash
            docker-compose up -d --build
            ```
            Agora, o Docker usará a pasta `data` que você acabou de copiar, e todos os seus dados estarão seguros e persistentes.

*   **Preciso recriar o container Docker após cada mudança no código?**
    *   **Não.** O ambiente de desenvolvimento do Next.js (rodando dentro do container) detecta automaticamente alterações em arquivos de código (como `.tsx`, `.ts`, `.css`) e atualiza a aplicação no navegador (hot-reload).
    *   Você só precisa usar `docker-compose down` e `docker-compose up -d --build` quando fizer alterações em arquivos que afetam a **estrutura do container**, como:
        *   O arquivo `.env` (para carregar novas variáveis de ambiente).
        *   O arquivo `docker-compose.yml` (para mudar portas, volumes, etc.).
        *   O `Dockerfile` (se precisar instalar novos pacotes no sistema operacional do container).
        *   O `package.json` (após adicionar ou remover dependências, você deve rodar `npm install` localmente e depois recriar o container).

Seguindo esses passos, você deverá conseguir executar e testar a aplicação completamente no seu ambiente local!
