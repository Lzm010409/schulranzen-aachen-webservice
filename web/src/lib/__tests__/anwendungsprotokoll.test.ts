import { describe, expect, it } from "vitest";
import { fehlerText } from "../log";

/**
 * Der reine Teil des Anwendungsprotokolls. Das Schreiben selbst braucht eine
 * Datenbank und steht weiter unten.
 */
describe("Anwendungsprotokoll: Meldungstext", () => {
  it("nimmt die Meldung eines Fehlers", () => {
    expect(fehlerText(new Error("Zeitüberschreitung"))).toBe("Zeitüberschreitung");
  });

  it("nimmt eine Zeichenkette unverändert", () => {
    expect(fehlerText("kaputt")).toBe("kaputt");
  });

  it("kommt auch mit etwas zurecht, das kein Fehler ist", () => {
    expect(fehlerText({ code: 42 })).toBe('{"code":42}');
    expect(fehlerText(undefined)).toBe(String(undefined));
  });
});

const hasDatabase = Boolean(process.env.DATABASE_URL);
process.env.SESSION_SECRET ??= "test-session-secret-mit-mindestens-32-zeichen";
process.env.ENCRYPTION_KEY ??= "ZGV2LW9ubHkta2V5LTMyLWJ5dGVzLWxvbmctMDAwMDA=";
process.env.APP_URL ??= "http://127.0.0.1:3000";

describe.skipIf(!hasDatabase)("Anwendungsprotokoll: Schreiben", () => {
  it("hält Meldung, Zusatzangaben und Aufrufliste fest", async () => {
    const { log } = await import("../log");
    const { db } = await import("../db");
    const quelle = `test-${process.hrtime.bigint()}`;

    await log.error({
      source: quelle,
      message: "Versand fehlgeschlagen",
      error: new Error("Verbindung abgelehnt"),
      context: { kampagne: "abc", versuche: 3 },
    });

    const eintrag = await db.appLog.findFirstOrThrow({ where: { source: quelle } });
    expect(eintrag.level).toBe("ERROR");
    // Meldung und Fehlertext stehen zusammen — sonst muss man raten, woran es lag.
    expect(eintrag.message).toBe("Versand fehlgeschlagen: Verbindung abgelehnt");
    expect(eintrag.context).toEqual({ kampagne: "abc", versuche: 3 });
    expect(eintrag.stack).toContain("Error: Verbindung abgelehnt");

    await db.appLog.deleteMany({ where: { source: quelle } });
  });

  it("wiederholt den Fehlertext nicht, wenn er die Meldung schon ist", async () => {
    const { log } = await import("../log");
    const { db } = await import("../db");
    const quelle = `test-${process.hrtime.bigint()}`;

    await log.warn({ source: quelle, message: "Schon da", error: new Error("Schon da") });
    const eintrag = await db.appLog.findFirstOrThrow({ where: { source: quelle } });
    expect(eintrag.message).toBe("Schon da");
    expect(eintrag.level).toBe("WARN");

    await db.appLog.deleteMany({ where: { source: quelle } });
  });

  it("räumt nur weg, was älter ist als die Frist", async () => {
    const { raeumeProtokollAuf } = await import("../log");
    const { db } = await import("../db");
    const quelle = `test-${process.hrtime.bigint()}`;

    const alt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await db.appLog.create({
      data: { level: "INFO", source: quelle, message: "alt", createdAt: alt },
    });
    await db.appLog.create({
      data: { level: "INFO", source: quelle, message: "neu" },
    });

    await raeumeProtokollAuf(30);
    const rest = await db.appLog.findMany({ where: { source: quelle } });
    expect(rest.map((e) => e.message)).toEqual(["neu"]);

    // Eine unsinnige Frist darf nicht alles löschen.
    expect(await raeumeProtokollAuf(0)).toBe(0);
    expect(await raeumeProtokollAuf(Number.NaN)).toBe(0);

    await db.appLog.deleteMany({ where: { source: quelle } });
  });
});
