import { describe, expect, it } from "vitest";
import { describeSmtpError, isPermanentError } from "../mailer";

function smtpError(fields: Record<string, unknown>, message: string) {
  return Object.assign(new Error(message), fields);
}

describe("SMTP-Fehlerklassifizierung", () => {
  it("erkennt eine abgelehnte Empfängeradresse als dauerhaft", () => {
    const error = smtpError(
      { code: "EENVELOPE", responseCode: 550 },
      "Can't send mail - all recipients were rejected: 550 Empfaenger unbekannt",
    );
    expect(isPermanentError(error)).toBe(true);
    const text = describeSmtpError(error);
    expect(text).toMatch(/550/);
  });

  it("erkennt Drosselung als vorübergehend", () => {
    const error = smtpError({ responseCode: 421 }, "421 too many messages");
    expect(isPermanentError(error)).toBe(false);
  });

  it("erklärt eine abgelehnte Anmeldung verständlich", () => {
    const error = smtpError({ code: "EAUTH", responseCode: 535 }, "535 auth failed");
    expect(isPermanentError(error)).toBe(true);
    expect(describeSmtpError(error)).toMatch(/App-Passwort/);
  });

  it("behandelt Verbindungsfehler als vorübergehend", () => {
    const error = smtpError({ code: "ECONNREFUSED" }, "connect ECONNREFUSED");
    expect(isPermanentError(error)).toBe(false);
    expect(describeSmtpError(error)).toMatch(/Host oder Port/);
  });
});
