FROM node:22-alpine
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm install
COPY apps/api/tsconfig.json ./
COPY apps/api/src ./src
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
