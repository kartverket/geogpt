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

# 2️⃣ Start PostgreSQL med pgvector hvis den ikke allerede kjører
echo "🐘 Sjekker PostgreSQL med pgvector..."
if ! docker ps --format '{{.Names}}' | grep -q "pgvector_container"; then
    echo "🐘 Starter PostgreSQL med pgvector..."
    cd pgvector_docker
    ./run_pgvector.sh
    cd ..
else
    echo "✅ PostgreSQL er allerede oppe."
fi

# 3️⃣ Installer Python-avhengigheter
echo "🐍 Installerer Python-avhengigheter..."
pip install -r scripts/requirements.txt

# 4️⃣ Generer vektorer hvis det ikke allerede er gjort
echo "🔢 Genererer vektorer..."
cd scripts
python create_vector.py

# 5️⃣ Sett alltid inn data i databasen
echo "📤 Setter inn data i databasen..."
python insert_csv.py
cd ..

# 6️⃣ Start backend-serveren hvis den ikke allerede kjører
echo "🖥️ Starter backend-serveren..."
cd geonorge-server/src
if pgrep -f "server.py" > /dev/null; then
    echo "✅ Backend-serveren kjører allerede."
else
    python server.py &
fi
cd ../..

# 5️⃣ Start frontend-utviklingsserveren
echo "🌍 Starter frontend-serveren..."
cd geonorge-app
npm run dev

echo "✅ Alle tjenester er startet!"