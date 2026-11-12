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
   - `map`: kartsenter, zoom, kartstil og stedene som kan velges for en jobb
   - `vehicles`: biler med sjåfør, type og registreringsnummer
   - `services`: oppdragstyper
   - `massTypes`: massetyper. `hazardous: true` krever deklarasjonsnummer, `noMass: true` krever ikke mengde eller deponi.
   - `depots`: deponier og mottak
2. **`public/logo.svg`**: bytt ut med firmaets logo (SVG eller PNG).
3. Trykk **«Nullstill demo»** i appen, så bygges eksempeldataene på nytt med de nye innstillingene.
   Vil du nullstille hos alle som har åpnet demoen før, endrer du `storageKey` i konfigfilen.

Eksempeldataene (`src/data/seed.ts`) bruker steder, biler og oppdragstyper fra konfigfilen.
Finnes et navn ikke der lenger, velges et gyldig alternativ, slik at demoen ikke går i stykker.
Datoene er relative til dagens dato og flyttes automatisk fram når demoen åpnes en senere dag.

## Struktur

```
src/config.ts          konfigurasjon per firma
src/data/seed.ts       eksempeldata
src/store.ts           lagring (localStorage) og nullstilling
src/lib/pdf.ts         PDF-fakturagrunnlag (jsPDF, lastes først ved bruk)
src/lib/photos.ts      bildekomprimering og genererte eksempelbilder
src/views/             Kontor, Sjåfør, Arkiv
src/components/        kart (Leaflet + Kartverket), jobbskjema, dialoger
```

## Begrensninger i demoen

- Data lagres bare i nettleseren på den maskinen demoen kjøres på.
- localStorage har plass til omtrent 5 MB. Bilder skaleres ned til maks 1280 px, men mange egne
  bilder kan fylle plassen. Appen gir da beskjed, og «Nullstill demo» rydder opp.
- Kartet krever nett (Kartverkets kartfliser).
