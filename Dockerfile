# backend/Dockerfile

FROM node:20

WORKDIR /app

# Install dependencies (use package*.json for caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the backend code
COPY . .

# Generate Prisma client (safe even if you don't use it)
RUN npx prisma generate || echo "No prisma schema, skipping generate"

# Expose the backend port (change if your app uses something else)
EXPOSE 3000

# Start the app
CMD ["npm", "start"]