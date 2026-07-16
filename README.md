# Grocy Homie

<p align="center">
  <img src="public/app-icon.png" alt="Grocy Homie — košík se zeleninou" width="160" height="160">
</p>

Grocy Homie je moderní webová aplikace pro přehlednou správu domácích zásob, mrazáku, nákupních seznamů, receptů a úkolů. Na jednom místě hlídá množství i expirace, pomáhá plánovat nákupy a podporuje skenování EAN/QR kódů.

Projekt je inspirovaný aplikací Grocy a funguje bez samostatného účtu. V Dockeru a Home Assistant App ukládá data do vlastního persistentního úložiště, takže všechna zařízení používají stejnou domácnost.

## Co je hotové

- přehled domácnosti s upozorněními a rychlými akcemi
- globální fulltext přes zásoby, mrazák, nákupy, recepty a úkoly (`Ctrl/⌘ + K`)
- kanbanové zásoby s editací položek, množstvím +/−, minimy, cenami, daty nákupu a expirace
- skenování EAN/QR živou kamerou nebo fotografií kódu
- vlastní fotografie produktů nebo odkaz na existující obrázek; nahrané fotografie se automaticky zmenší na thumbnail
- výživové hodnoty na 100 g (kcal, sacharidy, tuky, bílkoviny a vláknina) s živým přepočtem podle zadané gramáže
- propojení na veřejný katalog Kalorických tabulek pro dohledání nutričních údajů
- upravitelné kategorie a umístění položek
- mrazák s hlídáním doporučené doby pro nejlepší kvalitu
- nákupní seznamy podle obchodu a typu, průběžná cena a selektivní převod zakoupených položek do zásob
- archivace a obnovení nákupních seznamů
- vlastní editovatelné recepty s ingrediencemi, postupem, štítky, výběrem surovin ze zásob a odesláním ingrediencí na nákupní seznam
- úkoly a měsíční kalendář
- CZK/EUR s kurzem načítaným z ECB (a bezpečnou poslední známou hodnotou při offline režimu)
- světlý a tmavý režim, responzivní rozložení
- nastavení názvu domácnosti, systémového/světlého/tmavého režimu, akcentní barvy včetně color pickeru a výchozích hodnot zásob
- centrální uložení a synchronizace všech změn
- vlastní databáze potravin s EAN, fotografií, gramáží balení, nutričními hodnotami, obchody, cenou, e-shopem a poznámkami
- globální tlačítko **SCAN** s volbou přidání naskenované potraviny do zásob, mrazáku nebo nákupního seznamu
- automatické dohledání neznámého EAN ve veřejné databázi Open Food Facts; domácí katalog má vždy přednost

## Spuštění

```bash
npm install
npm run dev
```

Produkční kontrola:

```bash
npm run build
```

## Docker a Portainer

Image se při každém pushi do větve `main` automaticky sestaví pro `amd64` i `arm64` a publikuje jako:

```text
ghcr.io/beefydaddy2510/kanban-grocery:latest
```

Každý release zároveň publikuje verzovaný multiarch tag, například `ghcr.io/beefydaddy2510/kanban-grocery:1.4.0`. Stejný image používá standardní Docker deployment i Home Assistant App, takže obě varianty dostávají vždy totožnou funkcionalitu.

V Portaineru otevřete **Stacks → Add stack → Web editor** a vložte:

```yaml
services:
  kanban-grocery:
    image: ghcr.io/beefydaddy2510/kanban-grocery:latest
    container_name: kanban-grocery
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - /opt/kanban-grocery/config:/config
```

Po nasazení bude aplikace dostupná na `http://IP_SERVERU:8080`. Pokud je GHCR package soukromý, je potřeba v Portaineru nejprve přidat GitHub Container Registry s GitHub tokenem oprávněným ke čtení balíčků. Pro jednoduché domácí nasazení lze package na GitHubu přepnout na veřejný.

### Kamera na telefonu

Tlačítko **Vyfotit kód** otevře fotoaparát telefonu i při běžném HTTP přístupu a následně kód rozpozná z fotografie. Průběžné živé skenování vyžaduje, aby byla aplikace otevřená přes HTTPS (omezení mobilních prohlížečů). Pro živý náhled proto nastavte před aplikaci HTTPS reverse proxy, například Nginx Proxy Manager, Caddy nebo Traefik.

Lokální sestavení a spuštění kontejneru:

```bash
docker build -t kanban-grocery .
docker run --rm -p 8080:8080 -v kanban-grocery-data:/data kanban-grocery
```

## Home Assistant App

Grocy Homie lze nainstalovat jako vlastní Home Assistant App na instalacích Home Assistant OS a Home Assistant Supervised.

1. V Home Assistantu otevřete **Nastavení → Apps → App store**.
2. V menu se třemi tečkami zvolte **Repositories**.
3. Přidejte adresu:

   ```text
   https://github.com/BeefyDaddy2510/kanban-grocery
   ```

4. Vyberte **Grocy Homie**, aplikaci nainstalujte a spusťte.
5. Zapněte **Zobrazit v postranním panelu**.

Home Assistant varianta používá zabezpečený Ingress, takže nepotřebuje samostatně zveřejněný port. Podporované architektury jsou `amd64` a `aarch64`.

> Od verze 1.3.0 se data ukládají přímo v Home Assistant addonu a automaticky se synchronizují mezi telefonem, počítačem a dalšími zařízeními. První prohlížeč otevřený po aktualizaci převede svá dosavadní lokální data do centrálního úložiště.

## Důležité zdroje

Doby mražení vycházejí z tabulek [USDA Food Safety and Inspection Service](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/freezing-and-food-safety). Uvedené doby jsou doporučení pro kvalitu při souvislém skladování při −18 °C, nikoliv automatické datum zdravotní závadnosti.

Kurz EUR/CZK se načítá z denního referenčního kurzu [Evropské centrální banky](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html). Referenční kurzy ECB jsou informativní.

## Další produkční fáze

Pro oddělené domácnosti a pokročilá oprávnění bude potřeba doplnit uživatelské účty. Dále dává smysl doplnit historii spotřeby, opakované úkoly, automatické návrhy nákupu a volitelný příspěvek nových produktů zpět do Open Food Facts.
