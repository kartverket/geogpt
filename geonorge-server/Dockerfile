# Bruk Python 3.11-slim som base
FROM python:3.11-slim

# Sett arbeidskatalog
WORKDIR /app

# Installer systemavhengigheter for psycopg2
RUN apt-get update && apt-get install -y \
    libpq-dev gcc postgresql-client && \
    rm -rf /var/lib/apt/lists/*

# Kopier kun requirements.txt først for caching
COPY ../scripts/requirements.txt /app/requirements.txt

# Installer Python-avhengigheter
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY geonorge-server/src /app/src
COPY ../scripts /app/scripts

# Eksponer port
EXPOSE 8080

# Start backend-serveren
CMD ["python", "src/server.py"]