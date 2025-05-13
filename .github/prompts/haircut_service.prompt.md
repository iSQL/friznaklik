When asked to generate a haircut service, consider postgreSQL database structure:

 id text NOT NULL,
    name text NOT NULL,
    description text,
    duration integer NOT NULL,
    price double precision NOT NULL,
    "createdAt" timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" timestamp without time zone NOT NULL,
    PRIMARY KEY(id)