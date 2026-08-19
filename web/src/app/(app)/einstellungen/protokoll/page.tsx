import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  Alert,
  Badge,
  Card,
  Table,
  Td,
  Th,
  formatDateTime,
} from "@/components/ui";
import { Pagination } from "@/components/pagination";
import { readPaging } from "@/lib/pagination";
import type { Prisma } from "@/generated/prisma/client";
import { ProtokollFilter } from "./filter-bar";
import { DiffAnzeige } from "./diff-anzeige";

export const metadata = { title: "Protokoll" };
export const dynamic = "force-dynamic";

/** Vorgabe, solange nichts anderes gewählt wurde. */
const STANDARD_SEITENGROESSE = 50;

const ACTION_LABEL: Record<string, string> = {
  CREATE: "Angelegt",
  UPDATE: "Geändert",
  DELETE: "Gelöscht",
  RESTORE: "Wiederhergestellt",
  LOGIN: "Anmeldung",
  LOGIN_FAILED: "Anmeldung fehlgeschlagen",
  LOGOUT: "Abmeldung",
  EXPORT: "Export",
  SEND: "Versand",
  MERGE: "Zusammengeführt",
};

/**
 * Die Objektarten, die im Protokoll vorkommen. Bewusst mit deutschen Namen:
 * „MailTemplate" sagt einem Sachbearbeiter nichts.
 */
const ENTITY_LABEL: Record<string, string> = {
  Customer: "Kunde",
  Product: "Produkt",
  ProductCategory: "Warengruppe",
  Segment: "Segment",
  MailTemplate: "Vorlage",
  MailImage: "Bild",
  Campaign: "Kampagne",
  MailAccount: "Absenderkonto",
  Provider: "Provider",
  User: "Benutzer",
};

const LEVEL_LABEL: Record<string, string> = {
  INFO: "Information",
  WARN: "Warnung",
  ERROR: "Fehler",
};

/** Liest ein Datum aus der Adresse; unbrauchbare Angaben werden ignoriert. */
function datum(value: unknown, endeDesTages = false): Date | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const d = new Date(`${value}T${endeDesTages ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  if (!can(user, "protokoll.ansehen")) {
    return (
      <Alert variant="warning" title="Kein Zugriff">
        Für das Protokoll fehlt Ihnen die Berechtigung.
      </Alert>
    );
  }

  const bereich = params.bereich === "anwendung" ? "anwendung" : "aenderungen";
  const { page, pageSize, skip, take } = await readPaging(params, {
    fallbackSize: STANDARD_SEITENGROESSE,
  });

  const von = datum(params.von);
  const bis = datum(params.bis, true);
  const zeitraum =
    von || bis ? { createdAt: { ...(von ? { gte: von } : {}), ...(bis ? { lte: bis } : {}) } } : {};

  // Für die Auswahllisten: alle Benutzer, auch abgeschaltete — deren Einträge
  // stehen ja weiterhin im Protokoll.
  const benutzer = await db.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, active: true },
  });
  const benutzerOptionen = [
    { wert: "", text: "Alle Benutzer" },
    ...benutzer.map((b) => ({
      wert: b.id,
      text: b.active ? b.name : `${b.name} (abgeschaltet)`,
    })),
  ];

  const kopf = (
    <div className="mb-4 flex flex-wrap gap-1.5">
      <a
        href="/einstellungen/protokoll"
        className={bereich === "aenderungen" ? "btn btn-primary" : "btn btn-secondary"}
      >
        Änderungen
      </a>
      <a
        href="/einstellungen/protokoll?bereich=anwendung"
        className={bereich === "anwendung" ? "btn btn-primary" : "btn btn-secondary"}
      >
        Anwendung
      </a>
    </div>
  );

  // ------------------------------------------------------------ Anwendung
  if (bereich === "anwendung") {
    const level = text(params.ebene);
    const source = text(params.quelle);
    const suche = text(params.suche);

    const where: Prisma.AppLogWhereInput = {
      ...zeitraum,
      ...(level ? { level: level as never } : {}),
      ...(source ? { source } : {}),
      ...(suche ? { message: { contains: suche, mode: "insensitive" } } : {}),
    };

    const [total, eintraege, quellen] = await Promise.all([
      db.appLog.count({ where }),
      db.appLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { user: { select: { name: true } } },
      }),
      // Welche Quellen es wirklich gibt — eine feste Liste veraltet still.
      // `groupBy` und nicht `distinct`: das wird zu einem GROUP BY in der
      // Datenbank, waehrend `distinct` erst alle Zeilen holen wuerde.
      db.appLog.groupBy({ by: ["source"], orderBy: { source: "asc" } }),
    ]);

    return (
      <div className="space-y-4">
        <Card
          title="Anwendungsprotokoll"
          description="Was die Anwendung selbst gemeldet hat — Versandfehler, abgebrochene Übernahmen, Fehler beim Seitenaufbau."
        >
          {kopf}

          <ProtokollFilter
            bereich="anwendung"
            felder={[
              {
                name: "ebene",
                label: "Ebene",
                optionen: [
                  { wert: "", text: "Alle" },
                  { wert: "ERROR", text: "Fehler" },
                  { wert: "WARN", text: "Warnungen" },
                  { wert: "INFO", text: "Informationen" },
                ],
              },
              {
                name: "quelle",
                label: "Quelle",
                optionen: [
                  { wert: "", text: "Alle" },
                  ...quellen.map((q) => ({ wert: q.source, text: q.source })),
                ],
              },
              { name: "von", label: "Von", typ: "date" },
              { name: "bis", label: "Bis", typ: "date" },
              {
                name: "suche",
                label: "Meldung enthält",
                platzhalter: "z. B. Zeitüberschreitung",
              },
            ]}
          />

          {eintraege.length === 0 ? (
            <p className="text-sm text-slate-500">
              Keine Einträge für diese Auswahl.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Zeitpunkt</Th>
                  <Th>Ebene</Th>
                  <Th>Quelle</Th>
                  <Th>Meldung</Th>
                  <Th>Benutzer</Th>
                </tr>
              </thead>
              <tbody>
                {eintraege.map((eintrag) => (
                  <tr key={eintrag.id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap text-slate-600">
                      {formatDateTime(eintrag.createdAt)}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          eintrag.level === "ERROR"
                            ? "red"
                            : eintrag.level === "WARN"
                              ? "amber"
                              : "slate"
                        }
                      >
                        {LEVEL_LABEL[eintrag.level] ?? eintrag.level}
                      </Badge>
                    </Td>
                    <Td className="text-slate-600">{eintrag.source}</Td>
                    <Td className="max-w-xl">
                      <span className="text-slate-700">{eintrag.message}</span>
                      {eintrag.context ? (
                        <div className="mt-1">
                          <DiffAnzeige diff={eintrag.context} />
                        </div>
                      ) : null}
                      {eintrag.stack ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-slate-500">
                            Aufrufliste
                          </summary>
                          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-xs text-slate-500">
                            {eintrag.stack}
                          </pre>
                        </details>
                      ) : null}
                    </Td>
                    <Td className="text-slate-600">{eintrag.user?.name ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Pagination page={page} pageSize={pageSize} total={total} params={params} />
      </div>
    );
  }

  // ----------------------------------------------------------- Änderungen
  const entity = text(params.entity);
  const action = text(params.aktion);
  const benutzerId = text(params.benutzer);
  const kennung = text(params.kennung);

  const where: Prisma.AuditLogWhereInput = {
    ...zeitraum,
    ...(entity ? { entity } : {}),
    ...(action ? { action: action as never } : {}),
    ...(benutzerId ? { userId: benutzerId } : {}),
    ...(kennung ? { entityId: { contains: kennung, mode: "insensitive" } } : {}),
  };

  const [total, entries, arten] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { user: { select: { name: true, email: true } } },
    }),
    // Auch hier: die tatsaechlich vorhandenen Arten, nicht eine gepflegte
    // Liste, die beim naechsten neuen Objekt hinterherhinkt.
    db.auditLog.groupBy({ by: ["entity"], orderBy: { entity: "asc" } }),
  ]);

  const gefiltert = Boolean(entity || action || benutzerId || kennung || von || bis);

  return (
    <div className="space-y-4">
      <Card
        title="Änderungsprotokoll"
        description="Wer hat wann was angelegt, geändert, gelöscht, exportiert oder versendet."
      >
        {kopf}

        <ProtokollFilter
          bereich=""
          felder={[
            { name: "benutzer", label: "Benutzer", optionen: benutzerOptionen },
            {
              name: "aktion",
              label: "Aktion",
              optionen: [
                { wert: "", text: "Alle" },
                ...Object.entries(ACTION_LABEL).map(([wert, text]) => ({
                  wert,
                  text,
                })),
              ],
            },
            {
              name: "entity",
              label: "Objektart",
              optionen: [
                { wert: "", text: "Alle" },
                ...arten.map((a) => ({
                  wert: a.entity,
                  text: ENTITY_LABEL[a.entity] ?? a.entity,
                })),
              ],
            },
            { name: "von", label: "Von", typ: "date" },
            { name: "bis", label: "Bis", typ: "date" },
            {
              name: "kennung",
              label: "Objekt-Kennung",
              platzhalter: "ID des Datensatzes",
            },
          ]}
        />

        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">
            {gefiltert
              ? "Keine Einträge für diese Auswahl."
              : "Noch nichts protokolliert."}
          </p>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Zeitpunkt</Th>
                <Th>Benutzer</Th>
                <Th>Aktion</Th>
                <Th>Objekt</Th>
                <Th>Was geändert wurde</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap text-slate-600">
                    {formatDateTime(entry.createdAt)}
                  </Td>
                  <Td>
                    {entry.user ? (
                      <a
                        href={`/einstellungen/protokoll?benutzer=${entry.userId}`}
                        className="text-brand-700 hover:underline"
                      >
                        {entry.user.name}
                      </a>
                    ) : (
                      <span className="text-slate-500">System</span>
                    )}
                    {entry.ip ? (
                      <span className="block font-mono text-xs text-slate-400">
                        {entry.ip}
                      </span>
                    ) : null}
                  </Td>
                  <Td>{ACTION_LABEL[entry.action] ?? entry.action}</Td>
                  <Td className="text-slate-600">
                    {ENTITY_LABEL[entry.entity] ?? entry.entity}
                    {entry.entityId ? (
                      <a
                        href={`/einstellungen/protokoll?kennung=${entry.entityId}`}
                        className="block font-mono text-xs text-slate-400 hover:underline"
                        title="Alle Einträge zu diesem Datensatz"
                      >
                        {entry.entityId.slice(0, 12)}
                      </a>
                    ) : null}
                  </Td>
                  <Td className="max-w-xl">
                    <DiffAnzeige diff={entry.diff} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Pagination page={page} pageSize={pageSize} total={total} params={params} />
    </div>
  );
}
