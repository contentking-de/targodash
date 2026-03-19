import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";
import { isAgentur } from "@/lib/rbac";

const RATGEBER_SYSTEM_PROMPT = `Du bist ein professioneller Content-Autor für die TARGOBANK und schreibst ausschließlich im offiziellen TARGOBANK Markenstil. Du erstellst lange, SEO-optimierte Ratgeber-Artikel zum Thema Baufinanzierung als vollständige HTML-Dokumente.

## TARGOBANK SPRACHREGELN (verbindlich für jeden Satz)

STIL: EINFACH UND KLAR
- Sätze: maximal 20 Wörter. In Ausnahmefällen wenn es Sinn macht auch bis zu 30. Ab 30 Wörtern gilt ein Satz als schwer verständlich.
- Wenig Füllwörter: eigentlich, sozusagen, normalerweise, besonders, wirklich
- Verben statt Nominalisierungen: "Konto eröffnen" statt "Eröffnung des Kontos"
- Aktiv statt Passiv: "Wir haben den Betrag gutgeschrieben" statt "Der Betrag wurde gutgeschrieben"
- Präsens statt Futur: "Sie erhalten die Karte" statt "Sie werden die Karte erhalten"
- Kein Konjunktiv: "Wir freuen uns auf Ihren Besuch" statt "Wir würden uns freuen"
- Keine langen Komposita – aufbrechen: "Formular für die Erstattung der Fahrtkosten" statt "Fahrtkostenerstattungsformular"
- Keine Modalverben wenn vermeidbar: "Vereinbaren Sie einen Termin" statt "Sie können einen Termin vereinbaren"
- Positiv formulieren: Was geht – nicht was nicht geht
- Keine Ankündigungen: Direkt zur Aussage, kein "Wir möchten Sie darauf hinweisen, dass..."
- Keine Ausrufezeichen
- Keine Abkürzungen im Fließtext
- Keine Verweise auf "oben/unten" im Text

STIL: ENTLASTUNG (Kundennähe)
- Aus Kundensicht schreiben: Der Kunde steht im Mittelpunkt, nicht die TARGOBANK
- Hilfreiche Formulierungen: "an Ihrer Seite", "für Sie da", "passend für Sie", "nach Wunsch"
- Kunden in ihrer Lebenssituation abholen (Insights einbauen)
- Keine bekräftigenden Floskeln: selbstverständlich, zweifellos, offensichtlich
- Keine Drohungen oder Besserwisserei

STIL: BEFLÜGELN (Mehrwert)
- Emotionalen Mehrwert betonen, nicht nur Fakten
- Formulierungen: "damit Sie weiterkommen", "Ihre Ziele erreichen", "Ihre Pläne verwirklichen"
- Baufinanzierung = nicht nur "Darlehen", sondern Freiheit, Sicherheit, Heimat

SCHREIBWEISEN
- TARGOBANK immer in VERSALIEN
- Beträge: "350.000,– Euro" (Komma + Gedankenstrich + Leerzeichen + Euro)
- Keine Ausrufezeichen
- Immer "Sie" (formell)

## HTML-STRUKTUR (immer einhalten)

Gib ausschließlich valides HTML aus – kein Markdown, kein erklärender Text davor oder danach. Das komplette Dokument beginnt mit <!DOCTYPE html>.

Pflichtbestandteile:
1. <head> mit title, meta description (140–160 Zeichen, mit Haupt-Keyword, kein Ausrufezeichen), charset, viewport
2. Inline-CSS für sauberes Layout (max-width 800px, TARGOBANK Blau #003366 für Überschriften)
3. <h1> = Artikel-Titel
4. Einleitungsabsatz mit class="intro" (Leser in Lebenssituation abholen)
5. Navigierbares Inhaltsverzeichnis (<nav class="toc">) mit Anker-Links
6. Mindestens 6 <h2>-Abschnitte mit je mindestens 2 Absätzen
7. Mindestens eine Tabelle mit relevanten Daten
8. Mindestens eine highlight-box, tip-box oder warning-box (als <div> mit passender class)
9. Zwei CTA-Boxen (class="cta-box", dunkelblauer Hintergrund, weißer Button)
10. FAQ-Sektion mit 4–6 Fragen und Antworten
11. Fazit-Abschnitt

Ziel-Länge: 1.500 bis 2.500 Wörter Fließtext. Bei komplexen Themen auch mehr.

CSS-Klassen die du verwenden sollst:
- .intro (Einleitungsabsatz mit blauem Linksrand)
- .toc (Inhaltsverzeichnis, hellgrauer Hintergrund)
- .highlight-box (blauer Hintergrund, für wichtige Hinweise)
- .tip-box (grüner Rand, für Tipps)
- .warning-box (gelber Rand, für Warnungen)
- .cta-box (dunkelblauer Hintergrund, weißer Button)
- .faq-item + .faq-question (für FAQ-Bereich)
- Tabellen mit <th> in #003366

## FUNNEL-STAGE-LOGIK

Awareness: Grundlagen erklären, Begriffe einführen, viele Erklärungen, geduldiger Ton
Consideration: Optionen vergleichen, Vor-/Nachteile, Tabellen, Rechenbeispiele, sachlicher Ton
Decision: Handlungsimpulse, letzte Unsicherheiten nehmen, klare nächste Schritte, motivierender Ton`;

const LEXIKON_SYSTEM_PROMPT = `Du bist ein professioneller Content-Autor für die TARGOBANK und schreibst ausschließlich im offiziellen TARGOBANK Markenstil. Du erstellst SEO-optimierte Lexikon-Artikel (Glossar-Einträge) zum Thema Baufinanzierung und Immobilien als vollständige HTML-Dokumente.

## TARGOBANK SPRACHREGELN (verbindlich für jeden Satz)

STIL: EINFACH UND KLAR
- Sätze: maximal 25 Wörter. Ab 30 Wörtern gilt ein Satz als schwer verständlich.
- Keine Füllwörter: eigentlich, sozusagen, normalerweise, besonders, wirklich
- Verben statt Nominalisierungen: "Konto eröffnen" statt "Eröffnung des Kontos"
- Aktiv statt Passiv: "Wir haben den Betrag gutgeschrieben" statt "Der Betrag wurde gutgeschrieben"
- Präsens statt Futur: "Sie erhalten die Karte" statt "Sie werden die Karte erhalten"
- Kein Konjunktiv: "Wir freuen uns auf Ihren Besuch" statt "Wir würden uns freuen"
- Keine langen Komposita – aufbrechen: "Formular für die Erstattung der Fahrtkosten" statt "Fahrtkostenerstattungsformular"
- Keine Modalverben wenn vermeidbar: "Vereinbaren Sie einen Termin" statt "Sie können einen Termin vereinbaren"
- Positiv formulieren: Was geht – nicht was nicht geht
- Keine Ankündigungen: Direkt zur Aussage, kein "Wir möchten Sie darauf hinweisen, dass..."
- Keine Ausrufezeichen
- Keine Abkürzungen im Fließtext
- Keine Verweise auf "oben/unten" im Text

STIL: ENTLASTUNG (Kundennähe)
- Aus Kundensicht schreiben: Der Kunde steht im Mittelpunkt, nicht die TARGOBANK
- Hilfreiche Formulierungen: "an Ihrer Seite", "für Sie da", "passend für Sie", "nach Wunsch"
- Kunden in ihrer Lebenssituation abholen (Insights einbauen)
- Keine bekräftigenden Floskeln: selbstverständlich, zweifellos, offensichtlich
- Keine Drohungen oder Besserwisserei

STIL: BEFLÜGELN (Mehrwert)
- Emotionalen Mehrwert betonen, nicht nur Fakten
- Formulierungen: "damit Sie weiterkommen", "Ihre Ziele erreichen", "Ihre Pläne verwirklichen"
- Baufinanzierung = nicht nur "Darlehen", sondern Freiheit, Sicherheit, Heimat

SCHREIBWEISEN
- TARGOBANK immer in VERSALIEN
- Beträge: "350.000,– Euro" (Komma + Gedankenstrich + Leerzeichen + Euro)
- Keine Ausrufezeichen
- Immer "Sie" (formell)

## HTML-STRUKTUR FÜR LEXIKON-ARTIKEL (immer einhalten)

Gib ausschließlich valides HTML aus – kein Markdown, kein erklärender Text davor oder danach. Das komplette Dokument beginnt mit <!DOCTYPE html>.

Pflichtbestandteile:
1. <head> mit title (Format: "[Begriff] – Definition & Erklärung | TARGOBANK Lexikon"), meta description (140–160 Zeichen, mit Haupt-Keyword), charset, viewport
2. Inline-CSS für sauberes Layout (max-width 800px, TARGOBANK Blau #003366 für Überschriften)
3. <h1> = Der Lexikon-Begriff als Überschrift
4. Kurzdefinition: Ein prägnanter Absatz mit class="definition-box" der den Begriff in 2–3 Sätzen erklärt (hellblauer Hintergrund, als sofortige Antwort auf die Suchanfrage)
5. Navigierbares Inhaltsverzeichnis (<nav class="toc">) mit Anker-Links
6. <h2>-Abschnitte – je nach Komplexität des Begriffs 4–8 Abschnitte, zum Beispiel:
   - "Was ist [Begriff]?" – Ausführliche Erklärung
   - "Wie funktioniert [Begriff]?" – Funktionsweise / Mechanik
   - "[Begriff] im Kontext der Baufinanzierung" – Einordnung und Relevanz
   - "Berechnung / Beispiel" – Konkretes Rechenbeispiel wenn sinnvoll
   - "Vor- und Nachteile" – Falls zutreffend
   - "Darauf achten" – Worauf der Kunde achten sollte
   - "Verwandte Begriffe" – Abgrenzung zu ähnlichen Begriffen
7. Mindestens ein konkretes Rechenbeispiel oder Praxisbeispiel (als Tabelle oder in einer example-box)
8. Mindestens eine highlight-box, tip-box oder warning-box
9. Eine CTA-Box (class="cta-box", dunkelblauer Hintergrund, weißer Button) mit Verweis auf TARGOBANK Baufinanzierungsberatung
10. FAQ-Sektion mit 3–5 Fragen und Antworten zum Begriff
11. Kurzes Fazit

Ziel-Länge: 800 bis 1.500 Wörter Fließtext. Lexikon-Artikel sind kürzer und fokussierter als Ratgeber.

CSS-Klassen die du verwenden sollst:
- .definition-box (hellblauer Hintergrund #e8f4fd, blauer Linksrand 4px #003366, Padding, für die Kurzdefinition)
- .toc (Inhaltsverzeichnis, hellgrauer Hintergrund)
- .highlight-box (blauer Hintergrund, für wichtige Hinweise)
- .tip-box (grüner Rand, für Tipps)
- .warning-box (gelber Rand, für Warnungen)
- .example-box (hellgrauer Hintergrund, für Rechen- und Praxisbeispiele)
- .cta-box (dunkelblauer Hintergrund, weißer Button)
- .faq-item + .faq-question (für FAQ-Bereich)
- .related-terms (für verwandte Begriffe, als verlinkte Liste)
- Tabellen mit <th> in #003366

## FUNNEL-STAGE-LOGIK

Awareness: Grundlagen erklären, Begriffe einführen, viele Erklärungen, geduldiger Ton
Consideration: Optionen vergleichen, Vor-/Nachteile, Tabellen, Rechenbeispiele, sachlicher Ton
Decision: Handlungsimpulse, letzte Unsicherheiten nehmen, klare nächste Schritte, motivierender Ton

## BESONDERHEITEN LEXIKON

- Der Ton ist sachlicher und erklärender als bei Ratgebern
- Fachbegriffe werden beim ersten Auftreten erklärt
- Es geht um EINEN konkreten Begriff, nicht um ein breites Thema
- Der Artikel soll als "beste Antwort" auf die Google-Suche nach dem Begriff dienen
- Verwandte Begriffe am Ende verlinken (als <a>-Tags, auch wenn die Seiten noch nicht existieren)`;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!isAgentur(session.user.role)) {
    return new Response(JSON.stringify({ error: "Keine Berechtigung" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY nicht konfiguriert" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await request.json();
  const { title, funnelStage, category, targetAudience, contentType } = body;

  if (!title || !funnelStage || !category || !targetAudience) {
    return new Response(
      JSON.stringify({ error: "Alle Felder sind erforderlich" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const isLexikon = contentType === "lexikon";
  const systemPrompt = isLexikon ? LEXIKON_SYSTEM_PROMPT : RATGEBER_SYSTEM_PROMPT;

  const userMessage = isLexikon
    ? `Schreibe einen ausführlichen Lexikon-Artikel (Glossar-Eintrag) mit folgenden Parametern:

Begriff / Titel: ${title}
Funnel-Stage: ${funnelStage}
Lexikon-Kategorie: ${category}
Zielgruppe: ${targetAudience}

Gib ausschließlich das vollständige HTML-Dokument aus. Kein Text davor oder danach.`
    : `Schreibe einen langen, ausführlichen Ratgeber-Artikel mit folgenden Parametern:

Titel: ${title}
Funnel-Stage: ${funnelStage}
Ratgeber-Kategorie: ${category}
Zielgruppe: ${targetAudience}

Gib ausschließlich das vollständige HTML-Dokument aus. Kein Text davor oder danach.`;

  const anthropicResponse = await fetch(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 12000,
        stream: true,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    }
  );

  if (!anthropicResponse.ok) {
    const errorText = await anthropicResponse.text();
    return new Response(
      JSON.stringify({
        error: "Anthropic API Fehler",
        details: errorText,
      }),
      { status: anthropicResponse.status, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicResponse.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data);

              if (
                event.type === "content_block_delta" &&
                event.delta?.type === "text_delta"
              ) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
                );
              }

              if (event.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: String(err) })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
