"use server";

import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { speichereBild, MAX_BILD_BYTES, ERLAUBTE_BILDTYPEN } from "@/lib/mail-images";

export type BildUploadErgebnis =
  | { url: string; bekannt: boolean; size: number }
  | { error: string };

/**
 * Nimmt ein Bild entgegen und gibt die Adresse zurueck, unter der es in einer
 * Mail stehen kann.
 *
 * Der Weg ueber den Upload ist der geradere: er erspart den Umweg ueber eine
 * eingebettete `data:`-Fassung, die ohnehin wieder ausgelagert werden muesste.
 */
export async function uploadBildAction(
  formData: FormData,
): Promise<BildUploadErgebnis> {
  // Bilder braucht, wer Vorlagen baut — und wer eine Kampagne schreibt.
  const user = await requireUser();
  if (!can(user, "vorlagen.verwalten") && !can(user, "kampagnen.erstellen")) {
    return { error: "Für das Ablegen von Bildern fehlt Ihnen die Berechtigung." };
  }

  const datei = formData.get("bild");
  if (!(datei instanceof File) || datei.size === 0) {
    return { error: "Es wurde keine Datei ausgewählt." };
  }
  if (datei.size > MAX_BILD_BYTES) {
    return {
      error: `Das Bild ist ${(datei.size / 1024 / 1024).toFixed(1)} MB groß. Erlaubt sind ${MAX_BILD_BYTES / 1024 / 1024} MB.`,
    };
  }
  const mimeType = (datei.type || "").toLowerCase();
  if (!ERLAUBTE_BILDTYPEN[mimeType]) {
    return {
      error: `${datei.type || "Unbekanntes Format"} wird nicht unterstützt. Möglich sind JPEG, PNG, GIF und WebP.`,
    };
  }

  try {
    const abgelegt = await speichereBild(
      Buffer.from(await datei.arrayBuffer()),
      mimeType,
      { filename: datei.name, userId: user.id },
    );
    if (!abgelegt.bekannt) {
      await recordAudit({
        userId: user.id,
        entity: "MailImage",
        entityId: abgelegt.id,
        action: "CREATE",
        diff: { datei: datei.name, groesse: abgelegt.size },
      });
    }
    return { url: abgelegt.url, bekannt: abgelegt.bekannt, size: abgelegt.size };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Das Bild ließ sich nicht ablegen.",
    };
  }
}
