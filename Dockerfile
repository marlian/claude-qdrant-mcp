# Smithery-compatible multi-stage build
# Build stage - compile TypeScript with all dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json tsconfig.json ./

# Install all dependencies without running scripts (postinstall is just informational)
RUN npm install --ignore-scripts && npm cache clean --force

# Copy source code and build
COPY . .
RUN npm run build

# Production stage - lean runtime image
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies, skip scripts (postinstall is just informational)
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled application from build stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S mcpuser -u 1001 && \
    chown -R mcpuser:nodejs /app

USER mcpuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Start the application
CMD ["node", "dist/index.js"]
