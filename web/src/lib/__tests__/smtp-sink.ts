import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import tls from "node:tls";

export type ReceivedMail = { to: string; raw: string };

/**
 * Minimaler SMTP-Server ueber TLS fuer Integrationstests. Nimmt Mails an und
 * legt sie im Speicher ab; Adressen aus `rejectFor` werden mit 550 abgelehnt,
 * damit sich der Fehlerpfad pruefen laesst.
 */
export async function startSmtpSink(options: {
  port: number;
  rejectFor?: string[];
}): Promise<{
  received: ReceivedMail[];
  close: () => void;
}> {
  const reject = new Set(options.rejectFor ?? []);
  const dir = mkdtempSync(join(tmpdir(), "smtp-cert-"));

  execFileSync(
    "openssl",
    [
      "req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", join(dir, "key.pem"),
      "-out", join(dir, "cert.pem"),
      "-days", "1",
      "-subj", "/CN=localhost",
    ],
    { stdio: "ignore" },
  );

  const received: ReceivedMail[] = [];

  const server = tls.createServer(
    {
      key: readFileSync(join(dir, "key.pem")),
      cert: readFileSync(join(dir, "cert.pem")),
    },
    (socket) => {
      let buffer = "";
      let inData = false;
      let lines: string[] = [];
      let recipient = "";

      socket.write("220 localhost SMTP Attrappe\r\n");

      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        let index: number;
        while ((index = buffer.indexOf("\r\n")) >= 0) {
          const line = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);

          if (inData) {
            if (line === ".") {
              inData = false;
              received.push({ to: recipient, raw: lines.join("\n") });
              lines = [];
              socket.write("250 OK angenommen\r\n");
            } else {
              lines.push(line);
            }
            continue;
          }

          const command = line.toUpperCase();
          if (command.startsWith("EHLO") || command.startsWith("HELO")) {
            socket.write("250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n");
          } else if (command.startsWith("AUTH")) {
            socket.write("235 Authentifizierung erfolgreich\r\n");
          } else if (command.startsWith("RCPT TO")) {
            recipient = line.replace(/.*<([^>]*)>.*/, "$1");
            socket.write(
              reject.has(recipient)
                ? "550 Empfaenger unbekannt\r\n"
                : "250 OK\r\n",
            );
          } else if (command === "DATA") {
            inData = true;
            socket.write("354 Text eingeben, Ende mit .\r\n");
          } else if (command === "QUIT") {
            socket.write("221 Tschuess\r\n");
            socket.end();
          } else {
            socket.write("250 OK\r\n");
          }
        }
      });

      socket.on("error", () => undefined);
    },
  );

  await new Promise<void>((resolve) =>
    server.listen(options.port, "127.0.0.1", resolve),
  );

  return {
    received,
    close: () => {
      server.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
