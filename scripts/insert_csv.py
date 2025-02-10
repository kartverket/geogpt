import csv
import psycopg2
from psycopg2.extras import execute_batch
import config

# Databasekonfigurasjon
db_config = {
    "host": config.DB_HOST,
    "port": config.DB_PORT,
    "name": config.DB_NAME,
    "user": config.DB_USER,
    "password": config.DB_PASSWORD
}

connection = psycopg2.connect(
    host=db_config["host"],
    port=db_config["port"],
    database=db_config["name"],
    user=db_config["user"],
    password=db_config["password"],
)

table_name = "text_embedding_3_large"  # Juster tabellnavnet etter behov
file_path = "all_columns_vectorized.csv"  # Angi riktig filsti

def create_table_from_csv(file_path, table_name):
    """
    Opprett en tabell i PostgreSQL basert på CSV-innhold.
    """
    try:
        with connection.cursor() as cursor:
            # Les CSV-filen for å finne kolonneoverskrifter
            with open(file_path, mode="r", encoding="utf-8") as file:
                reader = csv.DictReader(file, delimiter="|")
                headers = reader.fieldnames

                # Lag CREATE TABLE-spørringen
                create_table_query = f"CREATE TABLE IF NOT EXISTS {table_name} ("
                for header in headers:
                    if header == "id":
                        create_table_query += f"{header} INT,"
                    elif header.endswith("_vector"):
                        create_table_query += f"{header} VECTOR(3072),"
                    else:
                        create_table_query += f"{header} TEXT,"
                create_table_query = create_table_query.rstrip(",") + ");"

                # Utfør CREATE TABLE
                cursor.execute(f"DROP TABLE IF EXISTS {table_name};")
                cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                cursor.execute(create_table_query)
                connection.commit()
                print(f"Tabellen '{table_name}' ble opprettet.")
    except Exception as e:
        print(f"Feil under oppretting av tabellen: {e}")
        connection.rollback()

def insert_csv_data(file_path, table_name):
    """
    Sett inn data fra en CSV-fil i PostgreSQL-tabellen.
    """
    try:
        with connection.cursor() as cursor:
            # Les CSV-filen og klargjør data for innsetting
            with open(file_path, mode="r", encoding="utf-8") as file:
                reader = csv.DictReader(file, delimiter="|")
                rows = [row for row in reader]

            # Lag INSERT-spørringen
            columns = ", ".join(rows[0].keys())
            values_template = ", ".join(["%s"] * len(rows[0]))
            insert_query = f"INSERT INTO {table_name} ({columns}) VALUES ({values_template})"

            # Bruk execute_batch for effektiv batch-innsetting
            execute_batch(cursor, insert_query, [tuple(row.values()) for row in rows])
            connection.commit()
            print(f"Data fra '{file_path}' ble satt inn i tabellen '{table_name}'.")
    except Exception as e:
        print(f"Feil under innsetting av data: {e}")
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
        print("Forbindelsen til databasen ble lukket, alt gikk bra!")

if __name__ == "__main__":
    main()