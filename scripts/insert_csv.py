import csv
import psycopg2
from psycopg2.extras import execute_batch
import config
import sys

# Databasekonfigurasjon
db_config = config.DB_CONFIG

# Valider at alle nødvendige nøkler finnes
required_keys = ["host", "port", "database", "user", "password"]
missing_keys = [key for key in required_keys if not db_config.get(key)]

if missing_keys:
    print(f"Feil: Manglende konfigurasjonsverdier i .env-filen: {', '.join(missing_keys)}")
    sys.exit(1)

# Opprett tilkobling
try:
    connection = psycopg2.connect(
        host=db_config["host"],
        port=db_config["port"],
        database=db_config["database"],
        user=db_config["user"],
        password=db_config["password"],
    )
except Exception as e:
    print(f"Feil ved tilkobling til databasen: {e}")
    sys.exit(1)

table_name = "text_embedding_3_large"  # Juster tabellnavnet etter behov
file_path = "all_columns_vectorized.csv"  # Angi riktig filsti

def create_table_from_csv(file_path, table_name):
    """
    Opprett en tabell i PostgreSQL basert på CSV-innhold.
    """
    try:
        with connection.cursor() as cursor:
            with open(file_path, mode="r", encoding="utf-8") as file:
                reader = csv.DictReader(file, delimiter="|")
                headers = reader.fieldnames

                if not headers:
                    raise ValueError("Ingen kolonner funnet i CSV-filen.")

                create_table_query = f"CREATE TABLE IF NOT EXISTS {table_name} ("
                for header in headers:
                    if header == "id":
                        create_table_query += f"{header} INT,"
                    elif header.endswith("_vector"):
                        create_table_query += f"{header} VECTOR(3072),"
                    else:
                        create_table_query += f"{header} TEXT,"
                create_table_query = create_table_query.rstrip(",") + ");"

                cursor.execute(f"DROP TABLE IF EXISTS {table_name};")
                cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                cursor.execute(create_table_query)
                connection.commit()
                print(f"✅ Tabellen '{table_name}' ble opprettet.")
    except Exception as e:
        print(f"❌ Feil under oppretting av tabellen: {e}")
        connection.rollback()

def insert_csv_data(file_path, table_name):
    """
    Sett inn data fra en CSV-fil i PostgreSQL-tabellen.
    """
    try:
        with connection.cursor() as cursor:
            with open(file_path, mode="r", encoding="utf-8") as file:
                reader = csv.DictReader(file, delimiter="|")
                rows = [row for row in reader]

            if not rows:
                raise ValueError("CSV-filen inneholder ingen rader.")

            columns = ", ".join(rows[0].keys())
            values_template = ", ".join(["%s"] * len(rows[0]))
            insert_query = f"INSERT INTO {table_name} ({columns}) VALUES ({values_template})"

            execute_batch(cursor, insert_query, [tuple(row.values()) for row in rows])
            connection.commit()
            print(f"✅ Data fra '{file_path}' ble satt inn i tabellen '{table_name}'.")
    except Exception as e:
        print(f"❌ Feil under innsetting av data: {e}")
        connection.rollback()

def insert_csv_data_modified(file_path, table_name):
    """
    Opprett en tabell basert på CSV og sett inn data.
    """
    create_table_from_csv(file_path, table_name)
    insert_csv_data(file_path, table_name)

def main():
    """
    Hovedfunksjon for å opprette tabell og sette inn data.
    """
    try:
        insert_csv_data_modified(file_path, table_name)
    finally:
        connection.close()
        print("🔒 Forbindelsen til databasen ble lukket.")

if __name__ == "__main__":
    main()