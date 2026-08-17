-- Nachbau des Hibernate-Schemas der Vaadin-Anwendung, gefuellt mit bewusst
-- unsauberen Daten. Grundlage fuer den ETL-Test.

DROP TABLE IF EXISTS kunde;
DROP TABLE IF EXISTS product;
DROP TABLE IF EXISTS provider;
DROP TABLE IF EXISTS mail_template;
DROP SEQUENCE IF EXISTS hibernate_sequence;

CREATE SEQUENCE hibernate_sequence START 1;

CREATE TABLE product (
  id           bigint PRIMARY KEY,
  product_name varchar(255)
);

CREATE TABLE kunde (
  id         bigint PRIMARY KEY,
  vorname    varchar(255),
  nachname   varchar(255),
  adresse    varchar(255),
  plz        varchar(255),
  stadt      varchar(255),
  kaufdatum  date,
  mail       varchar(255),
  tel        varchar(255),
  product_id bigint NOT NULL REFERENCES product(id)
);

CREATE TABLE provider (
  id            bigint PRIMARY KEY,
  provider_name varchar(255),
  smtp_host     varchar(255),
  smtp_port     varchar(255)
);

CREATE TABLE mail_template (
  id      bigint PRIMARY KEY,
  name    varchar(255),
  subject varchar(255),
  body    text,
  html    boolean
);

-- Produkte: 1/4/5 sind derselbe Artikel in drei Schreibweisen — genau das
-- Duplikatmuster, das die Freitext-ComboBox des Altsystems erzeugt hat.
INSERT INTO product (id, product_name) VALUES
  (1, 'Ergobag Cubo'),
  (2, 'Satch Pack'),
  (3, 'Scout Sunny'),
  (4, 'ergobag cubo'),
  (5, '  Ergobag   Cubo  '),
  (6, 'Sporttasche Größe M'),
  (7, NULL);

INSERT INTO kunde (id, vorname, nachname, adresse, plz, stadt, kaufdatum, mail, tel, product_id) VALUES
  -- Normale Datensaetze
  (10, 'Anna',   'Müller',   'Hauptstr. 1',    '52062', 'Aachen',   DATE '2023-08-14', 'Anna.Mueller@Example.DE', '0241 123456',    1),
  (11, 'Bernd',  'Schmitz',  'Marktplatz 3',   '52070', 'Aachen',   DATE '2024-07-02', 'b.schmitz@example.de',    '+49 241 654321', 2),
  -- Derselbe Kunde ein zweites Mal, anderes Produkt (gleiche Mailadresse)
  (12, 'Anna',   'Müller',   'Hauptstr. 1',    '52062', 'Aachen',   DATE '2025-08-01', 'anna.mueller@example.de', '0241 123456',    3),
  -- Derselbe Kunde ohne Mail, erkannt ueber Name + PLZ + Strasse
  (13, 'Bernd',  'Schmitz',  'Marktplatz 3',   '52070', 'Aachen',   DATE '2025-06-11', NULL,                      '0241654321',     4),
  -- Kaputte Mailadresse
  (14, 'Clara',  'Weiß',     'Ringstr. 9',     '52064', 'Aachen',   DATE '2024-09-20', 'clara(at)example.de',     '0170/1234567',   2),
  -- PLZ mit Laenderpraefix, Telefon international
  (15, 'Dieter', 'Klein',    'Am Hang 12',     'D-52074','Aachen',  DATE '2022-03-15', 'd.klein@example.de',      '0049 241 99887', 5),
  -- Ohne Kaufdatum
  (16, 'Eva',    'Lang',     'Bergweg 4',      '52066', 'Aachen',   NULL,              'eva.lang@example.de',     NULL,             6),
  -- Ohne Namen — wird ausgelassen
  (17, NULL,     NULL,       'Unbekannt 1',    '52062', 'Aachen',   DATE '2024-01-01', NULL,                      NULL,             1),
  -- Umlaute und Leerzeichenmüll
  (18, '  Fritz ', ' Groß ', ' Talstr.  8 ',   '52078', 'Aachen',   DATE '2021-11-30', '  FRITZ@EXAMPLE.DE  ',    ' 0241  55 66 77 ', 3);

INSERT INTO provider (id, provider_name, smtp_host, smtp_port) VALUES
  (20, 'Vodafone', 'smtp.vodafonemail.de', '465'),
  (21, 'IONOS',    'smtp.ionos.de',        '587');

INSERT INTO mail_template (id, name, subject, body, html) VALUES
  (30, 'Aktion', 'Unser Angebot für Sie',
   '<html><body><h1>Hallo</h1>{Content}<p>Ihr Team</p></body></html>', true),
  (31, 'Kurzinfo', 'Kurze Info', 'Reiner Text ohne Platzhalter', false);
