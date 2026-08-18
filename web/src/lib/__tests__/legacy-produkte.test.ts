import { describe, expect, it } from "vitest";

/**
 * Ein zweiter Lauf der Uebernahme darf nicht daran scheitern, dass eine alte
 * Produktkennung inzwischen zu einem anderen Namen gehoert.
 *
 * Der Fall trat am echten Bestand auf: im Altsystem wurde der Name eines
 * Artikels berichtigt, damit aendert sich der Slug — und die Kennung hing noch
 * am alten Datensatz. Beide Spalten sind eindeutig, also brach der Schreib-
 * vorgang ab.
 *
 * Laeuft nur mit gesetzter DATABASE_URL; ohne Datenbank wird uebersprungen.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
process.env.SESSION_SECRET ??= "test-session-secret-mit-mindestens-32-zeichen";
process.env.ENCRYPTION_KEY ??= "ZGV2LW9ubHkta2V5LTMyLWJ5dGVzLWxvbmctMDAwMDA=";
process.env.APP_URL ??= "http://127.0.0.1:3000";

describe.skipIf(!hasDatabase)("Übernahme: Produktkennungen", () => {
  it("zieht eine alte Kennung auf den neuen Namen um", async () => {
    const { writeResult } = await import("../import/legacy-import");
    const { db } = await import("../db");

    // Kennungen weit oben, damit sie nicht mit echten Beständen kollidieren.
    const legacyId = BigInt(900_000_000 + Math.floor(process.hrtime()[1] % 1000));
    const leer = { providers: [], templates: [], customers: [] };

    const ergebnis = (produkt: { name: string; slug: string }) =>
      ({
        ...leer,
        products: [{ legacyIds: [legacyId], ...produkt }],
        issues: [],
        stats: {},
      }) as never;

    await writeResult(db, ergebnis({ name: "Ranzen Alt", slug: `alt-${legacyId}` }));
    await writeResult(db, ergebnis({ name: "Ranzen Neu", slug: `neu-${legacyId}` }));

    const alt = await db.product.findUnique({ where: { slug: `alt-${legacyId}` } });
    const neu = await db.product.findUnique({ where: { slug: `neu-${legacyId}` } });

    // Der alte Datensatz bleibt bestehen — nur ohne Kennung, damit ein Kauf,
    // der an ihm haengt, nicht ins Leere zeigt.
    expect(alt?.legacyId).toBeNull();
    expect(neu?.legacyId).toBe(legacyId);

    await db.product.deleteMany({
      where: { slug: { in: [`alt-${legacyId}`, `neu-${legacyId}`] } },
    });
  });
});
