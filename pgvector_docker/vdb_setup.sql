CREATE EXTENSION vector;


CREATE TABLE if not exists text_embedding_3_large
(
    db_id                SERIAL primary key,
    schema               TEXT,
    uuid                 TEXT,
    id                   INT,
    hierarchyLevel       TEXT,
    title                TEXT,
    datasetcreationdate  TEXT,
    abstract             TEXT,
    keyword              TEXT,
    geoBox               TEXT,        -- Assuming geoBox is a text representation of geographical coordinates
    constraints          TEXT,
    SecurityConstraints  TEXT,
    LegalConstraints     TEXT,
    temporalExtent       TEXT,
    image                TEXT,
    responsibleParty     TEXT,
    link                 TEXT,
    metadatacreationdate TEXT,
    productInformation   TEXT,
    parentId             TEXT,        -- Assuming parentId is a UUID referencing another entity
    title_vector         vector(3072) -- pgvector column with 3072 dimensions
);
