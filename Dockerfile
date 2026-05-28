FROM node:22

# Instalar dependencias del sistema para Puppeteer
RUN apt-get update && apt-get install -y \
    chromium-browser \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de npm
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Exponer puerto
EXPOSE 3000

# Comando para ejecutar
CMD ["npm", "run", "start:prod"]
