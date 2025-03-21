#scripts/Dockerfile
FROM python:3.13

WORKDIR /app

#kopierer requirements og installer avhengigheter
COPY . .
RUN pip install -r requirements.txt

#kopierer scripts
COPY . .

COPY ./cleaned_metadata.csv /app/cleaned_metadata.csv

#kommando som kjører skript
CMD ["sh", "-c", "python create_vector.py $$ python insert_csv.py"]


