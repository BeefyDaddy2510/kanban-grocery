import type { FoodProduct, NutritionPer100g } from './types'

export const FOOD_CATALOG_SEED_VERSION = 2

type SeedGroup = {
  category: string
  packageGrams: number
  nutrition: NutritionPer100g
  names: string[]
}

const group = (category: string, packageGrams: number, nutrition: NutritionPer100g, names: string[]): SeedGroup => ({ category, packageGrams, nutrition, names })
const n = (kcal: number, carbs: number, sugars: number, fat: number, protein: number, fiber: number): NutritionPer100g => ({ kcal, carbs, sugars, fat, protein, fiber })

const categoryImages: Record<string, string> = {
  'Zelenina': './food-categories/vegetables.webp',
  'Ovoce': './food-categories/fruit.webp',
  'Maso': './food-categories/meat.webp',
  'Ryby a mořské plody': './food-categories/fish.webp',
  'Mléčné výrobky': './food-categories/dairy-eggs.webp',
  'Vejce': './food-categories/dairy-eggs.webp',
  'Luštěniny': './food-categories/legumes-nuts.webp',
  'Obiloviny a přílohy': './food-categories/grains-bread.webp',
  'Mouky a pečení': './food-categories/grains-bread.webp',
  'Pečivo': './food-categories/grains-bread.webp',
  'Ořechy a semínka': './food-categories/legumes-nuts.webp',
  'Tuky a oleje': './food-categories/oils-cans.webp',
  'Koření a bylinky': './food-categories/spices-herbs.webp',
  'Konzervy': './food-categories/oils-cans.webp',
  'Dochucovadla': './food-categories/spices-herbs.webp',
  'Nápoje': './food-categories/beverages.webp',
}

// Orientační hodnoty pro běžné syrové nebo suché suroviny. Konkrétní výrobek se může lišit.
const groups: SeedGroup[] = [
  group('Zelenina', 1000, n(31, 6, 3, 0.3, 1.5, 2.4), ['Mrkev', 'Petržel kořen', 'Celer bulva', 'Pastinák', 'Červená řepa']),
  group('Zelenina', 1000, n(25, 4, 2.5, 0.3, 1.5, 2), ['Rajče', 'Paprika červená', 'Paprika zelená', 'Cuketa', 'Lilek']),
  group('Zelenina', 1000, n(30, 5, 2, 0.3, 2.4, 2.6), ['Brokolice', 'Květák', 'Kapusta', 'Zelí bílé', 'Zelí červené']),
  group('Zelenina', 500, n(23, 4, 2, 0.2, 1.8, 2.2), ['Špenát', 'Mangold', 'Hlávkový salát', 'Polníček', 'Rukola']),
  group('Zelenina', 1000, n(39, 8, 3.5, 0.2, 1.6, 2.1), ['Cibule', 'Červená cibule', 'Pórek', 'Česnek', 'Jarní cibulka']),
  group('Zelenina', 1000, n(45, 9, 3, 0.4, 2.5, 3.5), ['Dýně Hokkaido', 'Máslová dýně', 'Kedlubna', 'Ředkvička', 'Fenykl']),

  group('Ovoce', 1000, n(50, 13, 10, 0.3, 0.5, 2.3), ['Jablko', 'Hruška', 'Kdoule', 'Broskev', 'Nektarinka']),
  group('Ovoce', 1000, n(48, 12, 9, 0.3, 0.8, 1.8), ['Pomeranč', 'Mandarinka', 'Grapefruit', 'Citron', 'Limetka']),
  group('Ovoce', 1000, n(72, 18, 13, 0.4, 1, 2.2), ['Banán', 'Mango', 'Ananas', 'Papája', 'Kaki']),
  group('Ovoce', 500, n(45, 10, 7, 0.4, 0.8, 4), ['Jahody', 'Maliny', 'Borůvky', 'Ostružiny', 'Rybíz červený']),
  group('Ovoce', 1000, n(55, 14, 11, 0.3, 0.7, 2), ['Švestky', 'Třešně', 'Višně', 'Meruňky', 'Hroznové víno']),
  group('Ovoce', 500, n(70, 16, 12, 0.8, 1.2, 4), ['Granátové jablko', 'Kiwi', 'Fíky čerstvé', 'Datle čerstvé', 'Meloun vodní']),

  group('Maso', 500, n(120, 0, 0, 2.5, 23, 0), ['Kuřecí prsa', 'Krůtí prsa', 'Králičí hřbet', 'Kuřecí stehno bez kůže', 'Krůtí stehno']),
  group('Maso', 500, n(180, 0, 0, 10, 20, 0), ['Vepřová kýta', 'Vepřová pečeně', 'Vepřová panenka', 'Vepřová plec', 'Vepřové mleté maso']),
  group('Maso', 500, n(170, 0, 0, 9, 21, 0), ['Hovězí zadní', 'Hovězí roštěná', 'Hovězí kližka', 'Hovězí svíčková', 'Hovězí mleté maso']),
  group('Maso', 500, n(190, 0, 0, 12, 19, 0), ['Telecí kýta', 'Jehněčí kýta', 'Jehněčí plec', 'Kachní prsa', 'Husí prsa']),
  group('Maso', 500, n(135, 2, 0, 5, 20, 0), ['Kuřecí játra', 'Hovězí játra', 'Vepřová játra', 'Hovězí srdce', 'Hovězí jazyk']),

  group('Ryby a mořské plody', 500, n(115, 0, 0, 3, 22, 0), ['Treska', 'Štikozubec', 'Candát', 'Pstruh', 'Tilápie']),
  group('Ryby a mořské plody', 500, n(205, 0, 0, 13, 21, 0), ['Losos', 'Makrela', 'Sardinky', 'Sleď', 'Tuňák čerstvý']),
  group('Ryby a mořské plody', 500, n(90, 2, 0, 1.5, 18, 0), ['Krevety', 'Slávky', 'Kalamáry', 'Chobotnice', 'Krabí maso']),
  group('Ryby a mořské plody', 500, n(120, 0, 0, 4, 21, 0), ['Kapr', 'Sumec', 'Mořský vlk', 'Pražma', 'Platýs']),

  group('Mléčné výrobky', 1000, n(61, 4.8, 4.8, 3.3, 3.2, 0), ['Plnotučné mléko', 'Polotučné mléko', 'Kozí mléko', 'Kefír', 'Podmáslí']),
  group('Mléčné výrobky', 500, n(85, 4, 4, 4.5, 7, 0), ['Bílý jogurt', 'Řecký jogurt', 'Skyr', 'Zakysaná smetana', 'Tvaroh polotučný']),
  group('Mléčné výrobky', 250, n(330, 1.5, 0.5, 26, 24, 0), ['Eidam', 'Gouda', 'Čedar', 'Ementál', 'Parmezán']),
  group('Mléčné výrobky', 250, n(260, 3, 2, 20, 18, 0), ['Mozzarella', 'Balkánský sýr', 'Feta', 'Ricotta', 'Cottage']),
  group('Mléčné výrobky', 250, n(470, 1, 1, 50, 1, 0), ['Máslo', 'Přepuštěné máslo', 'Smetana ke šlehání', 'Smetana na vaření', 'Mascarpone']),

  group('Vejce', 600, n(143, 0.7, 0.4, 9.5, 13, 0), ['Slepičí vejce', 'Křepelčí vejce', 'Kachní vejce', 'Vaječný bílek', 'Vaječný žloutek']),

  group('Luštěniny', 500, n(335, 58, 3, 1.5, 23, 16), ['Čočka hnědá', 'Čočka červená', 'Čočka zelená', 'Hrách žlutý', 'Hrách zelený']),
  group('Luštěniny', 500, n(340, 58, 5, 3, 21, 15), ['Fazole bílé', 'Fazole červené', 'Fazole černé', 'Fazole mungo', 'Cizrna']),
  group('Luštěniny', 500, n(410, 30, 7, 20, 36, 9), ['Sójové boby', 'Edamame', 'Lupina', 'Arašídy', 'Tempeh']),

  group('Obiloviny a přílohy', 1000, n(355, 77, 0.5, 1, 8, 2), ['Rýže dlouhozrnná', 'Rýže jasmínová', 'Rýže basmati', 'Rýže arborio', 'Rýže parboiled']),
  group('Obiloviny a přílohy', 1000, n(350, 70, 2, 2.5, 12, 9), ['Rýže natural', 'Bulgur', 'Kuskus', 'Pohanka', 'Jáhly']),
  group('Obiloviny a přílohy', 500, n(355, 72, 3, 2, 12, 4), ['Těstoviny špagety', 'Těstoviny penne', 'Těstoviny fusilli', 'Nudle vaječné', 'Lasagne pláty']),
  group('Obiloviny a přílohy', 500, n(370, 62, 1, 7, 14, 10), ['Ovesné vločky', 'Žitné vločky', 'Ječné kroupy', 'Quinoa', 'Amarant']),
  group('Obiloviny a přílohy', 1000, n(80, 18, 1, 0.2, 2, 2), ['Brambory', 'Batáty', 'Polenta vařená', 'Gnocchi', 'Bramborové noky']),

  group('Mouky a pečení', 1000, n(350, 72, 1, 1.5, 11, 4), ['Pšeničná mouka hladká', 'Pšeničná mouka polohrubá', 'Pšeničná mouka hrubá', 'Celozrnná pšeničná mouka', 'Žitná mouka']),
  group('Mouky a pečení', 500, n(370, 75, 2, 3, 8, 6), ['Špaldová mouka', 'Kukuřičná mouka', 'Rýžová mouka', 'Pohanková mouka', 'Mandlová mouka']),
  group('Mouky a pečení', 250, n(300, 70, 1, 1, 5, 2), ['Kukuřičný škrob', 'Bramborový škrob', 'Kypřicí prášek', 'Jedlá soda', 'Sušené droždí']),

  group('Pečivo', 500, n(260, 50, 4, 3, 9, 4), ['Chléb konzumní', 'Chléb žitný', 'Chléb celozrnný', 'Bageta', 'Toastový chléb']),
  group('Pečivo', 300, n(290, 54, 5, 4, 9, 3), ['Rohlík', 'Houska', 'Kaiserka', 'Ciabatta', 'Pita chléb']),
  group('Pečivo', 300, n(315, 48, 7, 10, 8, 3), ['Tortilla pšeničná', 'Tortilla kukuřičná', 'Knäckebrot', 'Strouhanka', 'Krekry']),

  group('Ořechy a semínka', 250, n(620, 16, 4, 55, 20, 9), ['Mandle', 'Vlašské ořechy', 'Lískové ořechy', 'Kešu', 'Pistácie']),
  group('Ořechy a semínka', 250, n(570, 18, 2, 46, 23, 15), ['Slunečnicová semínka', 'Dýňová semínka', 'Sezam', 'Lněné semínko', 'Chia semínka']),
  group('Ořechy a semínka', 250, n(600, 17, 4, 52, 20, 10), ['Pekanové ořechy', 'Para ořechy', 'Makadamové ořechy', 'Kokos strouhaný', 'Mák']),

  group('Tuky a oleje', 750, n(884, 0, 0, 100, 0, 0), ['Olivový olej', 'Řepkový olej', 'Slunečnicový olej', 'Kokosový olej', 'Sezamový olej']),
  group('Tuky a oleje', 500, n(720, 1, 0, 80, 0.5, 0), ['Sádlo', 'Husí sádlo', 'Margarín', 'Majonéza', 'Tahini']),

  group('Koření a bylinky', 50, n(250, 45, 3, 5, 10, 25), ['Pepř černý', 'Paprika sladká', 'Paprika uzená', 'Kari koření', 'Kurkuma']),
  group('Koření a bylinky', 30, n(260, 40, 2, 6, 12, 30), ['Kmín', 'Koriandr', 'Římský kmín', 'Skořice', 'Muškátový oříšek']),
  group('Koření a bylinky', 30, n(250, 40, 4, 5, 11, 28), ['Oregano', 'Bazalka sušená', 'Tymián', 'Rozmarýn', 'Majoránka']),
  group('Koření a bylinky', 100, n(20, 3, 1, 0.4, 2, 2), ['Petrželová nať', 'Pažitka', 'Kopr', 'Koriandrová nať', 'Máta']),

  group('Konzervy', 400, n(85, 14, 4, 0.5, 4, 4), ['Rajčata krájená konzervovaná', 'Rajčatový protlak', 'Kukuřice sterilovaná', 'Hrášek sterilovaný', 'Žampiony sterilované']),
  group('Konzervy', 400, n(120, 18, 2, 2, 7, 5), ['Fazole v konzervě', 'Cizrna v konzervě', 'Čočka v konzervě', 'Kysané zelí', 'Okurky sterilované']),
  group('Konzervy', 160, n(180, 1, 0, 10, 22, 0), ['Tuňák ve vlastní šťávě', 'Tuňák v oleji', 'Sardinky v konzervě', 'Makrela v konzervě', 'Ančovičky']),

  group('Dochucovadla', 500, n(60, 12, 8, 0.5, 3, 1), ['Kečup', 'Hořčice plnotučná', 'Dijonská hořčice', 'Sójová omáčka', 'Worcestrová omáčka']),
  group('Dochucovadla', 500, n(180, 42, 38, 0, 1, 0), ['Med', 'Javorový sirup', 'Třtinový cukr', 'Bílý cukr', 'Moučkový cukr']),
  group('Dochucovadla', 500, n(40, 8, 4, 0, 0.5, 0), ['Ocet kvasný', 'Jablečný ocet', 'Balzamikový ocet', 'Citronová šťáva', 'Kokosové mléko']),

  group('Nápoje', 1000, n(1, 0, 0, 0, 0, 0), ['Pitná voda', 'Minerální voda', 'Sodová voda', 'Černý čaj', 'Zelený čaj']),
  group('Nápoje', 1000, n(42, 10, 9, 0.2, 0.5, 0.2), ['Pomerančový džus', 'Jablečný džus', 'Rajčatová šťáva', 'Kokosová voda', 'Ovesný nápoj']),
]

const SEEDED_AT = '2026-07-17T00:00:00.000Z'

export const stapleFoodProducts: FoodProduct[] = groups.flatMap((seedGroup, groupIndex) => seedGroup.names.map((name, itemIndex) => ({
  id: `staple-v${FOOD_CATALOG_SEED_VERSION}-${groupIndex + 1}-${itemIndex + 1}`,
  name,
  ean: '',
  image: categoryImages[seedGroup.category] ?? '',
  nutritionPer100g: { ...seedGroup.nutrition },
  packageGrams: seedGroup.packageGrams,
  category: seedGroup.category,
  notes: 'Základní surovina · orientační výživové hodnoty na 100 g',
  source: 'local',
  createdAt: SEEDED_AT,
  updatedAt: SEEDED_AT,
})))
