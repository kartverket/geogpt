# Bruk en Node.js-baseimage
FROM node:18

# Sett arbeidskatalog
WORKDIR /app

# Kopier package.json og installer avhengigheter
COPY package.json package-lock.json ./
RUN npm install

# Kopier resten av frontend-koden
COPY . .

# Eksponer porten (endre om nødvendig)
EXPOSE 3000

# Start frontend-serveren
CMD ["npm", "run", "dev"]