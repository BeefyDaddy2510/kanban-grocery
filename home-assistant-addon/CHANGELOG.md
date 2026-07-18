# Changelog

## 1.8.1

- OCR nově rozlišuje produktové tabulky faktur od souhrnných částek a platebních řádků.
- Faktury z Makra vytěžují EAN, názvy, vážené i násobené množství, ceny s DPH a řádkové slevy; opakované produkty se sloučí.
- Digitální účtenky z Kauflandu podporují daňové značky za cenou, množství na samostatném řádku a následné slevy.
- PDF s použitelnou textovou vrstvou se nejprve čtou přímo; ostatní se zpracují ve vyšším rozlišení dvěma režimy OCR.
- V Nastavení se zobrazuje aktuální verze Grocy Homie.

## 1.8.0

- Rychlé přidání položky do nákupního seznamu nově umožňuje nepovinně zadat množství a cenu za kus.
- Při dokončení nákupu lze u všech položek doplnit nebo opravit množství a cenu ještě před převodem do zásob.
- Fotografie a PDF účtenek lze lokálně zpracovat pomocí OCR v češtině a angličtině; rozpoznané názvy, množství a ceny lze opravit a jednotlivě vybrat pro uložení do zásob.
- Účtenky se zpracovávají pouze uvnitř Grocy Homie a neposílají se do externí OCR služby.

## 1.7.3

- Kurz EUR/CZK se nově načítá přes backend aplikace, takže jej Home Assistant ingress neblokuje pravidly CORS.
- Backend kontroluje nový kurz ECB každých šest hodin a poslední úspěšnou hodnotu uchovává v perzistentních datech.
- Při dočasném výpadku ECB aplikace bezpečně použije poslední známý kurz.

## 1.7.2

- Položky v nákupních seznamech lze nově upravit včetně názvu, množství, jednotky, ceny, minima a převodu do zásob.
- Jednotlivé položky nákupního seznamu lze smazat přímo z řádku.

## 1.7.1

- Nákupní seznamy lze přesouvat dlouhým podržením a přetažením před, za nebo mezi ostatní seznamy.
- Nový rychlý řádek přidá položku do aktivního seznamu přes Enter nebo tlačítko plus; podrobný formulář zůstává zachovaný.
- Rychlé zadávání našeptává názvy z databáze potravin a při shodě zachová propojení na produkt.
- Opraveno zobrazení počtu archivovaných seznamů.

## 1.7.0

- Tlačítko Nový seznam nyní otevře formulář a vytvoří nový nákupní seznam včetně typu a vlastní barvy.
- Nový nákupní seznam lze vytvořit také v případě, že jsou všechny ostatní seznamy archivované.
- Databáze obsahuje 290 základních surovin s nepovinným EAN a orientačními výživovými hodnotami.
- Každá základní surovina má vlastní tematickou fotografii z otevřeného internetového zdroje včetně údajů o autorovi a licenci.
- Karty databáze potravin mají zlepšený kontrast textu a bezpečný náhradní obrázek.

## 1.6.0

- Hotové recepty lze přidávat do jídelního dne podle porce nebo zkonzumované hmotnosti.
- Z vybraných položek denního jídelníčku lze vytvořit nový recept s porcí a hmotnostmi ingrediencí.
- Vybrané položky lze přesouvat mezi jídly nebo kopírovat na libovolný minulý či budoucí den.
- Kompaktní název položky Hmotnost v postranním menu.

## 1.5.0

- Nutriční údaje nově rozlišují celkové sacharidy a podíl cukrů.
- Nové Sledování hmotnosti s kartami osob, cílovou váhou a historií vážení.
- Denní jídelní přehled po jednotlivých jídlech s historií, energií a plněním makroživin.
- Přidávání jídel z databáze, zásob nebo ručním zápisem s volitelným uložením do databáze potravin.

## 1.4.0

- Nová databáze potravin s EAN, fotografií, gramáží balení a nutričními hodnotami.
- Globální SCAN s dohledáním produktu v domácím katalogu nebo Open Food Facts.
- Přidání naskenované potraviny do zásob, mrazáku nebo nákupního seznamu včetně množství.
- Ukládání produktů do katalogu při ručním přidání do zásob a nákupního seznamu.
- Nová barevná ikona a logo Grocy Homie pro web i Home Assistant.
- Jeden verzovaný multiarch image pro standardní Docker deployment i Home Assistant.

## 1.3.0

- Centrální persistentní úložiště v Home Assistantu dostupné ze všech zařízení.
- Automatická migrace existujících dat z prvního prohlížeče po aktualizaci.
- Průběžná synchronizace otevřených klientů a indikace stavu ukládání.

## 1.2.0

- Kompletní uživatelské rozhraní v češtině, angličtině a němčině.
- Rychlé přepínání jazyka přímo v záhlaví aplikace.
- Nastavení výchozího jazyka s uložením mezi návštěvami.
- Lokalizované formátování data, čísel a měn.

## 1.1.0

- Editace existujících receptů.
- Přidávání surovin do receptu kliknutím ze zásob a našeptávání při ručním zápisu.
- Potvrzení dokončeného nákupu s výběrem položek, které se mají převést do zásob.

## 1.0.0

- První vydání Grocy Homie pro Home Assistant.
- Zabezpečený přístup přes Home Assistant Ingress.
- Podpora architektur amd64 a aarch64.
- Položka Grocy Homie v postranním panelu.
