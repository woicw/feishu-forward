FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.17.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

FROM node:22-alpine

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

ENV PORT=16168
EXPOSE 16168

CMD ["node", "src/index.js"]
