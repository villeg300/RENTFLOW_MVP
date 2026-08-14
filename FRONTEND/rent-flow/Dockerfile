FROM node:24-bullseye

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 g++ make curl ca-certificates libvips-dev \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./

# Désactiver la vérification des builds bloqués
ENV PNPM_ALLOW_NON_APPLIED_PATCHES=true
ENV CI=false

RUN pnpm install --frozen-lockfile --unsafe-perm --config.ignore-scripts=false

COPY . .

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
