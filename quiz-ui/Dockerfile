# Build stage
FROM node:24-alpine as build

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Serve stage
FROM nginx:alpine AS production

# Create app directory
RUN mkdir -p /app/www

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config template
COPY nginx.conf /etc/nginx/templates/default.conf.template


# Expose port (will be overridden by Render)
EXPOSE 80


# Start nginx
CMD ["nginx", "-g", "daemon off;"]

