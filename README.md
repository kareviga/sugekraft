# Sugekraft – demo

Webapp for sugebilfirmaer: kontor, sjåfør og arkiv med PDF-fakturagrunnlag.
Ren frontend (Vite + React + TypeScript). Data lagres i nettleserens localStorage.

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
   - `drivers`: sjåfører med telefon. Biler og sjåfører er adskilt, og hvem som kjører hvilken bil settes i Bilpark.
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

## Statuser og plassering

- **Kommende**: jobben er ikke tildelt bil. **Aktiv**: tildelt en sjåfør. **Ferdig**: lukket av sjåføren.
  Statusen følger tildelingen automatisk.
- Adressefeltet søker i Kartverkets adresseregister (Geonorge, gratis og uten nøkkel). Velger du et treff,
  settes nålen på adressen. Uten adresse klikker du i kartet i skjemaet eller drar nålen, og appen foreslår
  nærmeste registrerte adresse.
- Sjåføren får «Naviger til stedet» med veibeskrivelse til nålens koordinater, i Google Maps eller Apple Kart.
  iPhone/iPad bruker Apple Kart som standard, og valget huskes på enheten.
- I Kontor kan valgt jobb flyttes ved å dra nålen i kartet, med «Angre» i meldingen.

## Biler og sjåfører

- **Bilpark** viser alle biler med dagens sjåfør, hva bilen gjør nå (på oppdrag, har jobber, ledig, ute av drift)
  og dagens jobber. Her settes sjåfør på bil, og biler kan settes ute av drift.
- Jobber tildeles en **bil**. Sjåføren som fyller ut jobben, lagres på jobben og står på PDF-en.
- I sjåførvisningen velger sjåføren «Jeg er» og «Bil i dag». Den som sto på bilen fra før, blir tatt av.

## Struktur

```
src/config.ts          konfigurasjon per firma
src/data/seed.ts       eksempeldata
src/store.ts           lagring (localStorage) og nullstilling
src/lib/pdf.ts         PDF-fakturagrunnlag (jsPDF, lastes først ved bruk)
src/lib/photos.ts      bildekomprimering og genererte eksempelbilder
src/lib/geo.ts         adressesøk og nærmeste adresse (Geonorge)
src/views/             Kontor, Sjåfør, Arkiv
src/components/        kart (Leaflet + Kartverket), jobbskjema, dialoger
```

## Begrensninger i demoen

- Data lagres bare i nettleseren på den maskinen demoen kjøres på.
- localStorage har plass til omtrent 5 MB. Bilder skaleres ned til maks 1280 px, men mange egne
  bilder kan fylle plassen. Appen gir da beskjed, og «Nullstill demo» rydder opp.
- Kart og adressesøk krever nett (Kartverket og Geonorge).
