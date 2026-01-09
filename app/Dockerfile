FROM oven/bun:latest AS base

WORKDIR /app/

COPY package.json ./
RUN bun install

COPY . .


FROM base AS builder

RUN bun vite build


FROM caddy:latest AS production

COPY --from=builder /app/dist/ /usr/share/caddy/

EXPOSE 80 443/tcp 443/udp
