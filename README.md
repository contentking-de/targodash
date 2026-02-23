# SEO Dashboard

Ein umfassendes SEO-Dashboard zur Visualisierung und Analyse von Google Search Console Daten mit KI-gestützten Tools.

## Features

### Google Search Console Integration
- **Umfassende Analysen**: Suchanfragen, Seiten-Performance, Länder-Statistiken, Geräte-Verteilung
- **Zeitraum-Vergleich**: Vergleiche verschiedene Zeiträume mit Trend-Indikatoren
- **Snapshots**: Speichere GSC-Daten für historische Analysen und Vergleiche

### SEO Management
- **SEO Reifegrad**: Checklisten-basierte SEO-Bewertung mit Team-Zuweisungen
- **KVP System**: Kontinuierlicher Verbesserungsprozess mit URL-Tracking, Focus-Keywords und Subkeywords
- **Rank Tracker**: Keyword-Rankings überwachen mit DataForSEO Integration und Suchvolumen

### Content & Briefings
- **Briefing System**: SEO Content Briefings erstellen und verwalten (Neuer Content, Content bearbeiten, Lexikon)
- **KI-generierte Schaubilder**: Automatische Diagramm-Generierung basierend auf Content

### SEO Helper Tools
- **AI Summarizer**: KI-gestützte Zusammenfassungen
- **Benchmarker**: SERP-Analyse und Wettbewerber-Vergleich
- **Content Analyzer**: Content-Analyse
- **FAQ Generator**: Automatische FAQ-Generierung
- **Keyword Clustering**: Keywords gruppieren und clustern
- **Schema Generator**: Structured Data generieren
- **SERP Preview**: Vorschau für Suchergebnisse
- **Title Generator**: SEO-optimierte Titel generieren

### Weitere Features
- **Linkprofil**: Backlink-Analyse mit DataForSEO
- **Task Management**: Kanban-Board für Aufgabenverwaltung
- **Ticket System**: Bugs und Feature-Wünsche erfassen
- **Superagent**: KI-Chat-Assistent
- **Reporting**: KI-generierte Reports
- **Admin-Bereich**: Benutzerverwaltung mit Rollenbasiertem Zugangssystem

### Authentifizierung & Rollen
- **Magic Link**: Passwordless Login via E-Mail
- **Google OAuth**: Direkter GSC-Zugriff
- **RBAC**: Rollen: `superadmin`, `agentur`, `member`, `viewer`

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Runtime**: React 19
- **Datenbank**: Neon PostgreSQL (Serverless)
- **ORM**: Prisma 5
- **Authentifizierung**: NextAuth.js v5 (Beta)
- **E-Mail**: Resend
- **Charts**: Recharts
- **Styling**: Tailwind CSS v4
- **KI-Integration**: OpenAI, Anthropic Claude, Google Gemini
- **SEO APIs**: DataForSEO (Rankings, Suchvolumen, Backlinks)
- **File Storage**: Vercel Blob
- **Drag & Drop**: dnd-kit

## Setup

### 1. Umgebungsvariablen

Erstelle eine `.env` Datei mit folgenden Variablen:

```env
# Neon Database
DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"

# NextAuth
NEXTAUTH_SECRET="dein-geheimer-schluessel"
NEXTAUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST=true

# Resend
RESEND_API_KEY="re_..."

# Google OAuth
GOOGLE_CLIENT_ID="deine-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="dein-client-secret"

# Admin Users (komma-separierte Liste von E-Mail-Adressen)
ADMIN_EMAILS="admin@example.com,admin2@example.com"

# DataForSEO API Credentials (Rank Tracker & Backlinks)
DATAFORSEO_USERNAME="your-email@example.com"
DATAFORSEO_PASSWORD="your-password"

# KI-APIs
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_GENERATIVE_AI_API_KEY="..."

# Proxy für Web Scraping (optional)
IPROYAL_PROXY_URL="http://user:pass@host:port"
```

### 2. Google Cloud Console Setup

1. Gehe zu [Google Cloud Console](https://console.cloud.google.com/)
2. Erstelle ein neues Projekt oder wähle ein bestehendes
3. Aktiviere die "Google Search Console API"
4. Erstelle OAuth 2.0 Credentials:
   - Anwendungstyp: Webanwendung
   - Autorisierte Redirect-URIs:
     - `http://localhost:3000/api/auth/callback/google` (Login)
     - `http://localhost:3000/api/auth/link-google/callback` (GSC verknüpfen)
5. Kopiere Client-ID und Client-Secret in die `.env`

### 3. Neon Datenbank Setup

1. Erstelle einen Account auf [neon.tech](https://neon.tech)
2. Erstelle ein neues Projekt
3. Kopiere den Connection String in die `.env`

### 4. Installation

```bash
# Abhängigkeiten installieren
npm install

# Datenbank-Schema anwenden
npx prisma db push

# Entwicklungsserver starten
npm run dev
```

### 5. Resend Setup

1. Erstelle einen Account auf [resend.com](https://resend.com)
2. Verifiziere deine Domain (z.B. tasketeer.com)
3. Erstelle einen API-Key und füge ihn zur `.env` hinzu

## Projektstruktur

```
gsc-dashboard/
├── prisma/
│   └── schema.prisma              # Datenbankschema
├── scripts/
│   └── add-user.ts                # User anlegen Script
├── src/
│   ├── app/
│   │   ├── (auth)/                # Auth-Seiten (Login, Verify, Auth-Confirm)
│   │   ├── (dashboard)/
│   │   │   ├── admin/             # Admin-Bereich (User-Verwaltung)
│   │   │   ├── auswertung/        # Auswertungen
│   │   │   ├── briefings/         # Briefing-System
│   │   │   ├── countries/         # Länder-Analyse
│   │   │   ├── devices/           # Geräte-Analyse
│   │   │   ├── linkprofil/        # Backlink-Analyse
│   │   │   ├── pages/             # Seiten-Performance
│   │   │   ├── queries/           # Suchanfragen
│   │   │   ├── ranktracker/       # Keyword Rank Tracker
│   │   │   ├── reporting/         # KI-Reports
│   │   │   ├── seo-helper/        # SEO Tools (AI, FAQ, Schema etc.)
│   │   │   ├── seo-reifegrad/     # SEO Maturity Assessment
│   │   │   ├── settings/          # Einstellungen
│   │   │   ├── snapshots/         # GSC Snapshots
│   │   │   ├── superagent/        # KI-Chat
│   │   │   ├── tasks/             # Task Management (Kanban)
│   │   │   ├── tickets/           # Bug/Feature Tickets
│   │   │   ├── ubs-kvp/           # KVP System
│   │   │   └── vergleich/         # Keyword/Verzeichnis-Vergleich
│   │   └── api/                   # API-Routes
│   ├── components/
│   │   ├── charts/                # Chart-Komponenten (Line, Bar, Pie, Sunburst)
│   │   ├── dashboard/             # Dashboard-Komponenten
│   │   ├── providers/             # Session & Theme Provider
│   │   └── ui/                    # UI-Komponenten
│   ├── contexts/
│   │   └── PropertyContext.tsx    # GSC Property Context
│   ├── hooks/
│   │   └── useTheme.ts            # Theme Hook
│   └── lib/
│       ├── auth.ts                # NextAuth Konfiguration
│       ├── dataforseo.ts          # DataForSEO API Client
│       ├── gsc.ts                 # GSC API Client
│       ├── prisma.ts              # Prisma Client
│       ├── proxy-fetch.ts         # Proxy für Web Scraping
│       ├── rbac.ts                # Role-Based Access Control
│       └── resend.ts              # Resend E-Mail Client
├── public/
│   ├── briefing-vorlage.docx      # Briefing Vorlage
│   └── seo-checkliste.xlsx        # SEO Checkliste
├── .env                           # Umgebungsvariablen
└── package.json
```

## Scripts

```bash
# Entwicklungsserver starten
npm run dev

# Produktions-Build erstellen
npm run build

# Produktionsserver starten
npm start

# ESLint ausführen
npm run lint

# Neuen User anlegen
npm run add-user
```

## Datenbank-Modelle

| Model | Beschreibung |
|-------|-------------|
| `User` | Benutzer mit Rollen (superadmin, agentur, member, viewer) |
| `GSCProperty` | Google Search Console Properties |
| `Snapshot` | Gespeicherte GSC-Daten für historische Analysen |
| `SEOMaturity` | SEO Reifegrad-Bewertungen mit Checklisten |
| `RankTracker` | Keyword Rank Tracking mit Suchvolumen |
| `KVPUrl` | URLs im kontinuierlichen Verbesserungsprozess |
| `Briefing` | SEO Content Briefings |
| `Task` | Aufgaben für Kanban-Board |
| `Ticket` | Bug-Reports und Feature-Wünsche |
| `BacklinkProfile` | Backlink-Daten von DataForSEO |

## Deployment

Das Dashboard kann auf Vercel deployed werden:

```bash
# Vercel CLI installieren
npm i -g vercel

# Deployen
vercel
```

Vergiss nicht:
- Umgebungsvariablen in Vercel konfigurieren
- Google OAuth Redirect-URI auf `https://deine-domain.vercel.app/api/auth/callback/google` aktualisieren
- Google OAuth Redirect-URI für Link-Account auf `https://deine-domain.vercel.app/api/auth/link-google/callback` hinzufügen

## Lizenz

MIT
