FROM node:22-slim

WORKDIR /app

# Install build tools if needed
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN cd server && npm install
RUN cd client && npm install

# Copy application source code
COPY . .

# Generate Prisma Client & Build Client and Server
RUN cd server && npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

# Push DB schema and start unified server
CMD ["sh", "-c", "cd server && npx prisma db push && npm run seed && npm start"]
