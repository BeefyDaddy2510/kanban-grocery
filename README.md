# Domovka

Moderní domácí správce zásob inspirovaný aplikací Grocy. První verze funguje bez účtu a serveru — data se ukládají přímo do prohlížeče.

## Co je hotové

- přehled domácnosti s upozorněními a rychlými akcemi
- kanbanové zásoby, množství +/−, minima, ceny, data nákupu a expirace
- skenování EAN/QR živou kamerou nebo fotografií kódu
- vlastní fotografie produktů, automaticky zmenšené na thumbnail
- přednastavené i uživatelské kategorie
- mrazák s hlídáním doporučené doby pro nejlepší kvalitu
- nákupní seznamy podle obchodu a typu, průběžná cena a převod nákupu do zásob
- archivace a obnovení nákupních seznamů
- recepty s odesláním ingrediencí na nákupní seznam
- úkoly a měsíční kalendář
- CZK/EUR s kurzem načítaným z ECB (a bezpečnou poslední známou hodnotou při offline režimu)
- světlý a tmavý režim, responzivní rozložení
- lokální uložení všech změn

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
docker run --rm -p 8080:8080 -v kanban-grocery-config:/config kanban-grocery
```

## Důležité zdroje

Doby mražení vycházejí z tabulek [USDA Food Safety and Inspection Service](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/freezing-and-food-safety). Uvedené doby jsou doporučení pro kvalitu při souvislém skladování při −18 °C, nikoliv automatické datum zdravotní závadnosti.

Kurz EUR/CZK se načítá z denního referenčního kurzu [Evropské centrální banky](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html). Referenční kurzy ECB jsou informativní.

## Další produkční fáze

Pro víceuživatelské nasazení bude potřeba doplnit serverovou databázi, přihlášení a synchronizaci domácnosti. Tok skenování je v MVP připravený v rozhraní; skutečné rozpoznání EAN a párování produktů vyžaduje připojit kameru a produktový katalog (např. Open Food Facts). Poté dává smysl doplnit historii spotřeby, opakované úkoly a automatické návrhy nákupu.
