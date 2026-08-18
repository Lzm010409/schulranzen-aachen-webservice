import { requirePermissionOrRedirect } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TemplateEditor } from "../template-editor";

export const metadata = { title: "Vorlage anlegen" };

const STARTER = `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:8px">

        <tr><td style="padding:24px 32px;border-bottom:1px solid #e4e4e7">
          <strong style="font-size:18px">Schulranzen-Aachen</strong>
        </td></tr>

        <tr><td style="padding:32px;font-size:15px;line-height:1.6">
          <p>{{anrede}},</p>
          {{content}}
          <p style="margin-top:24px">Herzliche Gruesse<br>Ihr Team von Schulranzen-Aachen</p>
        </td></tr>

        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a">
          <p style="margin:0 0 8px">
            Schulranzen-Aachen · Musterstrasse 1 · 52062 Aachen<br>
            Telefon 0241 000000 · info@schulranzen-aachen.de
          </p>
          <p style="margin:0">
            Sie moechten keine weiteren E-Mails erhalten?
            <a href="{{abmeldelink}}" style="color:#71717a">Hier abmelden</a>.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

export default async function NewTemplatePage() {
  await requirePermissionOrRedirect("vorlagen.verwalten");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Vorlage anlegen"
        description="Das vorbelegte Grundgerüst enthält bereits Kopf, Fuß, Impressum und Abmeldelink."
      />
      <TemplateEditor
        cancelHref="/vorlagen"
        values={{
          name: "",
          subject: "",
          body: STARTER,
          isHtml: true,
          category: "",
        }}
      />
    </div>
  );
}
