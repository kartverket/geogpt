# GeoGPT

GeoGPT er et prosjekt som integrerer flere teknologier for å levere en robust løsning for geodata. Denne veiledningen hjelper deg med å sette opp prosjektet lokalt.

---

## Kom i gang

### 1. Installer avhengigheter for klienten
- Naviger til mappen `geonorge-app`.
- Kjør følgende kommando:
  ```bash
  npm install
  ```
  eller
  ```bash
  npm i
  ```

### 2. Konfigurer API-nøkler for serveren
- Naviger til mappen `geonorge-server`.
- Opprett en `.env`-fil med de nødvendige API-nøklene. Se på `.env.example`-filen for eksempel oppsett.
  ```

### 3. Installer Python-avhengigheter
- Kjør følgende kommando for å installere nødvendige Python-pakker:
  ```bash
  pip install openai pgvector fastapi aiohttp websockets dotenv
  ```
- Mac:
  ```bash
  pip3 install openai pgvector fastapi aiohttp websockets dotenv
  ```

### 4. Start serveren
- Fra mappen `geonorge-server`, kjør:
  ```bash
  python main.py
  ```

### 5. Start klienten
- Gå tilbake til `geonorge-app`.
- Start utviklingsserveren ved å kjøre:
  ```bash
  npm run dev
  ```

---

## Testing
Når serveren og klienten kjører, kan du teste løsningen ved å navigere til den oppgitte localhost-adressen i nettleseren din.

---



