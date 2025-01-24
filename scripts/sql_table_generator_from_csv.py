import pandas as pd

def generate_sql_from_csv(file_path, table_name, vector_dimensions):
    """
    Genererer en SQL CREATE TABLE-setning fra en CSV-fil.

    Args:
        file_path (str): Stien til CSV-filen.
        table_name (str): Navnet på SQL-tabellen.
        vector_dimensions (int): Dimensjoner for vektor-kolonner.
    """
    try:
        # Les CSV-filen
        df = pd.read_csv(file_path, delimiter='|')

        # Start SQL-setningen
        sql_statement = f"CREATE TABLE {table_name} (\n"

        # Iterer gjennom kolonnenavn
        for index, column_name in enumerate(df.columns):
            column_type = 'TEXT'
            if 'vector' in column_name.lower():
                column_type = f"VECTOR({vector_dimensions})"

            sql_statement += f"  {column_name} {column_type}"
            if index < len(df.columns) - 1:
                sql_statement += ','
            sql_statement += '\n'

        sql_statement += ');'
        print(sql_statement)
        return sql_statement
    except Exception as e:
        print(f"En feil oppsto: {e}")

# Eksempel på bruk
if __name__ == "__main__":
    generate_sql_from_csv(
        "text-embedding-3-large_title-keyword.csv",
        "text_embedding_3_large_title_keyword",
        3072
    )