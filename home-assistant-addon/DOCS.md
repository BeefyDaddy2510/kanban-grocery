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

Od verze 1.8.0 lze v sekci **Nákupy** nahrát fotografii nebo PDF účtenky. Lokální OCR s podporou češtiny a angličtiny vytěží názvy položek, množství a ceny. Výsledek se před uložením vždy zobrazí ke kontrole; rozpoznané hodnoty lze opravit a checkboxem vybrat pouze položky, které se mají uložit do zásob. Soubor účtenky se po zpracování smaže a neposílá se do externí OCR služby.

## Sledování hmotnosti a jídelní historie

V menu **Sledování hmotnosti** lze vytvořit samostatné karty členů domácnosti, nastavit cílovou váhu a denní cíle energie, sacharidů včetně cukrů, tuků, bílkovin a vlákniny. Každý den má vlastní trvale uložený jídelní přehled rozdělený na snídani, dvě svačiny, oběd a večeři.

Jídla lze vybírat z databáze potravin a zásob nebo zapsat ručně. Ručně zadanou potravinu je možné současně uložit do domácí databáze pro další použití. Stejně jako ostatní data jsou osobní karty, vážení a jídelní historie součástí persistentního úložiště a záloh addonu.

Hotový recept lze do vybrané fáze dne přidat podle počtu porcí nebo skutečně zkonzumované hmotnosti. Grocy Homie vypočítá poměrnou část energie a makroživin z hmotností ingrediencí receptu.

Položky denního přehledu lze označit checkboxy. Výběr je možné přesunout mezi snídaní, svačinami, obědem a večeří, zkopírovat 1:1 na libovolné datum nebo z něj vytvořit nový recept včetně hmotností a nutričních údajů.

## Podpora

Chyby a návrhy hlaste v [GitHub Issues](https://github.com/BeefyDaddy2510/kanban-grocery/issues).
