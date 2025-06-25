# Dockerfile para Aplicação Next.js de Produção

# Estágio 1: Instalação de Dependências
# Usa uma imagem Node.js completa para instalar dependências, incluindo as que precisam de compilação.
FROM node:20-alpine AS dependency-installation
WORKDIR /app

# Copia os arquivos de manifesto de pacotes.
COPY package.json package-lock.json* ./

# Instala as dependências de produção.
# O better-sqlite3 precisa de ferramentas de compilação, que o Alpine base não tem, por isso instalamos.
RUN apk add --no-cache libc6-compat python3 make g++
RUN npm install --omit=dev

# ---

# Estágio 2: Build da Aplicação
# Usa a mesma imagem base para construir o projeto.
FROM node:20-alpine AS build
WORKDIR /app

# Copia as dependências já instaladas do estágio anterior.
COPY --from=dependency-installation /app/node_modules ./node_modules
# Copia o restante do código-fonte.
COPY . .

# Constrói a aplicação Next.js para produção.
RUN npm run build

# ---

# Estágio 3: Produção (Runner)
# Usa uma imagem Node.js mais enxuta para rodar a aplicação.
FROM node:20-alpine AS runner
WORKDIR /app

# Define o ambiente como produção.
ENV NODE_ENV=production
# Expor a porta que o Next.js usará.
EXPOSE 3000

# Copia os artefatos de build otimizados (standalone) do estágio de build.
# A pasta .next/standalone contém apenas o necessário para rodar a aplicação.
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

# Define o comando para iniciar o servidor Next.js.
CMD ["node", "server.js"]
