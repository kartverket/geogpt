FROM python:3.13

WORKDIR /app

# Copy files and install dependencies
COPY . .
RUN pip install -r requirements.txt

# Create a data directory for persistent storage
RUN mkdir -p /app/data

# Copy metadata file
COPY ./cleaned_metadata.csv /app/cleaned_metadata.csv

# Create start script that checks for existing vector file
RUN echo '#!/bin/bash\n\
if [ -f "/app/data/all_columns_vectorized.csv" ]; then\n\
  echo "Vector file exists in volume, using existing file."\n\
  cp /app/data/all_columns_vectorized.csv /app/all_columns_vectorized.csv\n\
else\n\
  echo "No vector file found, generating embeddings..."\n\
  python create_vector.py\n\
  cp /app/all_columns_vectorized.csv /app/data/all_columns_vectorized.csv\n\
fi\n\
\n\
python insert_csv.py\n\
\n\
# Keep container running\n\
tail -f /dev/null\n\
' > /app/start.sh

RUN chmod +x /app/start.sh

# Use the start script
CMD ["/app/start.sh"]