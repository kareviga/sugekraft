# Sugekraft – demo

Webapp for sugebilfirmaer: kontor, sjåfør og arkiv med PDF-fakturagrunnlag.
Ren frontend (Vite + React + TypeScript). Data lagres i nettleserens localStorage.

## Backend (Supabase)

Appen kjører i dag i **demo-modus** med data i nettleseren. Databasen for drift (Supabase, én felles
løsning for mange firmaer) ligger i [`supabase/`](supabase/README.md): skjema, tilgangsregler,
demo-data og tester (`npm run test:db`). Å koble appen til databasen er neste trinn.

## Kjøre

```bash
npm install
npm run dev        # utvikling, http://localhost:5173
npm run build      # lager dist/ (statiske filer)
npm run preview    # serverer dist/ lokalt
```

`dist/` kan legges på hvilken som helst statisk vert (Netlify, GitHub Pages, en webserver eller en
mappe på et webhotell). Den må serveres over http(s). Å åpne `index.html` direkte fra disk fungerer ikke.

## Tilpasse til et nytt firma (ca. 5 minutter)

1. **`src/config.ts`**: alt firmaspesifikt ligger her:
   - `company`: navn, org.nr, adresse og kontaktinfo (vises i appen og på PDF-en)
   - `logo`: filnavn i `public/` eller full URL. Sett til `''` for å bruke initialer.
   - `colors`: hovedfarge, topplinje, uthevingsfarge og statusfarger
   - `map`: kartsenter, zoom og kartstil. Adressesøket viser treff nærmest kartsenteret først.
   - `vehicles`: biler med type og registreringsnummer
   - `drivers`: sjåfører med telefon. Bil og sjåfør velges hver for seg i hvert oppdrag.
   - `services`: oppdragstyper
   - `massTypes`: massetyper. `hazardous: true` krever deklarasjonsnummer, `noMass: true` krever ikke mengde eller deponi.
   - `depots`: deponier og mottak
2. **`public/logo.svg`**: bytt ut med firmaets logo (SVG eller PNG).
3. Trykk **«Nullstill demo»** i appen, så bygges eksempeldataene på nytt med de nye innstillingene.
   Vil du nullstille hos alle som har åpnet demoen før, endrer du `storageKey` i konfigfilen.

Eksempeldataene (`src/data/seed.ts`) ligger rundt Oslo med ekte koordinater. Vil du flytte demoen til et
annet område, bytter du ut adressene i `A`-tabellen der, i tillegg til `map.center`. Biler, oppdragstyper,
masser og deponier hentes fra konfigfilen. Finnes et navn ikke der lenger, velges et gyldig alternativ, slik at demoen ikke går i stykker.
Datoene er relative til dagens dato og flyttes automatisk fram når demoen åpnes en senere dag.

## Brukere og roller

Demo-innlogginger (settes i `config.ts` under `users`):

| Brukernavn | Rolle | Ser |
|---|---|---|
| `kontorbruker` | Kontor | Alt: Kontor, Kunder, Bilpark, Sjåfør, Arkiv og faktura |
| `sjåførbruker` | Sjåfør | Egne oppdrag (koblet til sjåfør via `driverId`) |
| `kundebruker` | Kunde | Kundeportalen for sin kunde (koblet via `clientId`) |

Passordene står ikke i repoet. `config.ts` har bare en SHA-256-hash (`passwordHash`). Slik bytter du passord:

```bash
node scripts/hash-password.mjs "NyttPassord"   # lim inn hashen i config.ts
```

Innloggingen er bare for demo (alt kjører i nettleseren) og huskes til man logger ut.
`sjåførbruker` kan også skrives `sjaforbruker`.

## Språk (norsk / engelsk)

Språkvelgeren **NO | EN** står i toppmenyen og på innloggingssiden, og valget huskes i nettleseren.

- All tekst i grensesnittet slås opp med `tr('Norsk tekst')`. Engelsk oversettelse ligger i
  `src/i18n/en.ts`, med norsk tekst som nøkkel. Mangler en oversettelse, vises norsk.
- Tjenester, massetyper, deponier, enheter og biltyper fra konfigfilen oversettes via
  `translations.en` i `src/config.ts`. Husk å legge inn engelske navn når du endrer dem.
- Fritekst skrevet av brukere (beskjeder, kommentarer, kundenavn og adresser) oversettes ikke.

## Kunder og bestillinger

- **Kunder** (admin): kunderegister med kontaktinfo og adresse. Herfra kan kontoret legge inn oppdrag for kunden.
- **Kundeportalen**: kunden ser egne bestillinger og oppdrag med status (Venter på godkjenning, Avvist,
  Bekreftet, Planlagt, Pågår og Utført), fremdrift og dokumentasjon. Kunden kan bestille nytt og trekke tilbake
  bestillinger som ikke er godkjent.
- **Godkjenning**: nye bestillinger vises øverst i Kontor (med tall på fanen). Kontoret kan godta (og sette på
  bil og sjåfør med en gang), redigere eller avvise med begrunnelse, som kunden ser i portalen.
- Kontoret kan fortsatt legge inn oppdrag selv, også for kunder som ikke er i registeret (f.eks. telefonbestilling).

## Statuser og plassering

- **Kommende**: jobben er ikke tildelt bil. **Aktiv**: tildelt en sjåfør. **Ferdig**: lukket av sjåføren.
  Statusen følger tildelingen automatisk.
- Adressefeltet søker i Kartverkets adresseregister (Geonorge, gratis og uten nøkkel). Velger du et treff,
  settes nålen på adressen. Uten adresse klikker du i kartet i skjemaet eller drar nålen, og appen foreslår
  nærmeste registrerte adresse.
- Sjåføren får «Naviger til stedet» med veibeskrivelse til nålens koordinater, i Google Maps eller Apple Kart.
  iPhone/iPad bruker Apple Kart som standard, og valget huskes på enheten.
- Plasseringen endres under «Rediger» på jobben (klikk eller dra nålen i skjemaets kart).

## Biler og sjåfører

- Biler (`vehicles`) og sjåfører (`drivers`) er adskilte lister i konfigfilen.
- I hvert oppdrag velges **bil** og **sjåfør** hver for seg. Uten sjåfør er oppdraget **Kommende**, med
  sjåfør er det **Aktivt**. Samme bil kan kjøres av forskjellige sjåfører på forskjellige oppdrag.
- **Bilpark** viser bare bilene: type, reg.nr., status (på oppdrag, har jobber i dag, ledig, ute av drift),
  hvem som er i bilen nå og dagens oppdrag. Alt utledes av oppdragene. Det eneste som settes der, er «ute av drift».
- Sjåføren velger «Jeg er» og ser oppdragene sine med hvilken bil som skal brukes.

## Statuspunkter for sjåføren

Sjåføren huker av punktene i rekkefølge, med klokkeslett (forhåndsutfylt med nå) og valgfri kommentar:

1. Startet kjøring – bilen regnes som «på oppdrag» i Bilpark
2. Ankommet sted
3. Startet arbeid – starten på arbeidstiden i fakturagrunnlaget
4. Fullført arbeid – slutten på arbeidstiden
5. Kjørt fra sted
6. Ankommet deponi – bare når massene skal deponeres. Deponi velges fra listen.
7. Ferdig – avslutter jobben. Krever at kjøreseddel, bilder, masse osv. er fylt ut.

Siste punkt kan angres, og alle punkter kan endres. Kontor, Bilpark, arkivet og PDF-en viser fremdriften.
PDF-en viser både arbeidstid og total tid inkludert kjøring.

## Struktur

```
src/config.ts          konfigurasjon per firma
src/data/seed.ts       eksempeldata
src/store.ts           lagring (localStorage) og nullstilling
src/lib/pdf.ts         PDF-fakturagrunnlag (jsPDF, lastes først ved bruk)
src/lib/photos.ts      bildekomprimering og genererte eksempelbilder
src/lib/geo.ts         adressesøk og nærmeste adresse (Geonorge)
src/lib/steps.ts       statuspunkter (rekkefølge, fremdrift, tider)
src/lib/fleet.ts       bilstatus utledet av oppdragene
src/lib/auth.ts        demo-innlogging og roller
src/i18n/              språk: tr()/trd() og engelsk ordbok (en.ts)
src/views/Clients.tsx  kunderegister (admin)
src/views/ClientPortal.tsx  kundeportal
src/views/             Kontor, Sjåfør, Arkiv
src/components/        kart (Leaflet + Kartverket), jobbskjema, dialoger
```

## Begrensninger i demoen

- Data lagres bare i nettleseren på den maskinen demoen kjøres på.
- localStorage har plass til omtrent 5 MB. Bilder skaleres ned til maks 1280 px, men mange egne
  bilder kan fylle plassen. Appen gir da beskjed, og «Nullstill demo» rydder opp.
- Kart og adressesøk krever nett (Kartverket og Geonorge).
