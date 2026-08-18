/**
 * Testdaten fuer Schulung und Abnahme.
 *
 *   npm run testdaten          # anlegen (idempotent)
 *   npm run testdaten -- --weg # alle Testdaten wieder entfernen
 *
 * Alle erzeugten Datensaetze sind an der Notiz bzw. am Namenszusatz
 * "[Testdaten]" erkennbar und lassen sich damit rueckstandsfrei loeschen.
 * Es werden bewusst auch unsaubere Faelle erzeugt — ohne E-Mail, abgemeldet,
 * mit Bounce, mit mehreren Kaeufen —, damit die Filter, der Versand und die
 * Ausschlussregeln realistisch geprueft werden koennen.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { productSlug } from "../src/lib/normalize.js";
import { seasonOf } from "../src/lib/season.js";

const MARKER = "[Testdaten]";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const PRODUKTE = [
  { name: "Ergobag Cubo", gruppe: "Schulranzen", modelljahr: 2025 },
  { name: "Satch Pack", gruppe: "Schulranzen", modelljahr: 2025 },
  { name: "Scout Sunny", gruppe: "Schulranzen", modelljahr: 2024 },
  { name: "Step by Step Space", gruppe: "Schulranzen", modelljahr: 2024 },
  { name: "Sporttasche Größe M", gruppe: "Zubehör", modelljahr: 2025 },
  { name: "Federmäppchen Set", gruppe: "Zubehör", modelljahr: 2025 },
];

type Person = {
  vorname: string;
  nachname: string;
  strasse: string;
  plz: string;
  stadt: string;
  mail: string | null;
  tel: string | null;
  kaeufe: { produkt: string; datum: string }[];
  abgemeldet?: boolean;
  bounce?: boolean;
  notiz?: string;
};

const PERSONEN: Person[] = [
  {
    vorname: "Anna", nachname: "Berger", strasse: "Pontstraße 14",
    plz: "52062", stadt: "Aachen", mail: "anna.berger@example.de",
    tel: "0241 4011234",
    kaeufe: [
      { produkt: "Ergobag Cubo", datum: "2023-07-18" },
      { produkt: "Sporttasche Größe M", datum: "2025-08-02" },
    ],
  },
  {
    vorname: "Bernd", nachname: "Claßen", strasse: "Markt 8",
    plz: "52062", stadt: "Aachen", mail: "b.classen@example.de",
    tel: "+49 241 4022345",
    kaeufe: [{ produkt: "Satch Pack", datum: "2024-08-05" }],
  },
  {
    vorname: "Christina", nachname: "Dahmen", strasse: "Adalbertsteinweg 92",
    plz: "52070", stadt: "Aachen", mail: "c.dahmen@example.de", tel: null,
    kaeufe: [
      { produkt: "Scout Sunny", datum: "2022-08-11" },
      { produkt: "Federmäppchen Set", datum: "2022-08-11" },
      { produkt: "Ergobag Cubo", datum: "2025-07-29" },
    ],
  },
  {
    vorname: "Dennis", nachname: "Esser", strasse: "Vaalser Straße 5",
    plz: "52074", stadt: "Aachen", mail: null, tel: "0241 4033456",
    kaeufe: [{ produkt: "Step by Step Space", datum: "2024-07-22" }],
    notiz: "Möchte ausdrücklich nur telefonisch kontaktiert werden.",
  },
  {
    vorname: "Elena", nachname: "Franzen", strasse: "Jülicher Straße 41",
    plz: "52070", stadt: "Aachen", mail: "e.franzen@example.de",
    tel: "0241 4044567",
    kaeufe: [{ produkt: "Satch Pack", datum: "2025-08-14" }],
    abgemeldet: true,
  },
  {
    vorname: "Frank", nachname: "Gerards", strasse: "Bahnhofstraße 3",
    plz: "52064", stadt: "Aachen", mail: "f.gerards@example.invalid",
    tel: "0241 4055678",
    kaeufe: [{ produkt: "Scout Sunny", datum: "2023-08-19" }],
    bounce: true,
  },
  {
    vorname: "Greta", nachname: "Hansen", strasse: "Hauptstraße 27",
    plz: "52134", stadt: "Herzogenrath", mail: "g.hansen@example.de",
    tel: "02406 991234",
    kaeufe: [
      { produkt: "Ergobag Cubo", datum: "2024-08-01" },
      { produkt: "Federmäppchen Set", datum: "2024-08-01" },
    ],
  },
  {
    vorname: "Hendrik", nachname: "Ibrahim", strasse: "Kirchstraße 12",
    plz: "52249", stadt: "Eschweiler", mail: "h.ibrahim@example.de",
    tel: "02403 771234",
    kaeufe: [{ produkt: "Step by Step Space", datum: "2025-08-08" }],
  },
  {
    vorname: "Ines", nachname: "Jansen", strasse: "Roermonder Straße 60",
    plz: "52072", stadt: "Aachen", mail: "i.jansen@example.de",
    tel: "0241 4066789",
    kaeufe: [{ produkt: "Sporttasche Größe M", datum: "2021-09-03" }],
  },
  {
    vorname: "Jonas", nachname: "Königs", strasse: "Alsdorfer Straße 9",
    plz: "52477", stadt: "Alsdorf", mail: "j.koenigs@example.de", tel: null,
    kaeufe: [],
    notiz: "Interessent, noch kein Kauf.",
  },
];

const VORLAGE = {
  name: `Aktionsmail ${MARKER}`,
  subject: "Schulstart-Aktion bei Schulranzen-Aachen",
  body: `<!doctype html>
<html lang="de"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:8px">
  <tr><td style="padding:24px 32px;border-bottom:1px solid #e4e4e7"><strong style="font-size:18px">Schulranzen-Aachen</strong></td></tr>
  <tr><td style="padding:32px;font-size:15px;line-height:1.6">
    <p>{{anrede}},</p>
    {{content}}
    <p style="margin-top:24px">Herzliche Grüße<br>Ihr Team von Schulranzen-Aachen</p>
  </td></tr>
  <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a">
    <p style="margin:0 0 8px">Schulranzen-Aachen · Musterstraße 1 · 52062 Aachen</p>
    <p style="margin:0">Keine weiteren E-Mails? <a href="{{abmeldelink}}" style="color:#71717a">Hier abmelden</a>.</p>
  </td></tr>
</table></td></tr></table>
</body></html>`,
};

async function entfernen() {
  const kunden = await db.customer.findMany({
    where: { notes: { contains: MARKER } },
    select: { id: true },
  });
  const ids = kunden.map((k) => k.id);

  await db.mailJob.deleteMany({ where: { customerId: { in: ids } } });
  await db.purchase.deleteMany({ where: { customerId: { in: ids } } });
  await db.customer.deleteMany({ where: { id: { in: ids } } });
  await db.campaign.deleteMany({ where: { name: { contains: MARKER } } });
  await db.mailTemplate.deleteMany({ where: { name: { contains: MARKER } } });
  await db.segment.deleteMany({ where: { name: { contains: MARKER } } });

  // Produkte nur loeschen, wenn kein echter Kauf mehr daran haengt.
  for (const produkt of PRODUKTE) {
    const slug = productSlug(produkt.name);
    const verwendet = await db.purchase.count({
      where: { product: { slug } },
    });
    if (verwendet === 0) {
      await db.product.deleteMany({ where: { slug } }).catch(() => undefined);
    }
  }

  console.log(`${ids.length} Testkunden und die zugehörigen Daten entfernt.`);
}

async function anlegen() {
  // Warengruppen zuerst — die Produkte haengen daran.
  const gruppenIds = new Map<string, string>();
  for (const name of [...new Set(PRODUKTE.map((p) => p.gruppe))]) {
    const slug = productSlug(name);
    const saved = await db.productCategory.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
    gruppenIds.set(name, saved.id);
  }

  const produktIds = new Map<string, string>();
  for (const produkt of PRODUKTE) {
    const slug = productSlug(produkt.name);
    const felder = {
      categoryId: gruppenIds.get(produkt.gruppe) ?? null,
      modelYear: produkt.modelljahr,
    };
    const saved = await db.product.upsert({
      where: { slug },
      update: felder,
      create: { name: produkt.name, slug, ...felder },
    });
    produktIds.set(produkt.name, saved.id);
  }
  console.log(
    `${gruppenIds.size} Warengruppen und ${PRODUKTE.length} Produkte sichergestellt.`,
  );

  let neu = 0;
  let kaeufe = 0;

  for (const person of PERSONEN) {
    const notiz = [person.notiz, MARKER].filter(Boolean).join(" ");

    const vorhanden = person.mail
      ? await db.customer.findFirst({ where: { email: person.mail } })
      : await db.customer.findFirst({
          where: {
            firstName: person.vorname,
            lastName: person.nachname,
            zip: person.plz,
          },
        });

    const daten = {
      firstName: person.vorname,
      lastName: person.nachname,
      street: person.strasse,
      zip: person.plz,
      city: person.stadt,
      email: person.mail,
      phone: person.tel,
      notes: notiz,
      unsubscribedAt: person.abgemeldet ? new Date("2025-09-01") : null,
      bouncedAt: person.bounce ? new Date("2025-08-20") : null,
    };

    const kunde = vorhanden
      ? await db.customer.update({ where: { id: vorhanden.id }, data: daten })
      : await db.customer.create({ data: daten });
    if (!vorhanden) neu += 1;

    for (const kauf of person.kaeufe) {
      const productId = produktIds.get(kauf.produkt);
      if (!productId) continue;
      const purchasedAt = new Date(kauf.datum);

      const schonDa = await db.purchase.findFirst({
        where: { customerId: kunde.id, productId, purchasedAt },
      });
      if (schonDa) continue;

      await db.purchase.create({
        data: {
          customerId: kunde.id,
          productId,
          purchasedAt,
          season: seasonOf(purchasedAt),
        },
      });
      kaeufe += 1;
    }
  }

  console.log(
    `${PERSONEN.length} Testkunden sichergestellt (${neu} neu), ${kaeufe} Käufe angelegt.`,
  );

  const vorlage = await db.mailTemplate.findFirst({
    where: { name: VORLAGE.name },
  });
  if (!vorlage) {
    await db.mailTemplate.create({
      data: { ...VORLAGE, isHtml: true, category: "Test" },
    });
    console.log("Testvorlage angelegt.");
  }

  const segmentName = `Kauf vor 2024 ${MARKER}`;
  await db.segment.upsert({
    where: { name: segmentName },
    update: {},
    create: {
      name: segmentName,
      filter: { to: "2023-12-31", hasEmail: "yes", unsubscribed: "no" },
    },
  });
  console.log("Testsegment sichergestellt.");

  const erreichbar = await db.customer.count({
    where: {
      notes: { contains: MARKER },
      email: { not: null },
      unsubscribedAt: null,
      bouncedAt: null,
      deletedAt: null,
    },
  });

  console.log(
    [
      "",
      "Zum Ausprobieren:",
      `  • ${erreichbar} der Testkunden sind per Mail erreichbar`,
      "  • einer hat keine E-Mail, einer ist abgemeldet, einer hat einen Bounce",
      "  • drei haben mehrere Käufe — gut für den Filter „Kauf ab/bis“",
      "  • Segment „Kauf vor 2024“ liegt bereit",
      "",
      "Entfernen mit: npm run testdaten -- --weg",
    ].join("\n"),
  );
}

const weg = process.argv.includes("--weg");

(weg ? entfernen() : anlegen())
  .then(() => db.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
