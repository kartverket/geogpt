#!/bin/bash

# Sett opp feilhåndtering
set -e  # Stopper scriptet hvis en kommando feiler
set -o pipefail  # Feilhåndtering i pipeliner

echo "🚀 Starter Geogpt..."

# 1️⃣ Installer avhengigheter for frontend
echo "📦 Installerer npm-pakker..."
cd geonorge-app
npm i
cd ..

# 2️⃣ Start PostgreSQL med pgvector
echo "🐘 Starter PostgreSQL med pgvector..."
cd pgvector_docker
./run_pgvector.sh
cd ..

# 3️⃣ Installer Python-avhengigheter
echo "🐍 Installerer Python-avhengigheter..."
pip install -r scripts/requirements.txt

# 4️⃣ Generer vektorer og sett dem inn i databasen
echo "🔢 Genererer vektorer..."
cd scripts
python create_vector.py

echo "📤 Setter inn data i databasen..."
python insert_csv.py
cd ..

# 5️⃣ Start backend-serveren
echo "🖥️ Starter backend-serveren..."
cd geonorge-server/src
python server.py &
cd ../..

# 5️⃣ Start frontend-utviklingsserveren
echo "🌍 Starter frontend-serveren..."
cd geonorge-app
npm run dev

echo "✅ Alle tjenester er startet!"