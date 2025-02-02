# GeoGPT

GeoGPT er et prosjekt som integrerer flere teknologier for å levere en robust løsning for geodata. Denne veiledningen hjelper deg med å sette opp prosjektet lokalt.

---

## Kom i gang

### Kør Bash-scriptet automatisk
For å starte alle tjenestene automatisk, kan du kjøre Bash-skriptet `start_geogpt.sh`.

1. **Gi skriptet kjøretilgang** (kun nødvendig på Linux/macOS):
   ```bash
   chmod +x start_geogpt.sh
   ```

2. **Kjør skriptet**:
  - **Linux/macOS**:
    ```bash
    ./start_geogpt.sh
    ```
  - **Windows (PowerShell med Git Bash eller WSL)**:
    ```powershell
    bash start_geogpt.sh
    ```

---

### Manuell oppstart
Hvis du foretrekker å starte systemet manuelt, følg disse stegene:

1. **Installer avhengigheter for klienten**
  - Naviger til mappen `geonorge-app`:
    ```bash
    cd geonorge-app
    npm i
    cd ..
    ```

2. **Start PostgreSQL med pgvector**
  - Gå til mappen `pgvector_docker` og kjør:
    ```bash
    cd pgvector_docker
    ./run_pgvector.sh
    cd ..
    ```

3. **Generer vektorer og sett dem inn i databasen**
  - Naviger til `scripts`-mappen og kjør disse kommandoene i rekkefølge:
    ```bash
    cd scripts
    python create_vector.py
    python insert_csv.py
    cd ..
    ```

4. **Start backend-serveren** (i en separat terminal):
  - Naviger til `geonorge-server` og kjør:
    ```bash
    cd geonorge-server
    python main.py
    ```

5. **Start frontend-utviklingsserveren** (i en annen terminal):
  - Naviger til `geonorge-app` og kjør:
    ```bash
    cd geonorge-app
    npm run dev
    ```

---

## Testing
Når serveren og klienten kjører, kan du teste løsningen ved å navigere til den oppgitte `localhost`-adressen i nettleseren din.

---

