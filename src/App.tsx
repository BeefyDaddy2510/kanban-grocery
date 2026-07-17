import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react'
import type { IScannerControls } from '@zxing/browser'
import {
  AlertTriangle, Archive, ArrowRight, CalendarDays, Check, CheckCircle2, ChefHat, ExternalLink,
  ChevronRight, CircleDollarSign, ClipboardList, Clock3, Euro, Fish, LayoutDashboard,
  ListChecks, Menu, Minus, Moon, Package, Pencil, Plus, Scale, ScanLine, Search, ShoppingBasket,
  QrCode, Settings, Snowflake, Sun, Trash2, X,
} from 'lucide-react'
import { freezerGuide, initialData } from './data'
import { FOOD_CATALOG_SEED_VERSION, stapleFoodProducts } from './foodCatalog'
import { languages, useI18n, type Language } from './i18n'
import { findProductByEan, ProductCatalogPage, ProductEditorDialog, ProductScanResultDialog, toFoodProduct, upsertFoodProduct, type ProductAction, type ProductDraft } from './products'
import { WeightTrackingPage } from './weight'
import { parseIngredientGrams, resolveIngredientNutrition } from './nutrition'
import type { AccentColor, AppData, Currency, FoodProduct, FreezerItem, NutritionPer100g, PantryItem, Recipe, RecipeIngredient, ShoppingItem, SiteSettings, Todo, Unit } from './types'

type Page = 'dashboard' | 'products' | 'weight' | 'pantry' | 'freezer' | 'shopping' | 'recipes' | 'todos' | 'settings'
type ModalKind = 'pantry' | 'freezer' | 'shopping' | 'todo' | 'scanner' | 'recipe' | null
type SyncStatus = 'loading' | 'saving' | 'synced' | 'error'
type CentralStateEnvelope = {
  state: { data: AppData; settings: SiteSettings } | null
  revision: number
  updatedAt: string | null
}

const STORE_KEY = 'domovka-data-v1'
const SETTINGS_KEY = 'grocy-homie-settings-v1'
const STATE_API_URL = new URL('api/state', document.baseURI).toString()
const APP_ICON_URL = new URL('app-icon.png', document.baseURI).toString()
const normalizeNutrition = (value?: Partial<NutritionPer100g>): NutritionPer100g => ({ kcal: Number(value?.kcal) || 0, carbs: Number(value?.carbs) || 0, sugars: Number(value?.sugars) || 0, fat: Number(value?.fat) || 0, protein: Number(value?.protein) || 0, fiber: Number(value?.fiber) || 0 })
const normalizeData = (value: AppData): AppData => {
  const needsCatalogMigration = (value.foodCatalogSeedVersion ?? 0) < FOOD_CATALOG_SEED_VERSION
  const seedByName = new Map(stapleFoodProducts.map(product => [product.name.toLocaleLowerCase('cs-CZ'), product]))
  const storedProducts = Array.isArray(value.products) ? value.products.map(product => {
    const normalized = { ...product, ean: product.ean || '', image: product.image || '', nutritionPer100g: normalizeNutrition(product.nutritionPer100g) }
    const seed = seedByName.get(product.name.trim().toLocaleLowerCase('cs-CZ'))
    const shouldReplaceSeedImage = needsCatalogMigration && seed?.image && (!normalized.image || normalized.image.startsWith('./food-categories/'))
    return shouldReplaceSeedImage ? { ...normalized, image: seed.image, imageSourceUrl: seed.imageSourceUrl, imageSourceTitle: seed.imageSourceTitle, imageCreator: seed.imageCreator, imageLicense: seed.imageLicense, imageLicenseUrl: seed.imageLicenseUrl } : normalized
  }) : []
  const knownNames = new Set(storedProducts.map(product => product.name.trim().toLocaleLowerCase('cs-CZ')))
  const products = needsCatalogMigration ? [...storedProducts, ...stapleFoodProducts.filter(product => !knownNames.has(product.name.toLocaleLowerCase('cs-CZ')))] : storedProducts
  return {
    ...initialData,
    ...value,
    foodCatalogSeedVersion: FOOD_CATALOG_SEED_VERSION,
    products,
    pantry: Array.isArray(value.pantry) ? value.pantry.map(item => ({ ...item, nutritionPer100g: item.nutritionPer100g ? normalizeNutrition(item.nutritionPer100g) : undefined })) : [],
    weightProfiles: Array.isArray(value.weightProfiles) ? value.weightProfiles.map(profile => ({ ...profile, dailyTargets: normalizeNutrition(profile.dailyTargets), weightEntries: Array.isArray(profile.weightEntries) ? profile.weightEntries : [] })) : [],
    mealEntries: Array.isArray(value.mealEntries) ? value.mealEntries.map(entry => ({ ...entry, nutritionPer100g: normalizeNutrition(entry.nutritionPer100g) })) : [],
  }
}
const defaultSettings: SiteSettings = {
  householdName: 'Domácnost Novákových', language: 'cs', theme: 'system', accent: 'coral', customAccent: '', defaultCurrency: 'CZK',
  categories: ['Konzervy', 'Přílohy', 'Mléčné výrobky', 'Maso', 'Ryby', 'Ovoce', 'Zelenina', 'Pečivo', 'Nápoje', 'Koření', 'Vaření', 'Dětské', 'Drogerie', 'Ostatní'],
  locations: ['Spíž', 'Lednice', 'Koupelna', 'Drogerie'], defaultLocation: 'Spíž', defaultCategory: 'Ostatní', defaultUnit: 'ks', defaultQuantity: 1, defaultMinimum: 1,
}
const accentColors: Record<AccentColor, { labelKey: string; value: string; dark: string }> = {
  coral: { labelKey: 'accent.coral', value: '#e9694b', dark: '#c9543b' },
  green: { labelKey: 'accent.green', value: '#668b70', dark: '#4d7057' },
  blue: { labelKey: 'accent.blue', value: '#5f93ab', dark: '#477b92' },
  plum: { labelKey: 'accent.plum', value: '#8a668f', dark: '#6e5073' },
}
const NAV: { page: Page; labelKey: string; icon: typeof Package }[] = [
  { page: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard }, { page: 'products', labelKey: 'nav.products', icon: Archive }, { page: 'weight', labelKey: 'nav.weight', icon: Scale }, { page: 'pantry', labelKey: 'nav.pantry', icon: Package },
  { page: 'freezer', labelKey: 'nav.freezer', icon: Snowflake }, { page: 'shopping', labelKey: 'nav.shopping', icon: ShoppingBasket },
  { page: 'recipes', labelKey: 'nav.recipes', icon: ChefHat }, { page: 'todos', labelKey: 'nav.todos', icon: ListChecks }, { page: 'settings', labelKey: 'nav.settings', icon: Settings },
]
const units: Unit[] = ['ks', 'bal.', 'kg', 'g', 'l', 'ml']
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
const today = () => new Date().toISOString().slice(0, 10)
const formatDate = (value: string | undefined, locale: string) => value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : '—'
const daysBetween = (from: string, to: string) => Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000)
const householdInitials = (name: string) => name.replace(/^(domácnost|household|haushalt)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'GH'

async function readCentralState(signal?: AbortSignal) {
  const response = await fetch(STATE_API_URL, { cache: 'no-store', signal })
  if (!response.ok) throw new Error(`Central storage returned ${response.status}`)
  return response.json() as Promise<CentralStateEnvelope>
}

async function writeCentralState(data: AppData, settings: SiteSettings, signal?: AbortSignal) {
  const response = await fetch(STATE_API_URL, {
    method: 'PUT',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: { data, settings } }),
    signal,
  })
  if (!response.ok) throw new Error(`Central storage returned ${response.status}`)
  return response.json() as Promise<CentralStateEnvelope>
}

const prepareThumbnail = (file: File, errors: { read: string; format: string }) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(new Error(errors.read))
  reader.onload = () => {
    const image = new Image()
    image.onerror = () => reject(new Error(errors.format))
    image.onload = () => {
      const size = 360
      const scale = Math.min(1, size / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', .78))
    }
    image.src = String(reader.result)
  }
  reader.readAsDataURL(file)
})

function App() {
  const { language, locale, setLanguage, t } = useI18n()
  const [page, setPage] = useState<Page>('dashboard')
  const [data, setData] = useState<AppData>(() => {
    try { return normalizeData(JSON.parse(localStorage.getItem(STORE_KEY) || '') as AppData) } catch { return initialData }
  })
  const [settings, setSettings] = useState<SiteSettings>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '') as Partial<SiteSettings>
      return { ...defaultSettings, ...saved, categories: saved.categories?.length ? saved.categories : defaultSettings.categories, locations: saved.locations?.length ? saved.locations : defaultSettings.locations }
    }
    catch { return { ...defaultSettings, theme: localStorage.getItem('domovka-theme') === 'dark' ? 'dark' : 'system' } }
  })
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)
  const [currency, setCurrency] = useState<Currency>(settings.defaultCurrency)
  const [rate, setRate] = useState(24.284)
  const [rateDate, setRateDate] = useState('14. 7. 2026')
  const [modal, setModal] = useState<ModalKind>(null)
  const [editingPantry, setEditingPantry] = useState<PantryItem | null>(null)
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null)
  const [productEditor, setProductEditor] = useState<FoodProduct | 'new' | null>(null)
  const [scannedEan, setScannedEan] = useState('')
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState<FoodProduct | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [storageReady, setStorageReady] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading')
  const revisionRef = useRef(0)
  const skipNextSaveRef = useRef(false)
  const dirtyRef = useRef(false)
  const writeInFlightRef = useRef(false)
  const changeLanguage = (next: Language) => { setLanguage(next); setSettings(current => ({ ...current, language: next })) }
  const cycleLanguage = () => { const index = languages.findIndex(item => item.value === language); changeLanguage(languages[(index + 1) % languages.length].value) }

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const remote = await readCentralState(controller.signal)
        if (remote.state) {
          const remoteSettings = {
            ...defaultSettings,
            ...remote.state.settings,
            categories: remote.state.settings.categories?.length ? remote.state.settings.categories : defaultSettings.categories,
            locations: remote.state.settings.locations?.length ? remote.state.settings.locations : defaultSettings.locations,
          }
          const normalizedData = normalizeData(remote.state.data)
          const needsCatalogSeed = (remote.state.data.foodCatalogSeedVersion ?? 0) < FOOD_CATALOG_SEED_VERSION
          skipNextSaveRef.current = true
          setData(normalizedData)
          setSettings(remoteSettings)
          setLanguage(remoteSettings.language)
          setCurrency(remoteSettings.defaultCurrency)
          if (needsCatalogSeed) {
            const migrated = await writeCentralState(normalizedData, remoteSettings, controller.signal)
            revisionRef.current = migrated.revision
          } else {
            revisionRef.current = remote.revision
          }
        } else {
          // The first browser opened after upgrading seeds Home Assistant storage
          // with its existing local data. Further browsers always receive this copy.
          const migrated = await writeCentralState(data, settings, controller.signal)
          revisionRef.current = migrated.revision
          skipNextSaveRef.current = true
        }
        setSyncStatus('synced')
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Unable to load Home Assistant storage', error)
        setSyncStatus('error')
      } finally {
        if (!controller.signal.aborted) setStorageReady(true)
      }
    }
    void load()
    return () => controller.abort()
    // This is intentionally a one-time migration/load with the initial local snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(data))
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    if (!storageReady) return
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false
      dirtyRef.current = false
      return
    }

    dirtyRef.current = true
    setSyncStatus('saving')
    const controller = new AbortController()
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const persist = async () => {
      writeInFlightRef.current = true
      try {
        const saved = await writeCentralState(data, settings, controller.signal)
        revisionRef.current = saved.revision
        dirtyRef.current = false
        setSyncStatus('synced')
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('Unable to save Home Assistant storage', error)
        setSyncStatus('error')
        retryTimer = setTimeout(() => void persist(), 5000)
      } finally {
        writeInFlightRef.current = false
      }
    }
    const saveTimer = setTimeout(() => void persist(), 350)
    return () => {
      controller.abort()
      clearTimeout(saveTimer)
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [data, settings, storageReady])

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    const accent = accentColors[settings.accent]
    document.documentElement.style.setProperty('--brand', settings.customAccent || accent.value)
    document.documentElement.style.setProperty('--brand-dark', settings.customAccent || accent.dark)
  }, [dark, settings])
  useEffect(() => {
    if (!storageReady) return
    let cancelled = false
    const refresh = async () => {
      if (dirtyRef.current || writeInFlightRef.current || document.hidden) return
      try {
        const remote = await readCentralState()
        if (!cancelled && remote.state && remote.revision > revisionRef.current) {
          const remoteSettings = { ...defaultSettings, ...remote.state.settings }
          skipNextSaveRef.current = true
          revisionRef.current = remote.revision
          setData(normalizeData(remote.state.data))
          setSettings(remoteSettings)
          setLanguage(remoteSettings.language)
          setCurrency(remoteSettings.defaultCurrency)
          setSyncStatus('synced')
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Unable to refresh Home Assistant storage', error)
          setSyncStatus('error')
        }
      }
    }
    const timer = setInterval(() => void refresh(), 3000)
    const visibility = () => { if (!document.hidden) void refresh() }
    document.addEventListener('visibilitychange', visibility)
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', visibility) }
  }, [setLanguage, storageReady])
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const change = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', change); return () => media.removeEventListener('change', change)
  }, [])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true) }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown)
  }, [])
  useEffect(() => {
    fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml')
      .then(r => r.text()).then(xml => {
        const doc = new DOMParser().parseFromString(xml, 'application/xml')
        const czk = doc.querySelector('Cube[currency="CZK"]')?.getAttribute('rate')
        const date = doc.querySelector('Cube[time]')?.getAttribute('time')
        if (czk) setRate(Number(czk))
        if (date) setRateDate(formatDate(date, locale))
      }).catch(() => undefined)
  }, [locale])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2600); return () => clearTimeout(timer) }, [toast])

  if (!storageReady) return <div className="storage-gate"><span className="storage-spinner" /><strong>Grocy Homie</strong><p>{t('sync.loading')}</p></div>

  const money = (czk: number) => new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: currency === 'CZK' ? 0 : 2 }).format(currency === 'CZK' ? czk : czk / rate)
  const lowItems = data.pantry.filter(i => i.quantity < i.minimum)
  const expiringItems = data.pantry.filter(i => i.expiresAt && daysBetween(today(), i.expiresAt) <= 7 && daysBetween(today(), i.expiresAt) >= 0)
  const freezerWarnings = data.freezer.filter(i => freezerProgress(i) >= 90)
  const pendingShopping = data.shoppingLists.filter(l => !l.archived).flatMap(l => l.items).filter(i => !i.checked).length
  const inventoryValue = data.pantry.reduce((sum, item) => sum + item.priceCzk * item.quantity, 0)

  const updatePantry = (id: string, delta: number) => setData(prev => ({ ...prev, pantry: prev.pantry.map(i => i.id === id ? { ...i, quantity: Math.max(0, +(i.quantity + delta).toFixed(2)) } : i) }))
  const setPantryPortion = (id: string, grams: number) => setData(prev => ({ ...prev, pantry: prev.pantry.map(i => i.id === id ? { ...i, portionGrams: Math.max(0, grams) } : i) }))
  const removePantry = (id: string) => setData(prev => ({ ...prev, pantry: prev.pantry.filter(i => i.id !== id) }))
  const toggleTodo = (id: string) => setData(prev => ({ ...prev, todos: prev.todos.map(t => t.id === id ? { ...t, done: !t.done } : t) }))
  const notify = (text: string) => setToast(text)
  const go = (target: Page) => { setPage(target); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const closeModal = () => { setModal(null); setEditingPantry(null); setEditingRecipe(null) }
  const saveProduct = (draft: ProductDraft, existing?: FoodProduct) => {
    const product = toFoodProduct(draft, existing ?? findProductByEan(data.products, draft.ean))
    setData(current => ({ ...current, products: upsertFoodProduct(current.products, product) }))
    setProductEditor(null)
    notify(existing ? 'Potravina byla upravena.' : 'Potravina byla uložena do databáze.')
  }
  const productAction = (action: ProductAction) => {
    const existing = data.products.find(item => item.id === action.existingId) ?? findProductByEan(data.products, action.product.ean)
    const stored = existing ? toFoodProduct(action.product, existing) : toFoodProduct(action.product)
    const productId = existing?.id ?? (action.saveToCatalog ? stored.id : undefined)
    setData(current => {
      const next: AppData = { ...current }
      if (action.saveToCatalog) next.products = upsertFoodProduct(current.products, stored)
      if (action.destination === 'pantry') {
        const item: PantryItem = { id: uid(), name: action.product.name, category: action.product.category || settings.defaultCategory, location: action.location || settings.defaultLocation, quantity: action.quantity, minimum: settings.defaultMinimum, unit: action.unit, priceCzk: action.product.priceCzk || 0, purchasedAt: today(), barcode: action.product.ean, image: action.product.image, nutritionPer100g: action.product.nutritionPer100g, portionGrams: action.product.packageGrams || 100, productId }
        next.pantry = [item, ...current.pantry]
      } else if (action.destination === 'freezer') {
        const guide = freezerGuide.find(item => item.category === action.product.category)
        const item: FreezerItem = { id: uid(), name: action.product.name, category: action.product.category || 'Ostatní', quantity: action.quantity, unit: action.unit, frozenAt: today(), recommendedMonths: guide?.max ?? 6, productId, barcode: action.product.ean, image: action.product.image }
        next.freezer = [item, ...current.freezer]
      } else {
        const item: ShoppingItem = { id: uid(), name: action.product.name, quantity: action.quantity, unit: action.unit, checked: false, priceCzk: action.product.priceCzk || undefined, addToPantry: true, kanbanMinimum: settings.defaultMinimum, productId, barcode: action.product.ean, image: action.product.image }
        next.shoppingLists = current.shoppingLists.map(list => list.id === action.listId ? { ...list, items: [...list.items, item] } : list)
      }
      return next
    })
    setScannedEan('')
    setSelectedCatalogProduct(null)
    notify(action.destination === 'pantry' ? 'Potravina byla přidána do zásob.' : action.destination === 'freezer' ? 'Potravina byla přidána do mrazáku.' : 'Potravina byla přidána na nákupní seznam.')
  }

  const pageContent: Record<Page, ReactNode> = {
    dashboard: <Dashboard data={data} lowItems={lowItems} expiringItems={expiringItems} freezerWarnings={freezerWarnings} pendingShopping={pendingShopping} inventoryValue={inventoryValue} money={money} go={go} updatePantry={updatePantry} toggleTodo={toggleTodo} />,
    products: <ProductCatalogPage products={data.products} onAdd={() => setProductEditor('new')} onEdit={setProductEditor} onDelete={id => setData(current => ({ ...current, products: current.products.filter(product => product.id !== id) }))} onUse={product => { setSelectedCatalogProduct(product); setScannedEan(product.ean) }} onScan={() => setModal('scanner')} />,
    weight: <WeightTrackingPage data={data} setData={setData} notify={notify} />,
    pantry: <Pantry data={data} money={money} update={updatePantry} setPortion={setPantryPortion} remove={removePantry} open={() => { setEditingPantry(null); setModal('pantry') }} edit={item => { setEditingPantry(item); setModal('pantry') }} />,
    freezer: <Freezer data={data} setData={setData} open={() => setModal('freezer')} />,
    shopping: <Shopping data={data} setData={setData} money={money} open={setModal} notify={notify} />,
    recipes: <Recipes data={data} setData={setData} notify={notify} go={go} open={() => { setEditingRecipe(null); setModal('recipe') }} edit={recipe => { setEditingRecipe(recipe); setModal('recipe') }} />,
    todos: <Todos data={data} setData={setData} toggle={toggleTodo} open={() => setModal('todo')} />,
    settings: <SettingsPage settings={settings} setSettings={setSettings} setCurrency={setCurrency} notify={notify} changeLanguage={changeLanguage} />,
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}>
      <button className="mobile-close icon-btn" onClick={() => setMobileNav(false)} aria-label={t('app.closeMenu')}><X size={20} /></button>
      <button className="brand" onClick={() => go('dashboard')}><span className="brand-mark"><img src={APP_ICON_URL} alt="" /></span><span>Grocy Homie<small>{t('brand.tagline')}</small></span></button>
      <nav>{NAV.map(({ page: target, labelKey, icon: Icon }) => <button key={target} className={page === target ? 'active' : ''} onClick={() => go(target)}><Icon size={19} /><span>{t(labelKey)}</span>{target === 'pantry' && lowItems.length > 0 && <b>{lowItems.length}</b>}</button>)}</nav>
      <div className="sidebar-card"><div className="sidebar-card-icon"><Archive size={18} /></div><div><strong>{t('common.items', { count: data.pantry.length + data.freezer.length })}</strong><span>{t('app.householdItems')}</span></div></div>
      <div className="sidebar-foot"><button className="currency-toggle" onClick={() => setCurrency(currency === 'CZK' ? 'EUR' : 'CZK')}><Euro size={17} /><span>{currency}</span><small>1 EUR = {rate.toFixed(3)} Kč</small></button><button className="icon-btn" onClick={() => setSettings(s => ({ ...s, theme: dark ? 'light' : 'dark' }))} aria-label={t('app.switchTheme')}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button></div>
    </aside>
    {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} />}
    <main>
      <header className="topbar"><button className="menu-btn icon-btn" onClick={() => setMobileNav(true)}><Menu size={21} /></button><div><span className="eyebrow">{settings.householdName}</span><h1>{t(NAV.find(item => item.page === page)?.labelKey ?? 'nav.dashboard')}</h1></div><div className="top-actions"><span className={`sync-status ${syncStatus}`} title={t(`sync.${syncStatus}`)}><i />{t(`sync.${syncStatus}`)}</span><button className="search-button" onClick={() => setSearchOpen(true)}><Search size={18} /><span>{t('common.search')}</span><kbd>⌘ K</kbd></button><button className="top-scan-button" onClick={() => setModal('scanner')}><QrCode size={18} /><span>SCAN</span></button><button className="language-toggle" onClick={cycleLanguage} aria-label={t('app.changeLanguage')} title={t('app.changeLanguage')}>{languages.find(item => item.value === language)?.short}</button><button className="avatar">{householdInitials(settings.householdName)}</button></div></header>
      <div className="page-content">{pageContent[page]}</div>
      <footer>Grocy Homie · {t('app.ecbRate', { date: rateDate })} · {t('app.localData')}</footer>
    </main>
    {modal && <Modal kind={modal} close={closeModal} data={data} setData={setData} notify={notify} settings={settings} editingPantry={editingPantry} editingRecipe={editingRecipe} onScanned={code => { const ean = code.replace(/\D/g, ''); if (ean.length < 8 || ean.length > 14) { notify('Naskenovaný kód není platný EAN/GTIN.'); return } setScannedEan(ean); closeModal() }} />}
    {productEditor && <ProductEditorDialog initial={productEditor === 'new' ? undefined : productEditor} close={() => setProductEditor(null)} save={saveProduct} />}
    {(scannedEan || selectedCatalogProduct) && <ProductScanResultDialog ean={scannedEan} localProduct={selectedCatalogProduct ?? undefined} products={data.products} settings={settings} shoppingLists={data.shoppingLists} close={() => { setScannedEan(''); setSelectedCatalogProduct(null) }} confirm={productAction} />}
    {searchOpen && <GlobalSearch data={data} close={() => setSearchOpen(false)} go={target => { setSearchOpen(false); go(target) }} />}
    {toast && <div className="toast"><CheckCircle2 size={19} />{toast}</div>}
  </div>
}

function GlobalSearch({ data, close, go }: { data: AppData; close: () => void; go: (page: Page) => void }) {
  const { locale, t } = useI18n()
  const [query, setQuery] = useState('')
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const results = useMemo(() => {
    const all: { id: string; page: Page; title: string; meta: string; search: string }[] = [
      ...data.products.map(product => ({ id: `db-${product.id}`, page: 'products' as Page, title: product.name, meta: [product.brand || 'Databáze potravin', product.ean ? `EAN ${product.ean}` : 'bez EAN'].join(' · '), search: [product.name, product.brand, product.ean, product.category, product.stores].join(' ') })),
      ...data.weightProfiles.map(profile => ({ id: `weight-${profile.id}`, page: 'weight' as Page, title: profile.name, meta: `Osobní karta · ${profile.currentWeightKg} kg`, search: `${profile.name} hmotnost váha` })),
      ...data.pantry.map(item => ({ id: `p-${item.id}`, page: 'pantry' as Page, title: item.name, meta: `${item.category} · ${item.location} · ${item.quantity} ${item.unit}`, search: [item.name, item.category, item.location, item.barcode].join(' ') })),
      ...data.freezer.map(item => ({ id: `f-${item.id}`, page: 'freezer' as Page, title: item.name, meta: `${item.category} · ${item.quantity} ${item.unit}`, search: [item.name, item.category, item.note].join(' ') })),
      ...data.shoppingLists.flatMap(list => list.items.map(item => ({ id: `s-${list.id}-${item.id}`, page: 'shopping' as Page, title: item.name, meta: `${list.name} · ${list.type}${list.archived ? ` · ${t('search.archive')}` : ''}`, search: [item.name, list.name, list.type].join(' ') }))),
      ...data.recipes.map(recipe => ({ id: `r-${recipe.id}`, page: 'recipes' as Page, title: recipe.name, meta: `${recipe.minutes} min · ${recipe.tags.join(', ')}`, search: [recipe.name, recipe.tags.join(' '), recipe.instructions, recipe.ingredients.map(i => i.name).join(' ')].join(' ') })),
      ...data.todos.map(todo => ({ id: `t-${todo.id}`, page: 'todos' as Page, title: todo.title, meta: `${todo.category} · ${formatDate(todo.date, locale)}`, search: [todo.title, todo.category].join(' ') })),
    ]
    const needle = normalize(query.trim())
    return needle ? all.filter(item => normalize(item.search).includes(needle)).slice(0, 40) : []
  }, [data, locale, query, t])
  return <div className="search-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><section className="global-search"><div className="global-search-input"><Search size={21} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={t('search.placeholder')} /><button className="icon-btn" onClick={close}><X size={18} /></button></div><div className="search-results">{!query.trim() ? <div className="search-empty"><Search size={28} /><strong>{t('search.title')}</strong><span>{t('search.hint')}</span></div> : results.length ? results.map(result => <button key={result.id} onClick={() => go(result.page)}><span className="search-result-icon"><Search size={16} /></span><span className="grow"><strong>{result.title}</strong><small>{result.meta}</small></span><span>{t(NAV.find(item => item.page === result.page)?.labelKey ?? 'nav.dashboard')}</span><ChevronRight size={17} /></button>) : <div className="search-empty"><Search size={28} /><strong>{t('search.none')}</strong><span>{t('search.noneHint')}</span></div>}</div><footer><span><kbd>Esc</kbd> {t('search.close')}</span><span>{results.length ? t('common.results', { count: results.length }) : 'Ctrl/⌘ + K'}</span></footer></section></div>
}

function SettingsPage({ settings, setSettings, setCurrency, notify, changeLanguage }: { settings: SiteSettings; setSettings: React.Dispatch<React.SetStateAction<SiteSettings>>; setCurrency: (currency: Currency) => void; notify: (text: string) => void; changeLanguage: (language: Language) => void }) {
  const { t } = useI18n()
  const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => setSettings(current => ({ ...current, [key]: value }))
  const reset = () => { setSettings(defaultSettings); setCurrency(defaultSettings.defaultCurrency); changeLanguage(defaultSettings.language); notify(t('settings.resetDone')) }
  return <><PageIntro title={t('settings.title')} subtitle={t('settings.subtitle')} button={t('settings.reset')} icon={<Settings />} onClick={reset} />
    <div className="settings-grid">
      <section className="settings-card"><div className="settings-card-head"><Settings size={20} /><div><h3>{t('settings.household')}</h3><p>{t('settings.householdHint')}</p></div></div><Field label={t('settings.householdName')}><input value={settings.householdName} onChange={event => update('householdName', event.target.value)} placeholder={t('settings.householdPlaceholder')} /></Field><Field label={t('settings.currency')}><select value={settings.defaultCurrency} onChange={event => { const value = event.target.value as Currency; update('defaultCurrency', value); setCurrency(value) }}><option value="CZK">{t('settings.czk')}</option><option value="EUR">{t('settings.eur')}</option></select></Field><Field label={t('settings.language')}><select value={settings.language} onChange={event => changeLanguage(event.target.value as Language)}>{languages.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></Field><div className="settings-note"><CheckCircle2 size={17} />{t('settings.languageHint')}</div></section>
      <section className="settings-card"><div className="settings-card-head"><Sun size={20} /><div><h3>{t('settings.appearance')}</h3><p>{t('settings.appearanceHint')}</p></div></div><span className="setting-label">{t('settings.theme')}</span><div className="theme-options">{([['system','settings.themeSystem'],['light','settings.themeLight'],['dark','settings.themeDark']] as const).map(([value, labelKey]) => <button key={value} className={settings.theme === value ? 'active' : ''} onClick={() => update('theme', value)}>{value === 'dark' ? <Moon size={17} /> : value === 'light' ? <Sun size={17} /> : <Settings size={17} />}{t(labelKey)}</button>)}</div><span className="setting-label">{t('settings.accent')}</span><div className="accent-options">{(Object.entries(accentColors) as [AccentColor, typeof accentColors[AccentColor]][]).map(([key, color]) => <button key={key} className={settings.accent === key && !settings.customAccent ? 'active' : ''} onClick={() => { update('accent', key); update('customAccent', '') }}><i style={{ background: color.value }} />{t(color.labelKey)}{settings.accent === key && !settings.customAccent && <Check size={14} />}</button>)}<label className={`color-picker ${settings.customAccent ? 'active' : ''}`}><input type="color" value={settings.customAccent || accentColors[settings.accent].value} onChange={event => update('customAccent', event.target.value)} /><i style={{ background: settings.customAccent || accentColors[settings.accent].value }} />{t('settings.customColor')}{settings.customAccent && <Check size={14} />}</label></div></section>
      <section className="settings-card span-2"><div className="settings-card-head"><Package size={20} /><div><h3>{t('settings.defaults')}</h3><p>{t('settings.defaultsHint')}</p></div></div><div className="settings-defaults"><Field label={t('settings.category')}><select value={settings.defaultCategory} onChange={event => update('defaultCategory', event.target.value)}>{settings.categories.map(category => <option key={category}>{category}</option>)}</select></Field><Field label={t('settings.location')}><select value={settings.defaultLocation} onChange={event => update('defaultLocation', event.target.value)}>{settings.locations.map(location => <option key={location}>{location}</option>)}</select></Field><Field label={t('settings.unit')}><select value={settings.defaultUnit} onChange={event => update('defaultUnit', event.target.value as Unit)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></Field><Field label={t('settings.quantity')}><input type="number" min="0" step="0.1" value={settings.defaultQuantity} onChange={event => update('defaultQuantity', Number(event.target.value))} /></Field><Field label={t('settings.minimum')}><input type="number" min="0" step="0.1" value={settings.defaultMinimum} onChange={event => update('defaultMinimum', Number(event.target.value))} /></Field></div><div className="settings-note"><CheckCircle2 size={17} />{t('settings.autoSave')}</div></section>
      <section className="settings-card span-2"><div className="settings-card-head"><Pencil size={20} /><div><h3>{t('settings.lists')}</h3><p>{t('settings.listsHint')}</p></div></div><div className="editable-lists"><EditableList title={t('settings.category')} values={settings.categories} placeholder={t('settings.newCategory')} onChange={values => { update('categories', values); if (!values.includes(settings.defaultCategory)) update('defaultCategory', values[0] ?? '') }} /><EditableList title={t('settings.location')} values={settings.locations} placeholder={t('settings.newLocation')} onChange={values => { update('locations', values); if (!values.includes(settings.defaultLocation)) update('defaultLocation', values[0] ?? '') }} /></div></section>
    </div>
  </>
}

function EditableList({ title, values, placeholder, onChange }: { title: string; values: string[]; placeholder: string; onChange: (values: string[]) => void }) {
  const { locale, t } = useI18n()
  const [value, setValue] = useState('')
  const add = () => { const clean = value.trim(); if (!clean || values.some(item => item.toLocaleLowerCase(locale) === clean.toLocaleLowerCase(locale))) return; onChange([...values, clean]); setValue('') }
  return <div className="editable-list"><strong>{title}</strong><div className="editable-tags">{values.map(item => <span key={item}>{item}<button onClick={() => onChange(values.filter(value => value !== item))} aria-label={`${t('common.delete')} ${item}`}><X size={12} /></button></span>)}</div><div className="editable-add"><input value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }} placeholder={placeholder} /><button className="secondary" onClick={add}><Plus size={15} />{t('common.add')}</button></div></div>
}

function Dashboard({ data, lowItems, expiringItems, freezerWarnings, pendingShopping, inventoryValue, money, go, updatePantry, toggleTodo }: {
  data: AppData; lowItems: PantryItem[]; expiringItems: PantryItem[]; freezerWarnings: FreezerItem[]; pendingShopping: number; inventoryValue: number; money: (n: number) => string; go: (p: Page) => void; updatePantry: (id: string, d: number) => void; toggleTodo: (id: string) => void
}) {
  const { locale, t } = useI18n()
  const todayTodos = data.todos.filter(t => t.date <= today() && !t.done)
  return <>
    <section className="welcome"><div><span className="eyebrow">{new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span><h2>{t('dashboard.greeting')}</h2><p>{lowItems.length ? t(lowItems.length === 1 ? 'dashboard.lowOne' : 'dashboard.lowMany', { count: lowItems.length }) : t('dashboard.stockGood')} {t('dashboard.calm')}</p></div><button className="primary" onClick={() => go('shopping')}><ShoppingBasket size={18} />{t('dashboard.openShopping')}</button></section>
    <section className="stats-grid">
      <Stat icon={<Package />} tone="coral" label={t('nav.pantry')} value={t('common.items', { count: data.pantry.length })} note={t('dashboard.belowMinimum', { count: lowItems.length })} warning={lowItems.length > 0} onClick={() => go('pantry')} />
      <Stat icon={<Snowflake />} tone="blue" label={t('nav.freezer')} value={t('common.items', { count: data.freezer.length })} note={t('dashboard.useSoon', { count: freezerWarnings.length })} warning={freezerWarnings.length > 0} onClick={() => go('freezer')} />
      <Stat icon={<ShoppingBasket />} tone="green" label={t('nav.shopping')} value={t('dashboard.remaining', { count: pendingShopping })} note={t('dashboard.activeLists', { count: data.shoppingLists.filter(list => !list.archived).length })} onClick={() => go('shopping')} />
      <Stat icon={<CircleDollarSign />} tone="gold" label={t('dashboard.stockValue')} value={money(inventoryValue)} note={t('dashboard.estimate')} />
    </section>
    {(lowItems.length > 0 || expiringItems.length > 0) && <section className="alert-strip"><AlertTriangle size={20} /><div><strong>{t('dashboard.attention')}</strong><span>{t('dashboard.attentionText', { low: lowItems.length, expiring: expiringItems.length })}</span></div><button onClick={() => go('pantry')}>{t('dashboard.check')} <ArrowRight size={16} /></button></section>}
    <div className="dashboard-grid">
      <section className="panel"><PanelHead title={t('dashboard.kanban')} subtitle={t('dashboard.kanbanHint')} action={t('dashboard.allStock')} onClick={() => go('pantry')} />
        <div className="compact-list">{lowItems.slice(0, 4).map(item => <div className="compact-row" key={item.id}><ProductIcon name={item.name} /><div className="grow"><strong>{item.name}</strong><span>{item.location} · {t('dashboard.minimum', { count: item.minimum, unit: item.unit })}</span></div><Quantity value={item.quantity} unit={item.unit} onMinus={() => updatePantry(item.id, -1)} onPlus={() => updatePantry(item.id, 1)} /></div>)}{!lowItems.length && <Empty text={t('dashboard.stockOk')} />}</div>
      </section>
      <section className="panel"><PanelHead title={t('dashboard.todayTasks')} subtitle={t('dashboard.waiting', { count: todayTodos.length })} action={t('dashboard.calendar')} onClick={() => go('todos')} />
        <div className="todo-mini">{data.todos.filter(t => !t.done).slice(0, 4).map(todo => <label key={todo.id}><input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo.id)} /><span className="custom-check"><Check size={14} /></span><span><strong>{todo.title}</strong><small>{formatDate(todo.date, locale)} · {todo.category}</small></span></label>)}{!todayTodos.length && <Empty text={t('dashboard.todayDone')} />}</div>
      </section>
      <section className="panel span-2"><PanelHead title={t('dashboard.activity')} subtitle={t('dashboard.activityHint')} />
        <div className="timeline">
          {freezerWarnings.slice(0, 2).map(i => <div key={i.id}><span className="timeline-icon blue"><Snowflake size={17} /></span><div><strong>{t('dashboard.freezerUse', { name: i.name })}</strong><small>{t('dashboard.inFreezerSince', { date: formatDate(i.frozenAt, locale), progress: Math.round(freezerProgress(i)) })}</small></div><button onClick={() => go('freezer')}><ChevronRight /></button></div>)}
          {expiringItems.slice(0, 2).map(i => <div key={i.id}><span className="timeline-icon coral"><Clock3 size={17} /></span><div><strong>{t('dashboard.expiring', { name: i.name })}</strong><small>{t('dashboard.useBy', { date: formatDate(i.expiresAt, locale) })}</small></div><button onClick={() => go('pantry')}><ChevronRight /></button></div>)}
          {!freezerWarnings.length && !expiringItems.length && <Empty text={t('dashboard.noDeadlines')} />}
        </div>
      </section>
    </div>
  </>
}

function Pantry({ data, money, update, setPortion, remove, open, edit }: { data: AppData; money: (n: number) => string; update: (id: string, d: number) => void; setPortion: (id: string, grams: number) => void; remove: (id: string) => void; open: () => void; edit: (item: PantryItem) => void }) {
  const { locale, t } = useI18n()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const locations = ['all', ...new Set(data.pantry.map(item => item.location))]
  const items = data.pantry.filter(i => (filter === 'all' || i.location === filter) && i.name.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale)))
  return <>
    <PageIntro title={t('pantry.title')} subtitle={t('pantry.subtitle')} button={t('pantry.add')} icon={<Plus />} onClick={open} />
    <div className="toolbar"><label className="input-search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('pantry.search')} /></label><div className="chips">{locations.map(l => <button key={l} className={filter === l ? 'active' : ''} onClick={() => setFilter(l)}>{l === 'all' ? t('common.all') : l}</button>)}</div></div>
    <div className="inventory-grid">{items.map(item => {
      const low = item.quantity < item.minimum
      const expiryDays = item.expiresAt ? daysBetween(today(), item.expiresAt) : null
      return <article className={`inventory-card ${low ? 'is-low' : ''}`} key={item.id}><div className="card-top"><ProductIcon name={item.name} image={item.image} large /><div className="card-badges">{low && <span className="badge danger">{t('pantry.restock')}</span>}{expiryDays !== null && expiryDays <= 7 && <span className="badge warning">{expiryDays < 0 ? t('pantry.expired') : t('common.days', { count: expiryDays })}</span>}<button className="edit-button" onClick={() => edit(item)} aria-label={t('common.edit', { name: item.name })}><Pencil size={15} /></button></div></div><h3>{item.name}</h3><p>{item.category} · {item.location}</p><Quantity value={item.quantity} unit={item.unit} onMinus={() => update(item.id, -1)} onPlus={() => update(item.id, 1)} large /><div className="minimum-line"><span>{t('pantry.minimum')}</span><strong>{item.minimum} {item.unit}</strong></div><div className="progress"><i style={{ width: `${Math.min(100, item.quantity / Math.max(item.minimum, 1) * 100)}%` }} /></div><div className={`card-meta ${item.nutritionPer100g ? 'has-nutrition' : ''}`}><span>{money(item.priceCzk)} / {item.unit}</span>{item.nutritionPer100g && <NutritionInline nutrition={item.nutritionPer100g} grams={item.portionGrams ?? 100} onGrams={grams => setPortion(item.id, grams)} />}<span>{item.expiresAt ? t('pantry.until', { date: formatDate(item.expiresAt, locale) }) : t('pantry.noExpiry')}</span></div><button className="delete-button" onClick={() => remove(item.id)} aria-label={t('common.delete')}><Trash2 size={16} /></button></article>
    })}</div>{!items.length && <Empty text={t('pantry.empty')} />}
  </>
}

function Freezer({ data, setData, open }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; open: () => void }) {
  const { locale, t } = useI18n()
  const remove = (id: string) => setData(p => ({ ...p, freezer: p.freezer.filter(i => i.id !== id) }))
  return <>
    <PageIntro title={t('freezer.title')} subtitle={t('freezer.subtitle')} button={t('freezer.add')} icon={<Plus />} onClick={open} />
    <div className="info-banner"><Snowflake size={21} /><div><strong>{t('freezer.goodToKnow')}</strong><span>{t('freezer.fact')}</span></div></div>
    <div className="freezer-layout"><section className="freezer-list"><h3>{t('freezer.contents')} <span>{data.freezer.length}</span></h3>{data.freezer.map(item => { const progress = freezerProgress(item); return <article className="freezer-row" key={item.id}><ProductIcon name={item.name} /><div className="grow"><div className="row-title"><strong>{item.name}</strong>{progress >= 100 ? <span className="badge danger">{t('freezer.consume')}</span> : progress >= 75 ? <span className="badge warning">{t('freezer.soon')}</span> : <span className="badge success">{t('freezer.ok')}</span>}</div><span>{item.quantity} {item.unit} · {item.category}{item.note ? ` · ${item.note}` : ''}</span><div className="freshness"><i className={progress >= 100 ? 'danger' : progress >= 75 ? 'warning' : ''} style={{ width: `${Math.min(100, progress)}%` }} /></div><small>{t('freezer.frozen', { date: formatDate(item.frozenAt, locale), months: item.recommendedMonths })}</small></div><button className="icon-btn" onClick={() => remove(item.id)} aria-label={t('common.delete')}><Trash2 size={16} /></button></article>})}</section>
      <aside className="guide"><div className="guide-head"><Fish size={20} /><div><h3>{t('freezer.guide')}</h3><p>{t('freezer.quality')}</p></div></div>{freezerGuide.map(g => <div className="guide-row" key={g.category}><span>{g.icon}</span><strong>{g.category}</strong><b>{t('common.monthsShort', { count: g.months })}</b></div>)}<a href="https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/freezing-and-food-safety" target="_blank" rel="noreferrer">{t('freezer.source')} <ArrowRight size={14} /></a></aside>
    </div>
  </>
}

function Shopping({ data, setData, money, open, notify }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; money: (n: number) => string; open: (m: ModalKind) => void; notify: (s: string) => void }) {
  const { t } = useI18n()
  const activeLists = data.shoppingLists.filter(l => !l.archived)
  const archivedLists = data.shoppingLists.filter(l => l.archived)
  const [active, setActive] = useState(activeLists[0]?.id ?? '')
  const [showArchived, setShowArchived] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [finishSelection, setFinishSelection] = useState<Set<string>>(new Set())
  const list = activeLists.find(l => l.id === active) ?? activeLists[0]
  useEffect(() => { if (list && list.id !== active) setActive(list.id) }, [active, list])
  const archiveList = () => {
    if (!list) return
    setData(p => ({ ...p, shoppingLists: p.shoppingLists.map(l => l.id === list.id ? { ...l, archived: true } : l) }))
    notify(t('shopping.archived', { name: list.name }))
  }
  const restoreList = (id: string) => {
    setData(p => ({ ...p, shoppingLists: p.shoppingLists.map(l => l.id === id ? { ...l, archived: false } : l) }))
    setActive(id); setShowArchived(false); notify(t('shopping.restored'))
  }
  if (!list) return <><PageIntro title={t('shopping.title')} subtitle={t('shopping.allArchived')} button={t('pantry.add')} icon={<Plus />} onClick={() => notify(t('shopping.restoreFirst'))} /><ArchivedLists lists={archivedLists} restore={restoreList} /></>
  const toggle = (id: string) => setData(p => ({ ...p, shoppingLists: p.shoppingLists.map(l => l.id !== list.id ? l : { ...l, items: l.items.map(i => i.id === id ? { ...i, checked: !i.checked } : i) }) }))
  const checkedItems = list.items.filter(item => item.checked)
  const openFinish = () => {
    setFinishSelection(new Set(checkedItems.filter(item => item.addToPantry).map(item => item.id)))
    setFinishOpen(true)
  }
  const finish = () => {
    const purchased = checkedItems.filter(item => finishSelection.has(item.id))
    setData(p => ({ ...p, pantry: [...p.pantry, ...purchased.map<PantryItem>(i => { const product = p.products.find(candidate => candidate.id === i.productId); return { id: uid(), name: i.name, category: product?.category || 'Z nákupu', location: 'Spíž', quantity: i.quantity, minimum: i.kanbanMinimum ?? 0, unit: i.unit, priceCzk: i.priceCzk ?? product?.priceCzk ?? 0, purchasedAt: today(), productId: product?.id, barcode: i.barcode || product?.ean, image: i.image || product?.image, nutritionPer100g: product?.nutritionPer100g, portionGrams: product?.packageGrams } })], shoppingLists: p.shoppingLists.map(l => l.id === list.id ? { ...l, items: l.items.filter(i => !i.checked) } : l) }))
    setFinishOpen(false)
    notify(purchased.length === 1 ? t('shopping.finishedOne') : t('shopping.finishedMany', { count: purchased.length }))
  }
  const total = list.items.reduce((s, i) => s + (i.priceCzk ?? 0) * i.quantity, 0)
  return <>
    <PageIntro title={t('shopping.title')} subtitle={t('shopping.subtitle')} button={t('pantry.add')} icon={<Plus />} onClick={() => open('shopping')} />
    <div className="shopping-tabs">{activeLists.map(l => <button key={l.id} className={l.id === list.id ? 'active' : ''} onClick={() => setActive(l.id)}><i style={{ background: l.color }} /><span><strong>{l.name}</strong><small>{l.type} · {t('shopping.remaining', { count: l.items.filter(i => !i.checked).length })}</small></span></button>)}<button className="new-list"><Plus size={17} />{t('shopping.newList')}</button>{archivedLists.length > 0 && <button className="archive-tab" onClick={() => setShowArchived(!showArchived)}><Archive size={17} />{t('shopping.archive')} ({archivedLists.length})</button>}</div>
    {showArchived && <ArchivedLists lists={archivedLists} restore={restoreList} />}
    <section className="shopping-panel"><div className="shopping-head"><div><span className="list-dot" style={{ background: list.color }} /><div><h2>{list.name}</h2><p>{list.type}</p></div></div><div className="shopping-head-actions"><button className="secondary" onClick={archiveList}><Archive size={17} />{t('shopping.archiveAction')}</button><button className="secondary" onClick={() => open('scanner')}><ScanLine size={18} />{t('shopping.scan')}</button></div></div>
      <div className="shopping-progress"><div><span>{t('shopping.progress')}</span><strong>{list.items.filter(i => i.checked).length} / {list.items.length}</strong></div><div className="progress"><i style={{ width: `${list.items.length ? list.items.filter(i => i.checked).length / list.items.length * 100 : 0}%` }} /></div></div>
      <div className="shopping-items">{list.items.map(item => <label key={item.id} className={item.checked ? 'checked' : ''}><input type="checkbox" checked={item.checked} onChange={() => toggle(item.id)} /><span className="custom-check"><Check size={16} /></span><ProductIcon name={item.name} /><span className="grow"><strong>{item.name}</strong><small>{item.quantity} {item.unit}{item.addToPantry ? ` · ${t('shopping.preselected')}` : ''}</small></span><span className="item-price">{item.priceCzk ? money(item.priceCzk * item.quantity) : t('shopping.enterPrice')}</span></label>)}</div>
      <div className="shopping-summary"><div><span>{t('shopping.spending')}</span><strong>{money(total)}</strong></div><button className="primary" disabled={!checkedItems.length} onClick={openFinish}><CheckCircle2 size={18} />{t('shopping.done')}</button></div>
    </section>
    {finishOpen && <ShoppingFinishDialog items={checkedItems} selected={finishSelection} setSelected={setFinishSelection} close={() => setFinishOpen(false)} confirm={finish} />}
  </>
}

function ShoppingFinishDialog({ items, selected, setSelected, close, confirm }: { items: ShoppingItem[]; selected: Set<string>; setSelected: Dispatch<SetStateAction<Set<string>>>; close: () => void; confirm: () => void }) {
  const { t } = useI18n()
  const toggle = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><div className="modal finish-shopping-modal"><div className="modal-head"><div><span className="eyebrow">{t('shopping.finishEyebrow')}</span><h2>{t('shopping.finishTitle')}</h2></div><button className="icon-btn" onClick={close} aria-label={t('common.close')}><X size={20} /></button></div><div className="finish-shopping-content"><p>{t('shopping.finishText')}</p><div className="finish-shopping-list">{items.map(item => <label key={item.id}><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} /><span className="custom-check"><Check size={15} /></span><ProductIcon name={item.name} /><span className="grow"><strong>{item.name}</strong><small>{item.quantity} {item.unit}</small></span></label>)}</div><div className="finish-shopping-note"><CheckCircle2 size={17} />{t('shopping.finishNote', { selected: selected.size, total: items.length })}</div><div className="modal-actions"><button type="button" className="secondary" onClick={close}>{t('common.back')}</button><button type="button" className="primary" onClick={confirm}><CheckCircle2 size={18} />{t('shopping.confirm')}</button></div></div></div></div>
}

function ArchivedLists({ lists, restore }: { lists: AppData['shoppingLists']; restore: (id: string) => void }) {
  const { t } = useI18n()
  return <section className="archived-lists"><div><Archive size={19} /><span><strong>{t('shopping.archivedLists')}</strong><small>{t('shopping.archivedHint')}</small></span></div>{lists.map(list => <article key={list.id}><i style={{ background: list.color }} /><span className="grow"><strong>{list.name}</strong><small>{list.type} · {t('common.items', { count: list.items.length })}</small></span><button className="secondary" onClick={() => restore(list.id)}>{t('common.restore')}</button></article>)}</section>
}

function Recipes({ data, setData, notify, go, open, edit }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; notify: (s: string) => void; go: (p: Page) => void; open: () => void; edit: (recipe: Recipe) => void }) {
  const { locale, t } = useI18n()
  const [query, setQuery] = useState('')
  const recipes = data.recipes.filter(recipe => [recipe.name, ...recipe.ingredients.map(ingredient => ingredient.name)].join(' ').toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale)))
  const addIngredients = (id: string) => {
    const recipe = data.recipes.find(r => r.id === id)!
    const items: ShoppingItem[] = recipe.ingredients.map(i => ({ id: uid(), name: i.name, quantity: 1, unit: 'ks', checked: false, addToPantry: false }))
    setData(p => ({ ...p, shoppingLists: p.shoppingLists.map((l, n) => n === 0 ? { ...l, items: [...l.items, ...items] } : l) }))
    notify(t('recipes.ingredientsAdded', { name: recipe.name })); go('shopping')
  }
  return <><PageIntro title={t('recipes.title')} subtitle={t('recipes.subtitle')} button={t('recipes.new')} icon={<Plus />} onClick={open} />
    <label className="input-search wide"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('recipes.search')} /></label>
    <div className="recipe-grid">{recipes.map(recipe => <article className="recipe-card" key={recipe.id}><div className="recipe-cover"><span>{recipe.emoji}</span><div className="recipe-cover-actions"><button className="recipe-edit" onClick={() => edit(recipe)} aria-label={t('common.edit', { name: recipe.name })}><Pencil size={15} /></button><button className={recipe.favorite ? 'favorite' : ''} onClick={() => setData(p => ({ ...p, recipes: p.recipes.map(r => r.id === recipe.id ? { ...r, favorite: !r.favorite } : r) }))} aria-label={t('recipes.favorite', { name: recipe.name })}>♥</button></div></div><div className="recipe-body"><div className="tag-row">{recipe.tags.map(tag => <span key={tag}>{tag}</span>)}</div><h3>{recipe.name}</h3><p><Clock3 size={15} />{recipe.minutes} min <span>·</span> {t('recipes.servings', { count: recipe.servings })}</p><div className="ingredients-preview">{recipe.ingredients.slice(0, 3).map((i, index) => <span key={`${i.name}-${index}`}>{i.name} <b>{i.amount}</b></span>)}</div><button className="secondary full" onClick={() => addIngredients(recipe.id)}><ShoppingBasket size={17} />{t('recipes.addShopping')}</button></div></article>)}</div>
  </>
}

function Todos({ data, setData, toggle, open }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; toggle: (id: string) => void; open: () => void }) {
  const { locale, t } = useI18n()
  const [selected, setSelected] = useState(today())
  const monthDays = useMemo(() => {
    const base = new Date(`${selected}T12:00:00`); const y = base.getFullYear(), m = base.getMonth(); const first = new Date(y, m, 1); const start = new Date(y, m, 1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  }, [selected])
  const selectedTasks = data.todos.filter(t => t.date === selected)
  return <><PageIntro title={t('todos.title')} subtitle={t('todos.subtitle')} button={t('todos.add')} icon={<Plus />} onClick={open} />
    <div className="todo-layout"><section className="calendar-panel"><div className="calendar-head"><button onClick={() => { const d = new Date(selected); d.setMonth(d.getMonth() - 1); setSelected(d.toISOString().slice(0, 10)) }}>‹</button><h3>{new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(selected))}</h3><button onClick={() => { const d = new Date(selected); d.setMonth(d.getMonth() + 1); setSelected(d.toISOString().slice(0, 10)) }}>›</button></div><div className="weekdays">{t('weekdays').split(',').map(d => <span key={d}>{d}</span>)}</div><div className="calendar-grid">{monthDays.map(d => { const iso = d.toISOString().slice(0, 10); const currentMonth = d.getMonth() === new Date(selected).getMonth(); const has = data.todos.some(todo => todo.date === iso); return <button key={iso} className={`${iso === selected ? 'selected' : ''} ${iso === today() ? 'today' : ''} ${!currentMonth ? 'muted' : ''}`} onClick={() => setSelected(iso)}><span>{d.getDate()}</span>{has && <i />}</button> })}</div></section>
      <section className="tasks-panel"><div className="tasks-head"><div><span className="eyebrow">{t('todos.selectedDay')}</span><h3>{formatDate(selected, locale)}</h3></div><span>{t('common.tasks', { count: selectedTasks.length })}</span></div>{selectedTasks.map(todo => <div className={`task-row ${todo.done ? 'done' : ''}`} key={todo.id}><button className="task-check" onClick={() => toggle(todo.id)}>{todo.done && <Check size={15} />}</button><div className="grow"><strong>{todo.title}</strong><span className={`category ${todo.category.toLowerCase()}`}>{todo.category}</span></div><button className="icon-btn" onClick={() => setData(p => ({ ...p, todos: p.todos.filter(x => x.id !== todo.id) }))} aria-label={t('common.delete')}><Trash2 size={16} /></button></div>)}{!selectedTasks.length && <Empty text={t('todos.empty')} />}</section></div>
  </>
}

function Modal({ kind, close, data, setData, notify, settings, editingPantry, editingRecipe, onScanned }: { kind: Exclude<ModalKind, null>; close: () => void; data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; notify: (s: string) => void; settings: SiteSettings; editingPantry: PantryItem | null; editingRecipe: Recipe | null; onScanned: (code: string) => void }) {
  const { locale, t } = useI18n()
  const [scannerOpen, setScannerOpen] = useState(false)
  const [barcode, setBarcode] = useState(editingPantry?.barcode ?? '')
  const [image, setImage] = useState<string | undefined>(editingPantry?.image?.startsWith('http') ? undefined : editingPantry?.image)
  const [imageUrl, setImageUrl] = useState(editingPantry?.image?.startsWith('http') ? editingPantry.image : '')
  const [imageError, setImageError] = useState('')
  const [catalogError, setCatalogError] = useState('')
  const [pantryName, setPantryName] = useState(editingPantry?.name ?? '')
  const [shoppingName, setShoppingName] = useState('')
  const [portionGrams, setPortionGrams] = useState(String(editingPantry?.portionGrams ?? 100))
  const [saveToCatalog, setSaveToCatalog] = useState(Boolean(editingPantry?.productId))
  const [packageGrams, setPackageGrams] = useState(String(editingPantry?.portionGrams ?? ''))
  const [productStores, setProductStores] = useState('')
  const [productEshopUrl, setProductEshopUrl] = useState('')
  const [productNotes, setProductNotes] = useState('')
  const [nutrition, setNutrition] = useState<NutritionInput>({
    kcal: String(editingPantry?.nutritionPer100g?.kcal ?? ''), carbs: String(editingPantry?.nutritionPer100g?.carbs ?? ''),
    sugars: String(editingPantry?.nutritionPer100g?.sugars ?? ''), fat: String(editingPantry?.nutritionPer100g?.fat ?? ''), protein: String(editingPantry?.nutritionPer100g?.protein ?? ''), fiber: String(editingPantry?.nutritionPer100g?.fiber ?? ''),
  })
  const [recipeIngredients, setRecipeIngredients] = useState<Recipe['ingredients']>(() => editingRecipe?.ingredients.map(ingredient => ({ ...ingredient, grams: (ingredient.grams ?? parseIngredientGrams(ingredient.amount)) || undefined })) ?? [{ name: '', amount: '', grams: undefined }])
  const categories = [...new Set([...settings.categories, ...data.pantry.map(i => i.category)])].sort((a, b) => a.localeCompare(b, locale))
  const locations = [...new Set([...settings.locations, ...data.pantry.map(i => i.location)])].sort((a, b) => a.localeCompare(b, locale))
  const chooseImage = async (file?: File) => {
    if (!file) return
    setImageError('')
    try { setImage(await prepareThumbnail(file, { read: t('error.photoRead'), format: t('error.photoFormat') })); setImageUrl('') } catch (error) { setImageError(error instanceof Error ? error.message : t('error.photoRead')) }
  }
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    const productName = kind === 'shopping' ? shoppingName : pantryName
    const hasCompleteCatalogData = Boolean(productName.trim() && imageSource && Number(packageGrams) > 0 && nutrition.kcal !== '' && nutrition.carbs !== '' && nutrition.sugars !== '' && nutrition.fat !== '' && nutrition.protein !== '')
    if ((kind === 'pantry' || kind === 'shopping') && saveToCatalog && !hasCompleteCatalogData) {
      setCatalogError('Pro uložení do databáze doplňte fotografii, gramáž balení a kcal, sacharidy včetně cukrů, tuky a proteiny na 100 g. EAN je volitelný.')
      return
    }
    const catalogDraft: ProductDraft | undefined = saveToCatalog ? { name: productName.trim(), ean: barcode, image: imageSource || '', packageGrams: Number(packageGrams), nutritionPer100g: { kcal: Number(nutrition.kcal), carbs: Number(nutrition.carbs), sugars: Number(nutrition.sugars), fat: Number(nutrition.fat), protein: Number(nutrition.protein), fiber: Number(nutrition.fiber) || 0 }, category: String(f.get('category') || ''), stores: productStores, eshopUrl: productEshopUrl, notes: productNotes, priceCzk: Number(f.get('price')) || 0, source: 'local' } : undefined
    if (kind === 'pantry') {
      const hasNutrition = Object.values(nutrition).some(value => value !== '')
      const existingProduct = catalogDraft ? findProductByEan(data.products, catalogDraft.ean) : undefined
      const storedProduct = catalogDraft ? toFoodProduct(catalogDraft, existingProduct) : undefined
      const item: PantryItem = { id: editingPantry?.id ?? uid(), name: String(f.get('name')), category: String(f.get('category') || 'Ostatní'), location: String(f.get('location')), quantity: Number(f.get('quantity')), minimum: Number(f.get('minimum')), unit: String(f.get('unit')) as Unit, priceCzk: Number(f.get('price')), purchasedAt: String(f.get('purchasedAt')), expiresAt: String(f.get('expiresAt')) || undefined, barcode: barcode || undefined, image: imageUrl.trim() || image, nutritionPer100g: hasNutrition ? { kcal: Number(nutrition.kcal) || 0, carbs: Number(nutrition.carbs) || 0, sugars: Number(nutrition.sugars) || 0, fat: Number(nutrition.fat) || 0, protein: Number(nutrition.protein) || 0, fiber: Number(nutrition.fiber) || 0 } : undefined, portionGrams: hasNutrition ? Math.max(0, Number(portionGrams) || 0) : undefined, productId: storedProduct?.id ?? editingPantry?.productId }
      setData(p => ({ ...p, products: storedProduct ? upsertFoodProduct(p.products, storedProduct) : p.products, pantry: editingPantry ? p.pantry.map(existing => existing.id === item.id ? item : existing) : [item, ...p.pantry] })); notify(editingPantry ? t('modal.itemUpdated') : t('modal.itemPantryAdded'))
    } else if (kind === 'freezer') {
      const category = String(f.get('category')); const guide = freezerGuide.find(g => g.category === category)
      const item: FreezerItem = { id: uid(), name: String(f.get('name')), category, quantity: Number(f.get('quantity')), unit: String(f.get('unit')) as Unit, frozenAt: String(f.get('frozenAt')), recommendedMonths: guide?.max ?? Number(f.get('months')) ?? 6, note: String(f.get('note')) || undefined }
      setData(p => ({ ...p, freezer: [item, ...p.freezer] })); notify(t('modal.itemFreezerAdded'))
    } else if (kind === 'shopping') {
      const listId = String(f.get('list'))
      const existingProduct = catalogDraft ? findProductByEan(data.products, catalogDraft.ean) : undefined
      const storedProduct = catalogDraft ? toFoodProduct(catalogDraft, existingProduct) : undefined
      const item: ShoppingItem = { id: uid(), name: String(f.get('name')), quantity: Number(f.get('quantity')), unit: String(f.get('unit')) as Unit, checked: false, priceCzk: Number(f.get('price')) || undefined, addToPantry: f.get('addToPantry') === 'on', kanbanMinimum: Number(f.get('minimum')) || undefined, productId: storedProduct?.id, barcode: barcode || undefined, image: imageSource || undefined }
      setData(p => ({ ...p, products: storedProduct ? upsertFoodProduct(p.products, storedProduct) : p.products, shoppingLists: p.shoppingLists.map(l => l.id === listId ? { ...l, items: [...l.items, item] } : l) })); notify(t('modal.itemShoppingAdded'))
    } else if (kind === 'todo') {
      const task: Todo = { id: uid(), title: String(f.get('title')), date: String(f.get('date')), done: false, category: String(f.get('category')) as Todo['category'] }
      setData(p => ({ ...p, todos: [...p.todos, task] })); notify(t('modal.todoAdded'))
    } else if (kind === 'recipe') {
      const ingredients = recipeIngredients.map<RecipeIngredient>(ingredient => {
        const name = ingredient.name.trim()
        const normalizedName = name.toLocaleLowerCase(locale)
        const product = data.products.find(item => item.name.trim().toLocaleLowerCase(locale) === normalizedName)
        const pantryItem = data.pantry.find(item => item.name.trim().toLocaleLowerCase(locale) === normalizedName)
        const grams = Number(ingredient.grams) || parseIngredientGrams(ingredient.amount)
        return { ...ingredient, name, amount: ingredient.amount.trim() || (grams ? `${grams} g` : t('modal.toTaste')), grams: grams || undefined, productId: ingredient.productId ?? product?.id ?? pantryItem?.productId, nutritionPer100g: resolveIngredientNutrition(ingredient, data) ?? product?.nutritionPer100g ?? pantryItem?.nutritionPer100g }
      }).filter(ingredient => ingredient.name)
      const recipe: Recipe = { id: editingRecipe?.id ?? uid(), name: String(f.get('name')), emoji: String(f.get('emoji') || '🍽️'), minutes: Number(f.get('minutes')) || 30, servings: Number(f.get('servings')) || 4, tags: String(f.get('tags')).split(',').map(tag => tag.trim()).filter(Boolean), ingredients, instructions: String(f.get('instructions')), favorite: editingRecipe?.favorite ?? false }
      setData(p => ({ ...p, recipes: editingRecipe ? p.recipes.map(existing => existing.id === recipe.id ? recipe : existing) : [recipe, ...p.recipes] })); notify(editingRecipe ? t('modal.recipeUpdated') : t('modal.recipeAdded'))
    }
    close()
  }
  const imageSource = imageUrl.trim() || image
  const catalogExtras = <section className="catalog-inline-fields"><div className="form-grid"><Field label="Gramáž balení"><div className="number-with-unit"><input type="number" min="1" step="1" value={packageGrams} onChange={event => setPackageGrams(event.target.value)} /><span>g</span></div></Field><Field label="Obchody (volitelně)"><input value={productStores} onChange={event => setProductStores(event.target.value)} placeholder="Albert, Lidl…" /></Field><Field label="Odkaz na e-shop (volitelně)"><input type="url" value={productEshopUrl} onChange={event => setProductEshopUrl(event.target.value)} placeholder="https://…" /></Field><Field label="Poznámka (volitelně)"><input value={productNotes} onChange={event => setProductNotes(event.target.value)} /></Field></div>{catalogError && <p className="catalog-form-error">{catalogError}</p>}</section>
  const titles = { pantry: editingPantry ? t('modal.editItem') : t('modal.addPantry'), freezer: t('modal.addFreezer'), shopping: t('modal.addShopping'), todo: t('modal.newTodo'), scanner: t('modal.scanCode'), recipe: editingRecipe ? t('modal.editRecipe') : t('modal.newRecipe') }
  const isEditing = (kind === 'pantry' && Boolean(editingPantry)) || (kind === 'recipe' && Boolean(editingRecipe))
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><div className="modal"><div className="modal-head"><div><span className="eyebrow">Grocy Homie</span><h2>{titles[kind]}</h2></div><button className="icon-btn" onClick={close} aria-label={t('common.close')}><X size={20} /></button></div>
    {kind === 'scanner' ? <BarcodeScanner onDetected={onScanned} /> : <form onSubmit={submit}>
      {kind === 'pantry' && <><Field label={t('modal.name')}><input name="name" required autoFocus value={pantryName} onChange={event => setPantryName(event.target.value)} placeholder={t('modal.exampleItem')} /></Field><div className="form-grid"><Field label={t('settings.category')}><input name="category" list="pantry-categories" defaultValue={editingPantry?.category ?? settings.defaultCategory} placeholder={t('modal.selectOrType')} /><datalist id="pantry-categories">{categories.map(category => <option value={category} key={category} />)}</datalist></Field><Field label={t('settings.location')}><select name="location" defaultValue={editingPantry?.location ?? settings.defaultLocation}>{locations.map(location => <option key={location}>{location}</option>)}</select></Field><Field label={t('settings.quantity')}><input name="quantity" type="number" min="0" step="0.1" defaultValue={editingPantry?.quantity ?? settings.defaultQuantity} required /></Field><Field label={t('settings.unit')}><UnitSelect defaultValue={editingPantry?.unit ?? settings.defaultUnit} /></Field><Field label={t('settings.minimum')}><input name="minimum" type="number" min="0" step="0.1" defaultValue={editingPantry?.minimum ?? settings.defaultMinimum} required /></Field><Field label={t('modal.priceCzk')}><input name="price" type="number" min="0" step="0.01" defaultValue={editingPantry?.priceCzk ?? 0} /></Field><Field label={t('modal.purchaseDate')}><input name="purchasedAt" type="date" defaultValue={editingPantry?.purchasedAt ?? today()} required /></Field><Field label={t('modal.expiryOptional')}><input name="expiresAt" type="date" defaultValue={editingPantry?.expiresAt} /></Field></div><NutritionEditor nutrition={nutrition} setNutrition={setNutrition} grams={portionGrams} setGrams={setPortionGrams} foodName={pantryName} /><Field label={t('modal.barcode')}><div className="input-with-action"><input value={barcode} onChange={e => setBarcode(e.target.value.replace(/\D/g, '').slice(0, 14))} inputMode="numeric" placeholder="859…" /><button type="button" className="secondary" onClick={() => setScannerOpen(true)}><ScanLine size={17} />{t('modal.scan')}</button></div></Field>{scannerOpen && <BarcodeScanner onDetected={code => { setBarcode(code); setScannerOpen(false); notify(t('modal.eanLoaded', { code })) }} onCancel={() => setScannerOpen(false)} compact />}<Field label={t('modal.imageUrl')}><input type="url" value={imageUrl} onChange={event => { setImageUrl(event.target.value); if (event.target.value) setImage(undefined) }} placeholder="https://…/product.jpg" /></Field><Field label={t('modal.photo')}><label className="photo-upload"><input type="file" accept="image/*" capture="environment" onChange={e => chooseImage(e.target.files?.[0])} /><span className="photo-preview">{imageSource ? <img src={imageSource} alt={t('modal.productPreview')} /> : <><Plus size={20} /><small>{t('modal.choosePhoto')}</small></>}</span>{imageSource && <span>{t('modal.changePhoto')}</span>}</label>{imageError && <small className="field-error">{imageError}</small>}</Field><label className="switch-row catalog-save-switch"><input type="checkbox" checked={saveToCatalog} onChange={event => { setSaveToCatalog(event.target.checked); setCatalogError('') }} /><span />Uložit potravinu také do databáze</label>{saveToCatalog && catalogExtras}</>}
      {kind === 'freezer' && <><Field label={t('modal.name')}><input name="name" required autoFocus placeholder={t('modal.exampleFreezer')} /></Field><Field label={t('modal.freezerCategory')}><select name="category">{freezerGuide.map(g => <option key={g.category}>{g.category}</option>)}</select></Field><div className="form-grid"><Field label={t('settings.quantity')}><input name="quantity" type="number" min="0" step="0.1" defaultValue="1" required /></Field><Field label={t('settings.unit')}><UnitSelect /></Field><Field label={t('modal.freezeDate')}><input name="frozenAt" type="date" defaultValue={today()} required /></Field><Field label={t('modal.note')}><input name="note" placeholder={t('modal.examplePortion')} /></Field></div></>}
      {kind === 'shopping' && <><Field label={t('modal.list')}><select name="list">{data.shoppingLists.filter(l => !l.archived).map(l => <option value={l.id} key={l.id}>{l.name} · {l.type}</option>)}</select></Field><Field label={t('modal.name')}><input name="name" required autoFocus value={shoppingName} onChange={event => setShoppingName(event.target.value)} placeholder={t('modal.whatBuy')} /></Field><div className="form-grid"><Field label={t('settings.quantity')}><input name="quantity" type="number" min="0" step="0.1" defaultValue="1" /></Field><Field label={t('settings.unit')}><UnitSelect /></Field><Field label={t('modal.estimatedPrice')}><input name="price" type="number" min="0" step="0.01" /></Field><Field label={t('settings.minimum')}><input name="minimum" type="number" min="0" step="1" /></Field></div><label className="switch-row"><input type="checkbox" name="addToPantry" defaultChecked /><span />{t('modal.addToPantry')}</label><label className="switch-row catalog-save-switch"><input type="checkbox" checked={saveToCatalog} onChange={event => { setSaveToCatalog(event.target.checked); setCatalogError('') }} /><span />Uložit potravinu také do databáze</label>{saveToCatalog && <><NutritionEditor nutrition={nutrition} setNutrition={setNutrition} grams={portionGrams} setGrams={setPortionGrams} foodName={shoppingName} /><Field label={t('modal.barcode')}><div className="input-with-action"><input value={barcode} onChange={event => setBarcode(event.target.value.replace(/\D/g, '').slice(0, 14))} inputMode="numeric" placeholder="859…" /><button type="button" className="secondary" onClick={() => setScannerOpen(true)}><ScanLine size={17} />{t('modal.scan')}</button></div></Field>{scannerOpen && <BarcodeScanner onDetected={code => { setBarcode(code); setScannerOpen(false) }} onCancel={() => setScannerOpen(false)} compact />}<Field label={t('modal.imageUrl')}><input type="url" value={imageUrl} onChange={event => { setImageUrl(event.target.value); if (event.target.value) setImage(undefined) }} placeholder="https://…/product.jpg" /></Field><Field label={t('modal.photo')}><label className="photo-upload"><input type="file" accept="image/*" capture="environment" onChange={event => chooseImage(event.target.files?.[0])} /><span className="photo-preview">{imageSource ? <img src={imageSource} alt={t('modal.productPreview')} /> : <><Plus size={20} /><small>{t('modal.choosePhoto')}</small></>}</span>{imageSource && <span>{t('modal.changePhoto')}</span>}</label>{imageError && <small className="field-error">{imageError}</small>}</Field>{catalogExtras}</>}</>}
      {kind === 'todo' && <><Field label={t('modal.todoQuestion')}><input name="title" required autoFocus placeholder={t('modal.exampleTodo')} /></Field><div className="form-grid"><Field label={t('modal.date')}><input name="date" type="date" defaultValue={today()} required /></Field><Field label={t('settings.category')}><select name="category"><option value="Domácnost">{t('modal.household')}</option><option value="Nákup">{t('nav.shopping')}</option><option value="Rodina">{t('modal.family')}</option><option value="Jiné">{t('modal.other')}</option></select></Field></div></>}
      {kind === 'recipe' && <><div className="recipe-title-fields"><Field label={t('modal.emoji')}><input name="emoji" defaultValue={editingRecipe?.emoji ?? '🍽️'} maxLength={4} /></Field><Field label={t('modal.recipeName')}><input name="name" required autoFocus defaultValue={editingRecipe?.name} placeholder={t('modal.exampleRecipe')} /></Field></div><div className="form-grid"><Field label={t('modal.minutes')}><input name="minutes" type="number" min="1" defaultValue={editingRecipe?.minutes ?? 30} required /></Field><Field label={t('modal.servings')}><input name="servings" type="number" min="1" defaultValue={editingRecipe?.servings ?? 4} required /></Field></div><Field label={t('modal.tags')}><input name="tags" defaultValue={editingRecipe?.tags.join(', ')} placeholder={t('modal.tagsPlaceholder')} /></Field><RecipeIngredientEditor pantry={data.pantry} products={data.products} ingredients={recipeIngredients} setIngredients={setRecipeIngredients} /><Field label={t('modal.instructions')}><textarea name="instructions" rows={6} required defaultValue={editingRecipe?.instructions} placeholder={t('modal.instructionsPlaceholder')} /></Field></>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={close}>{t('common.cancel')}</button><button className="primary" type="submit">{isEditing ? <Pencil size={18} /> : <Plus size={18} />}{isEditing ? t('common.saveChanges') : t('common.add')}</button></div>
    </form>}
  </div></div>
}

function RecipeIngredientEditor({ pantry, products, ingredients, setIngredients }: { pantry: PantryItem[]; products: FoodProduct[]; ingredients: Recipe['ingredients']; setIngredients: Dispatch<SetStateAction<Recipe['ingredients']>> }) {
  const { locale, t } = useI18n()
  const pantryItems = [...new Map(pantry.map(item => [item.name.toLocaleLowerCase(locale), item])).values()].sort((a, b) => a.name.localeCompare(b.name, locale))
  const candidates = [...new Map([
    ...products.map(product => [product.name.toLocaleLowerCase(locale), { name: product.name, productId: product.id, nutritionPer100g: product.nutritionPer100g } ] as const),
    ...pantry.filter(item => item.nutritionPer100g).map(item => [item.name.toLocaleLowerCase(locale), { name: item.name, productId: item.productId, nutritionPer100g: item.nutritionPer100g } ] as const),
  ]).values()].sort((a, b) => a.name.localeCompare(b.name, locale))
  const updateName = (index: number, name: string) => setIngredients(current => current.map((ingredient, position) => { if (position !== index) return ingredient; const match = candidates.find(item => item.name.toLocaleLowerCase(locale) === name.trim().toLocaleLowerCase(locale)); return { ...ingredient, name, productId: match?.productId, nutritionPer100g: match?.nutritionPer100g } }))
  const updateAmount = (index: number, amount: string) => setIngredients(current => current.map((ingredient, position) => position === index ? { ...ingredient, amount, grams: parseIngredientGrams(amount) || ingredient.grams } : ingredient))
  const updateGrams = (index: number, grams: number) => setIngredients(current => current.map((ingredient, position) => position === index ? { ...ingredient, grams: grams || undefined } : ingredient))
  const addFromPantry = (item: PantryItem) => setIngredients(current => {
    if (current.some(ingredient => ingredient.name.toLocaleLowerCase(locale) === item.name.toLocaleLowerCase(locale))) return current
    const product = item.productId ? products.find(candidate => candidate.id === item.productId) : products.find(candidate => candidate.name.toLocaleLowerCase(locale) === item.name.toLocaleLowerCase(locale))
    const suggestedGrams = item.portionGrams || product?.packageGrams || 0
    const next: RecipeIngredient = { name: item.name, amount: suggestedGrams ? `${suggestedGrams} g` : `1 ${item.unit}`, grams: suggestedGrams || undefined, productId: product?.id ?? item.productId, nutritionPer100g: product?.nutritionPer100g ?? item.nutritionPer100g }
    const empty = current.findIndex(ingredient => !ingredient.name.trim())
    return empty >= 0 ? current.map((ingredient, index) => index === empty ? next : ingredient) : [...current, next]
  })
  const remove = (index: number) => setIngredients(current => current.length === 1 ? [{ name: '', amount: '', grams: undefined }] : current.filter((_, position) => position !== index))
  return <section className="recipe-ingredients-editor"><div className="recipe-ingredients-head"><div><strong>{t('ingredients.title')}</strong><small>Vyberte potravinu s nutričními údaji a zadejte její hmotnost pro přesný výpočet receptu.</small></div><button type="button" className="secondary" onClick={() => setIngredients(current => [...current, { name: '', amount: '', grams: undefined }])}><Plus size={15} />{t('ingredients.addRow')}</button></div>{pantryItems.length > 0 && <div className="pantry-ingredient-picks">{pantryItems.map(item => <button type="button" key={item.id} onClick={() => addFromPantry(item)}><Plus size={12} />{item.name}<small>{item.quantity} {item.unit}</small></button>)}</div>}<datalist id="recipe-pantry-items">{candidates.map(item => <option value={item.name} key={`${item.productId ?? 'pantry'}-${item.name}`} />)}</datalist><div className="recipe-ingredient-rows">{ingredients.map((ingredient, index) => <div className="recipe-ingredient-row" key={index}><input list="recipe-pantry-items" value={ingredient.name} onChange={event => updateName(index, event.target.value)} placeholder={t('ingredients.item')} required={index === 0} aria-label={`${t('ingredients.item')} ${index + 1}`} /><input value={ingredient.amount} onChange={event => updateAmount(index, event.target.value)} placeholder={t('ingredients.amountPlaceholder')} aria-label={t('ingredients.amount', { count: index + 1 })} /><div className="number-with-unit"><input type="number" min="0" step="1" value={ingredient.grams ?? ''} onChange={event => updateGrams(index, Number(event.target.value))} placeholder="0" aria-label={`Hmotnost ingredience ${index + 1}`} /><span>g</span></div><span className={`ingredient-link-state ${ingredient.nutritionPer100g ? 'ready' : ''}`}>{ingredient.nutritionPer100g ? 'Výživa ✓' : 'Doplnit výživu'}</span><button type="button" className="icon-btn" onClick={() => remove(index)} aria-label={t('ingredients.remove', { count: index + 1 })}><X size={15} /></button></div>)}</div></section>
}

function BarcodeScanner({ onDetected, onCancel, compact }: { onDetected: (code: string) => void; onCancel?: () => void; compact?: boolean }) {
  const { t } = useI18n()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState(() => t('scanner.aim'))
  const secure = window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname)
  const stop = () => { controlsRef.current?.stop(); controlsRef.current = null; setRunning(false) }
  useEffect(() => stop, [])
  const start = async () => {
    if (!secure || !navigator.mediaDevices?.getUserMedia) { setMessage(t('scanner.https')); return }
    setMessage(t('scanner.allow')); setRunning(true)
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      controlsRef.current = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' } } }, videoRef.current ?? undefined, (result, _error, controls) => {
        if (!result) return
        const value = result.getText(); controls.stop(); controlsRef.current = null; setRunning(false); onDetected(value)
      })
    } catch (error) {
      setRunning(false)
      const name = error instanceof DOMException ? error.name : ''
      setMessage(name === 'NotAllowedError' ? t('scanner.denied') : t('scanner.failed'))
    }
  }
  const scanPhoto = async (file?: File) => {
    if (!file) return
    const url = URL.createObjectURL(file); setMessage(t('scanner.recognizing'))
    try { const { BrowserMultiFormatReader } = await import('@zxing/browser'); const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url); onDetected(result.getText()) }
    catch { setMessage(t('scanner.notFound')) }
    finally { URL.revokeObjectURL(url) }
  }
  return <div className={`scanner ${compact ? 'compact' : ''}`}><div className={`scanner-frame ${running ? 'scanning' : ''}`}><video ref={videoRef} muted playsInline />{!running && <ScanLine size={46} />}<span>{message}</span></div><div className="scanner-actions">{running ? <button type="button" className="secondary" onClick={stop}><X size={17} />{t('scanner.stop')}</button> : <button type="button" className="primary" onClick={start}><ScanLine size={17} />{t('scanner.live')}</button>}<label className="secondary capture-code"><input type="file" accept="image/*" capture="environment" onChange={e => scanPhoto(e.target.files?.[0])} /><ScanLine size={17} />{t('scanner.photo')}</label>{onCancel && <button type="button" className="secondary" onClick={() => { stop(); onCancel() }}>{t('common.close')}</button>}</div></div>
}

function Stat({ icon, tone, label, value, note, warning, onClick }: { icon: ReactNode; tone: string; label: string; value: string; note: string; warning?: boolean; onClick?: () => void }) { return <button className="stat-card" onClick={onClick}><span className={`stat-icon ${tone}`}>{icon}</span><span><small>{label}</small><strong>{value}</strong><em className={warning ? 'warn' : ''}>{warning && <AlertTriangle size={12} />}{note}</em></span>{onClick && <ChevronRight className="stat-arrow" size={18} />}</button> }
function PanelHead({ title, subtitle, action, onClick }: { title: string; subtitle: string; action?: string; onClick?: () => void }) { return <div className="panel-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{action && <button onClick={onClick}>{action}<ChevronRight size={15} /></button>}</div> }
function PageIntro({ title, subtitle, button, icon, onClick }: { title: string; subtitle: string; button: string; icon: ReactNode; onClick: () => void }) { return <section className="page-intro"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="primary" onClick={onClick}>{icon}{button}</button></section> }
type NutritionValues = NonNullable<PantryItem['nutritionPer100g']>
type NutritionInput = Record<keyof NutritionValues, string>
const nutritionLabels: { key: keyof NutritionValues; labelKey: string; unit: string }[] = [{ key: 'kcal', labelKey: 'nutrition.kcal', unit: 'kcal' }, { key: 'carbs', labelKey: 'nutrition.carbs', unit: 'g' }, { key: 'sugars', labelKey: 'nutrition.sugars', unit: 'g' }, { key: 'fat', labelKey: 'nutrition.fat', unit: 'g' }, { key: 'protein', labelKey: 'nutrition.protein', unit: 'g' }, { key: 'fiber', labelKey: 'nutrition.fiber', unit: 'g' }]
function nutritionValue(value: number, grams: number, locale: string) { return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value * grams / 100) }
function NutritionEditor({ nutrition, setNutrition, grams, setGrams, foodName }: { nutrition: NutritionInput; setNutrition: Dispatch<SetStateAction<NutritionInput>>; grams: string; setGrams: (value: string) => void; foodName: string }) {
  const { locale, t } = useI18n()
  const amount = Math.max(0, Number(grams) || 0)
  return <section className="nutrition-editor"><div className="nutrition-head"><div><strong>{t('nutrition.title')}</strong><small>{t('nutrition.per100')}</small></div><a className="secondary" href="https://www.kaloricketabulky.cz/tabulka-potravin" target="_blank" rel="noreferrer" title={foodName ? t('nutrition.searchFood', { name: foodName }) : t('nutrition.openCatalog')}><ExternalLink size={15} />{t('nutrition.catalog')}</a></div><div className="nutrition-fields">{nutritionLabels.map(item => <Field label={t(item.labelKey)} key={item.key}><div className="number-with-unit"><input type="number" min="0" step="0.01" value={nutrition[item.key]} onChange={event => setNutrition(current => ({ ...current, [item.key]: event.target.value }))} placeholder="0" /><span>{item.unit}</span></div></Field>)}</div><div className="portion-row"><Field label={t('nutrition.forAmount')}><div className="number-with-unit"><input type="number" min="0" step="1" value={grams} onChange={event => setGrams(event.target.value)} /><span>g</span></div></Field><div className="nutrition-preview">{nutritionLabels.map(item => <span key={item.key}><small>{t(item.labelKey)}</small><strong>{nutritionValue(Number(nutrition[item.key]) || 0, amount, locale)} {item.unit}</strong></span>)}</div></div></section>
}
function NutritionInline({ nutrition, grams, onGrams }: { nutrition: NutritionValues; grams: number; onGrams: (grams: number) => void }) { const { locale, t } = useI18n(); return <span className="nutrition-inline"><span className="macro-grams"><input type="number" min="0" step="1" value={grams} onChange={event => onGrams(Number(event.target.value))} aria-label={t('nutrition.amountAria')} /> g</span><b>{nutritionValue(nutrition.kcal, grams, locale)} kcal</b><span title={t('nutrition.protein')}>B {nutritionValue(nutrition.protein, grams, locale)}</span><span title={t('nutrition.carbs')}>S {nutritionValue(nutrition.carbs, grams, locale)} <small>cukry {nutritionValue(nutrition.sugars ?? 0, grams, locale)}</small></span><span title={t('nutrition.fat')}>T {nutritionValue(nutrition.fat, grams, locale)}</span></span> }
function ProductIcon({ name, image, large }: { name: string; image?: string; large?: boolean }) { const [failed, setFailed] = useState(false); const n = name.toLowerCase(); const emoji = n.includes('mlék') ? '🥛' : n.includes('fazol') ? '🫘' : n.includes('losos') || n.includes('ryb') ? '🐟' : n.includes('kuř') ? '🍗' : n.includes('zelen') ? '🥦' : n.includes('vývar') || n.includes('polév') ? '🥣' : n.includes('olej') ? '🫒' : n.includes('těst') ? '🍝' : n.includes('pleny') || n.includes('ubrou') ? '🧸' : '📦'; return <span className={`product-icon ${large ? 'large' : ''}`}>{image && !failed ? <img src={image} alt="" onError={() => setFailed(true)} /> : emoji}</span> }
function Quantity({ value, unit, onMinus, onPlus, large }: { value: number; unit: Unit; onMinus: () => void; onPlus: () => void; large?: boolean }) { return <div className={`quantity ${large ? 'large' : ''}`}><button onClick={onMinus}><Minus size={15} /></button><strong>{value}<small>{unit}</small></strong><button onClick={onPlus}><Plus size={15} /></button></div> }
function Empty({ text }: { text: string }) { return <div className="empty"><CheckCircle2 size={22} /><span>{text}</span></div> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
function UnitSelect({ defaultValue }: { defaultValue?: Unit }) { return <select name="unit" defaultValue={defaultValue}>{units.map(u => <option key={u}>{u}</option>)}</select> }
function freezerProgress(item: FreezerItem) { const months = Math.max(0, daysBetween(item.frozenAt, today()) / 30.44); return months / item.recommendedMonths * 100 }

export default App
