FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY demo/package.json demo/package-lock.json ./
RUN npm ci --no-fund
COPY demo/ ./
RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV INVESTIGATOR_MODE=scripted
WORKDIR /app
COPY demo/package.json demo/package-lock.json ./
RUN npm ci --omit=dev --no-fund && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/fixtures ./fixtures
USER node
EXPOSE 8080
CMD ["npm", "start"]
