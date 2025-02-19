# Bruk en Node.js-baseimage
FROM node:18

# Sett arbeidskatalog til hvor appen kjører inne i containeren
WORKDIR /app

# Kopier package.json og package-lock.json fra BYGGEKONTEKSTEN (må være riktig!)
COPY package.json package-lock.json ./

# Installer avhengigheter
RUN npm install

# Kopier resten av frontend-koden
COPY . .

# Eksponer port 3000
EXPOSE 3000

# Start frontend-serveren
CMD ["npm", "run", "dev"]
