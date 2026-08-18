--
-- Beispielabzug aus dem Vaadin-Altsystem (nur Daten).
-- Entspricht dem, was folgender Befehl auf dem Altsystem erzeugt:
--
--   pg_dump --data-only --schema=public \
--     -t kunde -t product -t provider -t mail_template \
--     -U <benutzer> <datenbank> > altsystem-export.sql
--
SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

COPY public.product (id, product_name) FROM stdin;
1	Ergobag Cubo
2	Satch Pack
3	Scout Sunny
4	ergobag cubo
5	  Ergobag   Cubo  
6	Sporttasche Größe M
7	\N
\.

COPY public.kunde (id, vorname, nachname, adresse, plz, stadt, kaufdatum, mail, tel, product_id) FROM stdin;
10	Anna	Müller	Hauptstr. 1	52062	Aachen	2023-08-14	Anna.Mueller@Example.DE	0241 123456	1
11	Bernd	Schmitz	Marktplatz 3	52070	Aachen	2024-07-02	b.schmitz@example.de	+49 241 654321	2
12	Anna	Müller	Hauptstr. 1	52062	Aachen	2025-08-01	anna.mueller@example.de	0241 123456	3
13	Bernd	Schmitz	Marktplatz 3	52070	Aachen	2025-06-11	\N	0241654321	4
14	Clara	Weiß	Ringstr. 9	52064	Aachen	2024-09-20	clara(at)example.de	0170/1234567	2
15	Dieter	Klein	Am Hang 12	D-52074	Aachen	2022-03-15	d.klein@example.de	0049 241 99887	5
16	Eva	Lang	Bergweg 4	52066	Aachen	\N	eva.lang@example.de	\N	6
17	\N	\N	Unbekannt 1	52062	Aachen	2024-01-01	\N	\N	1
18	  Fritz 	 Groß 	 Talstr.  8 	52078	Aachen	2021-11-30	  FRITZ@EXAMPLE.DE  	 0241  55 66 77 	3
\.

COPY public.provider (id, provider_name, smtp_host, smtp_port) FROM stdin;
20	Vodafone	smtp.vodafonemail.de	465
21	IONOS	smtp.ionos.de	587
\.

COPY public.mail_template (id, name, subject, body, html) FROM stdin;
30	Aktion	Unser Angebot für Sie	<html><body><h1>Hallo</h1>{Content}<p>Ihr Team</p></body></html>	t
31	Kurzinfo	Kurze Info	Reiner Text ohne Platzhalter	f
\.
