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

### Banco de Dados

*   A aplicação utiliza **SQLite** como banco de dados. O arquivo do banco (`dhalugueis.db`) será criado automaticamente na raiz do projeto na primeira vez que a aplicação tentar acessá-lo, se ele ainda não existir.
*   Se for a primeira vez que o banco de dados é criado, um usuário administrador padrão será gerado com as seguintes credenciais:
    *   **Email**: `admin@dhalugueis.com`
    *   **Senha**: `dhdh1234`
    Recomenda-se alterar essa senha após o primeiro login através da interface de gerenciamento de usuários.

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

*   **Modo Offline**: A maior parte da aplicação (gerenciamento de clientes, inventário, aluguéis, finanças, usuários) funcionará offline uma vez que o servidor local esteja rodando, pois depende do banco de dados SQLite local. A exceção são as funcionalidades de IA.
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
