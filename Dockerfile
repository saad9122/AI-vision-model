# ---- Build stage ----
    FROM node:20-alpine AS builder
    WORKDIR /app
    
    COPY package*.json ./
    COPY prisma ./prisma
    RUN npm ci
    
    COPY tsconfig.json ./
    COPY src ./src
    
    RUN npx prisma generate
    RUN npm run build
    
    # ---- Runtime stage ----
    FROM node:20-alpine AS runner
    WORKDIR /app
    ENV NODE_ENV=production
    
    # sharp needs these for image processing on alpine
    RUN apk add --no-cache vips-dev
    
    COPY package*.json ./
    COPY prisma ./prisma
    RUN npm ci --omit=dev
    
    COPY --from=builder /app/dist ./dist
    COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
    COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
    
    EXPOSE 4000
    
    # Default command runs the API server.
    # Override with: command: ["node", "dist/queue/worker.js"] for the worker.
    CMD ["node", "dist/index.js"]
    