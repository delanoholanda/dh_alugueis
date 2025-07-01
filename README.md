
# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Rodando a Aplicação Localmente

Siga os passos abaixo para configurar e rodar esta aplicação no seu ambiente local.

### Pré-requisitos

*   **Node.js**: Certifique-se de que você tem o Node.js instalado. Você pode baixá-lo em [nodejs.org](https://nodejs.org/). O npm (Node Package Manager) geralmente é instalado junto com o Node.js.
*   **Código-Fonte**: Você precisará ter o código-fonte completo desta aplicação.

### Passos para Execução

1.  **Navegue até a Pasta do Projeto**:
    Abra seu terminal ou prompt de comando e navegue até o diretório raiz onde você salvou os arquivos da aplicação.
    ```bash
    cd caminho/para/seu-projeto
    ```

2.  **Instale as Dependências**:
    Execute o comando abaixo para instalar todas as dependências listadas no arquivo `package.json`.
    ```bash
    npm install
    ```
    Ou, se você usa Yarn:
    ```bash
    yarn install
    ```

3.  **Inicie o Servidor de Desenvolvimento Next.js**:
    Este comando iniciará o servidor de desenvolvimento da aplicação.
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

*   **O Que Fazer Backup?** Para um backup completo, você deve copiar a **pasta `data` inteira**, que está na raiz do projeto.

*   **Por Que a Pasta Inteira?**
    *   `data/dhalugueis.db`: Este arquivo contém todo o seu banco de dados (clientes, aluguéis, inventário, finanças, etc.).
    *   `data/uploads/`: Esta pasta contém todas as imagens que você salvou na aplicação (logos da empresa, fotos de clientes, de equipamentos e de aluguéis).

*   **Como Fazer Backup:**
    1.  Pare a aplicação, se estiver rodando.
    2.  Copie toda a pasta `data` para um local seguro (um HD externo, um serviço de nuvem, etc.).

*   **Como Restaurar um Backup:**
    1.  Pare a aplicação.
    2.  Se existir uma pasta `data` no seu projeto, apague-a ou renomeie-a.
    3.  Copie a sua pasta `data` de backup para a raiz do projeto.
    4.  Inicie a aplicação novamente. Todos os seus dados estarão restaurados.

**Importante:** Apenas salvar o arquivo `dhalugueis.db` **NÃO** é suficiente, pois você perderia todas as imagens.

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

*   **Erro `is not a valid Win32 application` ao rodar em Windows**:
    *   Este erro geralmente acontece se você copiou a pasta `node_modules` de um ambiente diferente (como Linux ou macOS). Pacotes como o `better-sqlite3` (usado para o banco de dados) são compilados especificamente para o sistema operacional onde são instalados.
    *   **Solução**:
        1.  Apague completamente a pasta `node_modules` do seu projeto.
        2.  Apague o arquivo `package-lock.json`.
        3.  Rode `npm install` novamente no seu terminal Windows. Isso forçará o npm a baixar e compilar as dependências corretamente para o seu sistema.
        4.  Após a instalação, tente rodar `npm run dev` novamente.

Seguindo esses passos, você deverá conseguir executar e testar a aplicação completamente no seu ambiente local!
