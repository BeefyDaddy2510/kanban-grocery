# Grocy Homie

Grocy Homie spravuje domácí zásoby, mrazák, nákupní seznamy, recepty a úkoly přímo v rozhraní Home Assistantu.

## Instalace

1. Po instalaci aplikaci spusťte.
2. Zapněte **Zobrazit v postranním panelu**.
3. Otevřete **Grocy Homie** v postranním menu Home Assistantu.

Aplikace používá Home Assistant Ingress. Není potřeba nastavovat port, HTTPS ani další přihlašovací údaje.

## Sdílené ukládání dat

Data se ukládají do persistentního adresáře addonu spravovaného Home Assistant Supervisorem. Telefon, počítač i další zařízení proto po otevření Grocy Homie používají stejnou domácnost.

Při prvním spuštění po aktualizaci z verze 1.2.0 se existující data z právě otevřeného prohlížeče automaticky převedou do Home Assistantu. Tento prohlížeč proto otevřete jako první na zařízení, ve kterém máte nejaktuálnější data.

Úložiště je součástí záloh addonu. Otevření aplikace na více zařízeních nevyžaduje žádný účet ani další databázi.

## Fotoaparát a skenování

Ingress běží pod zabezpečeným přístupem Home Assistantu. Dostupnost fotoaparátu může záviset na oprávnění prohlížeče nebo mobilní aplikace Home Assistant.

Od verze 1.4.0 lze naskenovaný EAN spárovat s vlastní databází potravin nebo veřejným katalogem Open Food Facts a produkt rovnou přidat do zásob, mrazáku či nákupního seznamu. Potraviny uložené v domácím katalogu mají před externím API vždy přednost.

## Podpora

Chyby a návrhy hlaste v [GitHub Issues](https://github.com/BeefyDaddy2510/kanban-grocery/issues).
