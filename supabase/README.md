# Sugekraft – backend (Supabase)

Én felles løsning for mange firmaer. Alle data har `company_id`, og tilgangsregler i databasen
(Row Level Security) sørger for at hver bruker bare ser sitt eget firma, og innenfor firmaet bare
det rollen skal se.

| Rolle | Ser | Kan endre |
|---|---|---|
| `admin` (kontor) | Alt i eget firma | Alt i eget firma |
| `driver` (sjåfør) | Egne tildelte jobber, biler | Bare utførelsen av egne jobber: statuspunkter, kjøreseddel, masse, bilder |
| `client` (kunde) | Egne bestillinger og oppdrag, egen kundeinfo, bilder på utførte jobber | Nye bestillinger (alltid «venter»), endre/trekke tilbake bestillinger som venter |

## Filer

```
supabase/migrations/0001_init.sql   tabeller, triggere, tilgangsregler, fillagring, sanntid
supabase/seed.sql                   demo-firmaet Fjordsug AS (generert, se under)
supabase/tests/rls.test.mjs         test av tilgangsreglene (npm run test:db)
```

- `seed.sql` lages fra appens eksempeldata og `src/config.ts` med `npm run gen:seed`.
- `npm run test:db` kjører migrering og seed i en lokal Postgres (PGlite) og tester alle rollene,
  inkludert at to firmaer ikke ser hverandres data.

## Sette opp prosjektet (ca. 10 minutter)

1. **Opprett prosjekt** på [supabase.com](https://supabase.com): velg region i EU
   (f.eks. *Frankfurt* eller *Stockholm*) og et sterkt databasepassord.
2. **Kjør skjemaet:** *SQL Editor → New query*. Lim inn hele `migrations/0001_init.sql` og trykk *Run*.
3. **Last inn demo-firmaet:** ny query, lim inn `seed.sql` og trykk *Run*.
4. **Opprett brukerne:** *Authentication → Users → Add user → Create new user*. Huk av for
   *Auto Confirm User*:

   | E-post | Rolle |
   |---|---|
   | `kontorbruker@sugekraft.test` | Kontor |
   | `sjaforbruker@sugekraft.test` | Sjåfør (Ola Haugen) |
   | `kundebruker@sugekraft.test` | Kunde (Nordbygg Anlegg AS) |

   Bruk gjerne de samme passordene som i demo-modusen. Brukerne kobles automatisk til
   firma og rolle via tabellen `invites`.
5. **Sjekk:** *Table Editor → profiles* skal ha tre rader.
6. **Nøkler til appen:** *Project Settings → API*. Kopier **Project URL** og **anon public key**
   inn i `.env.local` (se `.env.example`). Disse to er laget for å ligge i nettleseren.
   **Del aldri `service_role`-nøkkelen.** Den omgår alle tilgangsregler.

## Nytt firma

```sql
insert into companies (slug, name, settings) values ('nyttfirma', 'Nytt Firma AS', '{...}');
insert into invites (email, company_id, role, full_name)
  values ('sjef@nyttfirma.no', (select id from companies where slug = 'nyttfirma'), 'admin', 'Sjefen');
```

Opprett så brukeren i *Authentication*. Kunder og oppdrag legger admin inn i appen. Biler, sjåfører
og flere brukere legges foreløpig inn i *Table Editor* / *Authentication* (administrasjon i appen kommer).
