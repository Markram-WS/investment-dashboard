# Use Node.js LTS version 20 (or 18) with npm install first
FROM node:20-alpine AS builder

WORKDIR /app

# Install git (required for some packages)
RUN apk add --no-cache git

# Create package-lock.json using npm install (required for npm ci)
COPY package*.json ./
RUN npm install --force

# Now use npm ci for deterministic install
RUN npm ci

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run dev server with host 0.0.0.0
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]