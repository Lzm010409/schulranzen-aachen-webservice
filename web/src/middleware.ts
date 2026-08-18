import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth.shared";

/**
 * Grobes Tor vor der Anwendung: ohne Sitzungscookie geht es zum Login.
 * Die eigentliche Pruefung passiert serverseitig in `requireUser()` —
 * die Middleware spart nur den Umweg ueber eine Seite, die ohnehin
 * umleiten wuerde.
 *
 * `/bilder` liefert die Bilder aus versendeten Mails aus — das Mailprogramm
 * des Empfaengers hat keine Sitzung und muss ohne Anmeldung herankommen.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/abmelden",
  "/bilder",
  "/api/health",
  "/_next",
];

/** Vom Framework erzeugte Metadaten-Dateien; sie duerfen nie umgeleitet werden. */
const PUBLIC_FILES = new Set([
  "/favicon.ico",
  "/icon.svg",
  "/apple-icon.png",
  "/robots.txt",
  "/manifest.webmanifest",
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_FILES.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  if (request.cookies.get(SESSION_COOKIE)?.value) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
