import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { IScannerControls } from '@zxing/browser'
import {
  AlertTriangle, Archive, ArrowRight, CalendarDays, Check, CheckCircle2, ChefHat,
  ChevronRight, CircleDollarSign, ClipboardList, Clock3, Euro, Fish, LayoutDashboard,
  ListChecks, Menu, Minus, Moon, Package, Plus, ScanLine, Search, ShoppingBasket,
  Settings, Snowflake, Sparkles, Sun, Trash2, X,
} from 'lucide-react'
import { freezerGuide, initialData } from './data'
import type { AccentColor, AppData, Currency, FreezerItem, PantryItem, ShoppingItem, SiteSettings, Todo, Unit } from './types'

type Page = 'Přehled' | 'Zásoby' | 'Mrazák' | 'Nákupy' | 'Recepty' | 'Úkoly' | 'Nastavení'
type ModalKind = 'pantry' | 'freezer' | 'shopping' | 'todo' | 'scanner' | null

const STORE_KEY = 'domovka-data-v1'
const SETTINGS_KEY = 'grocy-homie-settings-v1'
const defaultSettings: SiteSettings = {
  householdName: 'Domácnost Novákových', theme: 'system', accent: 'coral', defaultCurrency: 'CZK',
  defaultLocation: 'Spíž', defaultCategory: 'Ostatní', defaultUnit: 'ks', defaultQuantity: 1, defaultMinimum: 1,
}
const accentColors: Record<AccentColor, { label: string; value: string; dark: string }> = {
  coral: { label: 'Korálová', value: '#e9694b', dark: '#c9543b' },
  green: { label: 'Šalvějová', value: '#668b70', dark: '#4d7057' },
  blue: { label: 'Modrá', value: '#5f93ab', dark: '#477b92' },
  plum: { label: 'Švestková', value: '#8a668f', dark: '#6e5073' },
}
const NAV: { label: Page; icon: typeof Package }[] = [
  { label: 'Přehled', icon: LayoutDashboard }, { label: 'Zásoby', icon: Package },
  { label: 'Mrazák', icon: Snowflake }, { label: 'Nákupy', icon: ShoppingBasket },
  { label: 'Recepty', icon: ChefHat }, { label: 'Úkoly', icon: ListChecks }, { label: 'Nastavení', icon: Settings },
]
const units: Unit[] = ['ks', 'bal.', 'kg', 'g', 'l', 'ml']
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
const today = () => new Date().toISOString().slice(0, 10)
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`)) : '—'
const daysBetween = (from: string, to: string) => Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000)
const householdInitials = (name: string) => name.replace(/^domácnost\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'GH'

const prepareThumbnail = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(new Error('Fotografii se nepodařilo načíst.'))
  reader.onload = () => {
    const image = new Image()
    image.onerror = () => reject(new Error('Tento formát obrázku nelze použít.'))
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
  const [page, setPage] = useState<Page>('Přehled')
  const [data, setData] = useState<AppData>(() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '') as AppData } catch { return initialData }
  })
  const [settings, setSettings] = useState<SiteSettings>(() => {
    try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '') } as SiteSettings }
    catch { return { ...defaultSettings, theme: localStorage.getItem('domovka-theme') === 'dark' ? 'dark' : 'system' } }
  })
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemDark)
  const [currency, setCurrency] = useState<Currency>(settings.defaultCurrency)
  const [rate, setRate] = useState(24.284)
  const [rateDate, setRateDate] = useState('14. 7. 2026')
  const [modal, setModal] = useState<ModalKind>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => localStorage.setItem(STORE_KEY, JSON.stringify(data)), [data])
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    const accent = accentColors[settings.accent]
    document.documentElement.style.setProperty('--brand', accent.value)
    document.documentElement.style.setProperty('--brand-dark', accent.dark)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [dark, settings])
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
        if (date) setRateDate(formatDate(date))
      }).catch(() => undefined)
  }, [])
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2600); return () => clearTimeout(timer) }, [toast])

  const money = (czk: number) => new Intl.NumberFormat('cs-CZ', { style: 'currency', currency, maximumFractionDigits: currency === 'CZK' ? 0 : 2 }).format(currency === 'CZK' ? czk : czk / rate)
  const lowItems = data.pantry.filter(i => i.quantity < i.minimum)
  const expiringItems = data.pantry.filter(i => i.expiresAt && daysBetween(today(), i.expiresAt) <= 7 && daysBetween(today(), i.expiresAt) >= 0)
  const freezerWarnings = data.freezer.filter(i => freezerProgress(i) >= 90)
  const pendingShopping = data.shoppingLists.filter(l => !l.archived).flatMap(l => l.items).filter(i => !i.checked).length
  const inventoryValue = data.pantry.reduce((sum, item) => sum + item.priceCzk * item.quantity, 0)

  const updatePantry = (id: string, delta: number) => setData(prev => ({ ...prev, pantry: prev.pantry.map(i => i.id === id ? { ...i, quantity: Math.max(0, +(i.quantity + delta).toFixed(2)) } : i) }))
  const removePantry = (id: string) => setData(prev => ({ ...prev, pantry: prev.pantry.filter(i => i.id !== id) }))
  const toggleTodo = (id: string) => setData(prev => ({ ...prev, todos: prev.todos.map(t => t.id === id ? { ...t, done: !t.done } : t) }))
  const notify = (text: string) => setToast(text)
  const go = (target: Page) => { setPage(target); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const pageContent: Record<Page, ReactNode> = {
    'Přehled': <Dashboard data={data} lowItems={lowItems} expiringItems={expiringItems} freezerWarnings={freezerWarnings} pendingShopping={pendingShopping} inventoryValue={inventoryValue} money={money} go={go} updatePantry={updatePantry} toggleTodo={toggleTodo} />,
    'Zásoby': <Pantry data={data} money={money} update={updatePantry} remove={removePantry} open={() => setModal('pantry')} />,
    'Mrazák': <Freezer data={data} setData={setData} open={() => setModal('freezer')} />,
    'Nákupy': <Shopping data={data} setData={setData} money={money} open={setModal} notify={notify} />,
    'Recepty': <Recipes data={data} setData={setData} notify={notify} go={go} />,
    'Úkoly': <Todos data={data} setData={setData} toggle={toggleTodo} open={() => setModal('todo')} />,
    'Nastavení': <SettingsPage settings={settings} setSettings={setSettings} setCurrency={setCurrency} notify={notify} />,
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}>
      <button className="mobile-close icon-btn" onClick={() => setMobileNav(false)} aria-label="Zavřít menu"><X size={20} /></button>
      <button className="brand" onClick={() => go('Přehled')}><span className="brand-mark"><Sparkles size={20} /></span><span>Grocy Homie<small>Všechno doma v klidu</small></span></button>
      <nav>{NAV.map(({ label, icon: Icon }) => <button key={label} className={page === label ? 'active' : ''} onClick={() => go(label)}><Icon size={19} /><span>{label}</span>{label === 'Zásoby' && lowItems.length > 0 && <b>{lowItems.length}</b>}</button>)}</nav>
      <div className="sidebar-card"><div className="sidebar-card-icon"><Archive size={18} /></div><div><strong>{data.pantry.length + data.freezer.length} položek</strong><span>ve vaší domácnosti</span></div></div>
      <div className="sidebar-foot"><button className="currency-toggle" onClick={() => setCurrency(currency === 'CZK' ? 'EUR' : 'CZK')}><Euro size={17} /><span>{currency}</span><small>1 EUR = {rate.toFixed(3)} Kč</small></button><button className="icon-btn" onClick={() => setSettings(s => ({ ...s, theme: dark ? 'light' : 'dark' }))} aria-label="Přepnout vzhled">{dark ? <Sun size={19} /> : <Moon size={19} />}</button></div>
    </aside>
    {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} />}
    <main>
      <header className="topbar"><button className="menu-btn icon-btn" onClick={() => setMobileNav(true)}><Menu size={21} /></button><div><span className="eyebrow">{settings.householdName}</span><h1>{page}</h1></div><div className="top-actions"><button className="search-button" onClick={() => setSearchOpen(true)}><Search size={18} /><span>Hledat…</span><kbd>⌘ K</kbd></button><button className="avatar">{householdInitials(settings.householdName)}</button></div></header>
      <div className="page-content">{pageContent[page]}</div>
      <footer>Grocy Homie · kurz ECB z {rateDate} · data jsou uložená v tomto prohlížeči</footer>
    </main>
    {modal && <Modal kind={modal} close={() => setModal(null)} data={data} setData={setData} notify={notify} settings={settings} />}
    {searchOpen && <GlobalSearch data={data} close={() => setSearchOpen(false)} go={target => { setSearchOpen(false); go(target) }} />}
    {toast && <div className="toast"><CheckCircle2 size={19} />{toast}</div>}
  </div>
}

function GlobalSearch({ data, close, go }: { data: AppData; close: () => void; go: (page: Page) => void }) {
  const [query, setQuery] = useState('')
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const results = useMemo(() => {
    const all: { id: string; page: Page; title: string; meta: string; search: string }[] = [
      ...data.pantry.map(item => ({ id: `p-${item.id}`, page: 'Zásoby' as Page, title: item.name, meta: `${item.category} · ${item.location} · ${item.quantity} ${item.unit}`, search: [item.name, item.category, item.location, item.barcode].join(' ') })),
      ...data.freezer.map(item => ({ id: `f-${item.id}`, page: 'Mrazák' as Page, title: item.name, meta: `${item.category} · ${item.quantity} ${item.unit}`, search: [item.name, item.category, item.note].join(' ') })),
      ...data.shoppingLists.flatMap(list => list.items.map(item => ({ id: `s-${list.id}-${item.id}`, page: 'Nákupy' as Page, title: item.name, meta: `${list.name} · ${list.type}${list.archived ? ' · archiv' : ''}`, search: [item.name, list.name, list.type].join(' ') }))),
      ...data.recipes.map(recipe => ({ id: `r-${recipe.id}`, page: 'Recepty' as Page, title: recipe.name, meta: `${recipe.minutes} min · ${recipe.tags.join(', ')}`, search: [recipe.name, recipe.tags.join(' '), recipe.instructions, recipe.ingredients.map(i => i.name).join(' ')].join(' ') })),
      ...data.todos.map(todo => ({ id: `t-${todo.id}`, page: 'Úkoly' as Page, title: todo.title, meta: `${todo.category} · ${formatDate(todo.date)}`, search: [todo.title, todo.category].join(' ') })),
    ]
    const needle = normalize(query.trim())
    return needle ? all.filter(item => normalize(item.search).includes(needle)).slice(0, 40) : []
  }, [data, query])
  return <div className="search-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><section className="global-search"><div className="global-search-input"><Search size={21} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Hledat v zásobách, nákupech, receptech a úkolech…" /><button className="icon-btn" onClick={close}><X size={18} /></button></div><div className="search-results">{!query.trim() ? <div className="search-empty"><Search size={28} /><strong>Prohledejte celý Grocy Homie</strong><span>Fungují názvy, kategorie, EAN, ingredience, obchody i úkoly.</span></div> : results.length ? results.map(result => <button key={result.id} onClick={() => go(result.page)}><span className="search-result-icon"><Search size={16} /></span><span className="grow"><strong>{result.title}</strong><small>{result.meta}</small></span><span>{result.page}</span><ChevronRight size={17} /></button>) : <div className="search-empty"><Search size={28} /><strong>Nic jsme nenašli</strong><span>Zkuste kratší nebo obecnější výraz.</span></div>}</div><footer><span><kbd>Esc</kbd> zavřít</span><span>{results.length ? `${results.length} výsledků` : 'Ctrl/⌘ + K'}</span></footer></section></div>
}

function SettingsPage({ settings, setSettings, setCurrency, notify }: { settings: SiteSettings; setSettings: React.Dispatch<React.SetStateAction<SiteSettings>>; setCurrency: (currency: Currency) => void; notify: (text: string) => void }) {
  const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => setSettings(current => ({ ...current, [key]: value }))
  const reset = () => { setSettings(defaultSettings); setCurrency(defaultSettings.defaultCurrency); notify('Výchozí nastavení bylo obnoveno') }
  return <><PageIntro title="Nastavení Grocy Homie" subtitle="Přizpůsobte vzhled domácnosti a předvyplněné hodnoty nových položek." button="Obnovit výchozí" icon={<Settings />} onClick={reset} />
    <div className="settings-grid">
      <section className="settings-card"><div className="settings-card-head"><Settings size={20} /><div><h3>Domácnost</h3><p>Název se zobrazí v záhlaví na všech zařízeních.</p></div></div><Field label="Název domácnosti"><input value={settings.householdName} onChange={event => update('householdName', event.target.value)} placeholder="např. U Nováků" /></Field><Field label="Výchozí měna"><select value={settings.defaultCurrency} onChange={event => { const value = event.target.value as Currency; update('defaultCurrency', value); setCurrency(value) }}><option value="CZK">CZK — česká koruna</option><option value="EUR">EUR — euro</option></select></Field></section>
      <section className="settings-card"><div className="settings-card-head"><Sun size={20} /><div><h3>Vzhled</h3><p>Režim a hlavní barva ovládacích prvků.</p></div></div><span className="setting-label">Barevný režim</span><div className="theme-options">{([['system','Podle zařízení'],['light','Světlý'],['dark','Tmavý']] as const).map(([value, label]) => <button key={value} className={settings.theme === value ? 'active' : ''} onClick={() => update('theme', value)}>{value === 'dark' ? <Moon size={17} /> : value === 'light' ? <Sun size={17} /> : <Settings size={17} />}{label}</button>)}</div><span className="setting-label">Akcentní barva</span><div className="accent-options">{(Object.entries(accentColors) as [AccentColor, typeof accentColors[AccentColor]][]).map(([key, color]) => <button key={key} className={settings.accent === key ? 'active' : ''} onClick={() => update('accent', key)}><i style={{ background: color.value }} />{color.label}{settings.accent === key && <Check size={14} />}</button>)}</div></section>
      <section className="settings-card span-2"><div className="settings-card-head"><Package size={20} /><div><h3>Výchozí hodnoty zásob</h3><p>Automaticky se předvyplní při každém přidání nové položky.</p></div></div><div className="settings-defaults"><Field label="Kategorie"><input value={settings.defaultCategory} onChange={event => update('defaultCategory', event.target.value)} placeholder="Ostatní" /></Field><Field label="Umístění"><select value={settings.defaultLocation} onChange={event => update('defaultLocation', event.target.value as PantryItem['location'])}><option>Spíž</option><option>Lednice</option><option>Koupelna</option><option>Drogerie</option></select></Field><Field label="Jednotka"><select value={settings.defaultUnit} onChange={event => update('defaultUnit', event.target.value as Unit)}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></Field><Field label="Množství"><input type="number" min="0" step="0.1" value={settings.defaultQuantity} onChange={event => update('defaultQuantity', Number(event.target.value))} /></Field><Field label="Kanban minimum"><input type="number" min="0" step="0.1" value={settings.defaultMinimum} onChange={event => update('defaultMinimum', Number(event.target.value))} /></Field></div><div className="settings-note"><CheckCircle2 size={17} />Změny se ukládají automaticky v tomto prohlížeči.</div></section>
    </div>
  </>
}

function Dashboard({ data, lowItems, expiringItems, freezerWarnings, pendingShopping, inventoryValue, money, go, updatePantry, toggleTodo }: {
  data: AppData; lowItems: PantryItem[]; expiringItems: PantryItem[]; freezerWarnings: FreezerItem[]; pendingShopping: number; inventoryValue: number; money: (n: number) => string; go: (p: Page) => void; updatePantry: (id: string, d: number) => void; toggleTodo: (id: string) => void
}) {
  const todayTodos = data.todos.filter(t => t.date <= today() && !t.done)
  return <>
    <section className="welcome"><div><span className="eyebrow">{new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span><h2>Dobré odpoledne 👋</h2><p>{lowItems.length ? `Ve spíži dochází ${lowItems.length} ${lowItems.length === 1 ? 'položka' : 'položky'}.` : 'Zásoby vypadají dobře.'} Pojďme udržet domácnost v klidu.</p></div><button className="primary" onClick={() => go('Nákupy')}><ShoppingBasket size={18} />Otevřít nákup</button></section>
    <section className="stats-grid">
      <Stat icon={<Package />} tone="coral" label="Zásoby" value={`${data.pantry.length} položek`} note={`${lowItems.length} pod minimem`} warning={lowItems.length > 0} onClick={() => go('Zásoby')} />
      <Stat icon={<Snowflake />} tone="blue" label="Mrazák" value={`${data.freezer.length} položek`} note={`${freezerWarnings.length} brzy spotřebovat`} warning={freezerWarnings.length > 0} onClick={() => go('Mrazák')} />
      <Stat icon={<ShoppingBasket />} tone="green" label="Nákup" value={`${pendingShopping} zbývá`} note={`${data.shoppingLists.filter(list => !list.archived).length} aktivní seznamy`} onClick={() => go('Nákupy')} />
      <Stat icon={<CircleDollarSign />} tone="gold" label="Hodnota zásob" value={money(inventoryValue)} note="orientační součet" />
    </section>
    {(lowItems.length > 0 || expiringItems.length > 0) && <section className="alert-strip"><AlertTriangle size={20} /><div><strong>Vyžaduje pozornost</strong><span>{lowItems.length} položky pod minimem · {expiringItems.length} položky brzy expirují</span></div><button onClick={() => go('Zásoby')}>Zkontrolovat <ArrowRight size={16} /></button></section>}
    <div className="dashboard-grid">
      <section className="panel"><PanelHead title="Kanban zásob" subtitle="Položky, které je čas doplnit" action="Všechny zásoby" onClick={() => go('Zásoby')} />
        <div className="compact-list">{lowItems.slice(0, 4).map(item => <div className="compact-row" key={item.id}><ProductIcon name={item.name} /><div className="grow"><strong>{item.name}</strong><span>{item.location} · minimum {item.minimum} {item.unit}</span></div><Quantity value={item.quantity} unit={item.unit} onMinus={() => updatePantry(item.id, -1)} onPlus={() => updatePantry(item.id, 1)} /></div>)}{!lowItems.length && <Empty text="Všechny zásoby jsou nad minimem." />}</div>
      </section>
      <section className="panel"><PanelHead title="Dnešní úkoly" subtitle={`${todayTodos.length} čeká na dokončení`} action="Kalendář" onClick={() => go('Úkoly')} />
        <div className="todo-mini">{data.todos.filter(t => !t.done).slice(0, 4).map(t => <label key={t.id}><input type="checkbox" checked={t.done} onChange={() => toggleTodo(t.id)} /><span className="custom-check"><Check size={14} /></span><span><strong>{t.title}</strong><small>{formatDate(t.date)} · {t.category}</small></span></label>)}{!todayTodos.length && <Empty text="Na dnešek je hotovo." />}</div>
      </section>
      <section className="panel span-2"><PanelHead title="Co se děje doma" subtitle="Rychlý přehled termínů a zásob" />
        <div className="timeline">
          {freezerWarnings.slice(0, 2).map(i => <div key={i.id}><span className="timeline-icon blue"><Snowflake size={17} /></span><div><strong>{i.name} je čas spotřebovat</strong><small>V mrazáku od {formatDate(i.frozenAt)} · {Math.round(freezerProgress(i))} % doporučené doby</small></div><button onClick={() => go('Mrazák')}><ChevronRight /></button></div>)}
          {expiringItems.slice(0, 2).map(i => <div key={i.id}><span className="timeline-icon coral"><Clock3 size={17} /></span><div><strong>{i.name} brzy expiruje</strong><small>Spotřebujte do {formatDate(i.expiresAt)}</small></div><button onClick={() => go('Zásoby')}><ChevronRight /></button></div>)}
          {!freezerWarnings.length && !expiringItems.length && <Empty text="Žádné blížící se termíny." />}
        </div>
      </section>
    </div>
  </>
}

function Pantry({ data, money, update, remove, open }: { data: AppData; money: (n: number) => string; update: (id: string, d: number) => void; remove: (id: string) => void; open: () => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('Vše')
  const locations = ['Vše', 'Spíž', 'Lednice', 'Koupelna', 'Drogerie']
  const items = data.pantry.filter(i => (filter === 'Vše' || i.location === filter) && i.name.toLowerCase().includes(query.toLowerCase()))
  return <>
    <PageIntro title="Co máme doma" subtitle="Mějte přehled, doplňujte jediným kliknutím a nic vám nedojde." button="Přidat položku" icon={<Plus />} onClick={open} />
    <div className="toolbar"><label className="input-search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Hledat v zásobách…" /></label><div className="chips">{locations.map(l => <button key={l} className={filter === l ? 'active' : ''} onClick={() => setFilter(l)}>{l}</button>)}</div></div>
    <div className="inventory-grid">{items.map(item => {
      const low = item.quantity < item.minimum
      const expiryDays = item.expiresAt ? daysBetween(today(), item.expiresAt) : null
      return <article className={`inventory-card ${low ? 'is-low' : ''}`} key={item.id}><div className="card-top"><ProductIcon name={item.name} image={item.image} large /><div className="card-badges">{low && <span className="badge danger">Doplnit</span>}{expiryDays !== null && expiryDays <= 7 && <span className="badge warning">{expiryDays < 0 ? 'Po datu' : `${expiryDays} dny`}</span>}</div></div><h3>{item.name}</h3><p>{item.category} · {item.location}</p><Quantity value={item.quantity} unit={item.unit} onMinus={() => update(item.id, -1)} onPlus={() => update(item.id, 1)} large /><div className="minimum-line"><span>Kanban minimum</span><strong>{item.minimum} {item.unit}</strong></div><div className="progress"><i style={{ width: `${Math.min(100, item.quantity / Math.max(item.minimum, 1) * 100)}%` }} /></div><div className="card-meta"><span>{money(item.priceCzk)} / {item.unit}</span><span>{item.expiresAt ? `do ${formatDate(item.expiresAt)}` : 'bez expirace'}</span></div><button className="delete-button" onClick={() => remove(item.id)} aria-label="Smazat"><Trash2 size={16} /></button></article>
    })}</div>{!items.length && <Empty text="Žádná položka neodpovídá filtru." />}
  </>
}

function Freezer({ data, setData, open }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; open: () => void }) {
  const remove = (id: string) => setData(p => ({ ...p, freezer: p.freezer.filter(i => i.id !== id) }))
  return <>
    <PageIntro title="Mrazák bez překvapení" subtitle="Doporučené doby při −18 °C hlídají nejlepší kvalitu potravin." button="Přidat do mrazáku" icon={<Plus />} onClick={open} />
    <div className="info-banner"><Snowflake size={21} /><div><strong>Dobré vědět</strong><span>Potraviny trvale skladované při −18 °C zůstávají bezpečné téměř neomezeně. Níže hlídáme doporučenou dobu pro nejlepší chuť a kvalitu.</span></div></div>
    <div className="freezer-layout"><section className="freezer-list"><h3>Obsah mrazáku <span>{data.freezer.length}</span></h3>{data.freezer.map(item => { const progress = freezerProgress(item); return <article className="freezer-row" key={item.id}><ProductIcon name={item.name} /><div className="grow"><div className="row-title"><strong>{item.name}</strong>{progress >= 100 ? <span className="badge danger">Spotřebovat</span> : progress >= 75 ? <span className="badge warning">Brzy</span> : <span className="badge success">V pořádku</span>}</div><span>{item.quantity} {item.unit} · {item.category}{item.note ? ` · ${item.note}` : ''}</span><div className="freshness"><i className={progress >= 100 ? 'danger' : progress >= 75 ? 'warning' : ''} style={{ width: `${Math.min(100, progress)}%` }} /></div><small>Zmraženo {formatDate(item.frozenAt)} · doporučeno {item.recommendedMonths} měs.</small></div><button className="icon-btn" onClick={() => remove(item.id)}><Trash2 size={16} /></button></article>})}</section>
      <aside className="guide"><div className="guide-head"><Fish size={20} /><div><h3>Průvodce mražením</h3><p>Doporučení pro kvalitu</p></div></div>{freezerGuide.map(g => <div className="guide-row" key={g.category}><span>{g.icon}</span><strong>{g.category}</strong><b>{g.months} měs.</b></div>)}<a href="https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/freezing-and-food-safety" target="_blank" rel="noreferrer">Zdroj: USDA Food Safety <ArrowRight size={14} /></a></aside>
    </div>
  </>
}

function Shopping({ data, setData, money, open, notify }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; money: (n: number) => string; open: (m: ModalKind) => void; notify: (s: string) => void }) {
  const activeLists = data.shoppingLists.filter(l => !l.archived)
  const archivedLists = data.shoppingLists.filter(l => l.archived)
  const [active, setActive] = useState(activeLists[0]?.id ?? '')
  const [showArchived, setShowArchived] = useState(false)
  const list = activeLists.find(l => l.id === active) ?? activeLists[0]
  useEffect(() => { if (list && list.id !== active) setActive(list.id) }, [active, list])
  const archiveList = () => {
    if (!list) return
    setData(p => ({ ...p, shoppingLists: p.shoppingLists.map(l => l.id === list.id ? { ...l, archived: true } : l) }))
    notify(`Seznam „${list.name}“ byl archivován`)
  }
  const restoreList = (id: string) => {
    setData(p => ({ ...p, shoppingLists: p.shoppingLists.map(l => l.id === id ? { ...l, archived: false } : l) }))
    setActive(id); setShowArchived(false); notify('Seznam byl obnoven')
  }
  if (!list) return <><PageIntro title="Nákupy pod kontrolou" subtitle="Všechny aktivní seznamy jsou archivované." button="Přidat položku" icon={<Plus />} onClick={() => notify('Nejprve obnovte seznam z archivu.')} /><ArchivedLists lists={archivedLists} restore={restoreList} /></>
  const toggle = (id: string) => setData(p => ({ ...p, shoppingLists: p.shoppingLists.map(l => l.id !== list.id ? l : { ...l, items: l.items.map(i => i.id === id ? { ...i, checked: !i.checked } : i) }) }))
  const finish = () => {
    const purchased = list.items.filter(i => i.checked && i.addToPantry)
    setData(p => ({ ...p, pantry: [...p.pantry, ...purchased.map<PantryItem>(i => ({ id: uid(), name: i.name, category: 'Z nákupu', location: 'Spíž', quantity: i.quantity, minimum: i.kanbanMinimum ?? 0, unit: i.unit, priceCzk: i.priceCzk ?? 0, purchasedAt: today() }))], shoppingLists: p.shoppingLists.map(l => l.id === list.id ? { ...l, items: l.items.filter(i => !i.checked) } : l) }))
    notify(`${purchased.length} položek přidáno do domácích zásob`)
  }
  const total = list.items.reduce((s, i) => s + (i.priceCzk ?? 0) * i.quantity, 0)
  return <>
    <PageIntro title="Nákupy pod kontrolou" subtitle="Seznamy podle obchodů, rychlé odškrtávání a přenos rovnou do zásob." button="Přidat položku" icon={<Plus />} onClick={() => open('shopping')} />
    <div className="shopping-tabs">{activeLists.map(l => <button key={l.id} className={l.id === list.id ? 'active' : ''} onClick={() => setActive(l.id)}><i style={{ background: l.color }} /><span><strong>{l.name}</strong><small>{l.type} · {l.items.filter(i => !i.checked).length} zbývá</small></span></button>)}<button className="new-list"><Plus size={17} />Nový seznam</button>{archivedLists.length > 0 && <button className="archive-tab" onClick={() => setShowArchived(!showArchived)}><Archive size={17} />Archiv ({archivedLists.length})</button>}</div>
    {showArchived && <ArchivedLists lists={archivedLists} restore={restoreList} />}
    <section className="shopping-panel"><div className="shopping-head"><div><span className="list-dot" style={{ background: list.color }} /><div><h2>{list.name}</h2><p>{list.type}</p></div></div><div className="shopping-head-actions"><button className="secondary" onClick={archiveList}><Archive size={17} />Archivovat</button><button className="secondary" onClick={() => open('scanner')}><ScanLine size={18} />Skenovat kód</button></div></div>
      <div className="shopping-progress"><div><span>Průběh nákupu</span><strong>{list.items.filter(i => i.checked).length} / {list.items.length}</strong></div><div className="progress"><i style={{ width: `${list.items.length ? list.items.filter(i => i.checked).length / list.items.length * 100 : 0}%` }} /></div></div>
      <div className="shopping-items">{list.items.map(item => <label key={item.id} className={item.checked ? 'checked' : ''}><input type="checkbox" checked={item.checked} onChange={() => toggle(item.id)} /><span className="custom-check"><Check size={16} /></span><ProductIcon name={item.name} /><span className="grow"><strong>{item.name}</strong><small>{item.quantity} {item.unit}{item.addToPantry ? ' · přidat do zásob' : ''}</small></span><span className="item-price">{item.priceCzk ? money(item.priceCzk * item.quantity) : 'zadat cenu'}</span></label>)}</div>
      <div className="shopping-summary"><div><span>Průběžná útrata</span><strong>{money(total)}</strong></div><button className="primary" disabled={!list.items.some(i => i.checked)} onClick={finish}><CheckCircle2 size={18} />Dokončit nákup</button></div>
    </section>
  </>
}

function ArchivedLists({ lists, restore }: { lists: AppData['shoppingLists']; restore: (id: string) => void }) {
  return <section className="archived-lists"><div><Archive size={19} /><span><strong>Archivované seznamy</strong><small>Uchované pro pozdější použití</small></span></div>{lists.map(list => <article key={list.id}><i style={{ background: list.color }} /><span className="grow"><strong>{list.name}</strong><small>{list.type} · {list.items.length} položek</small></span><button className="secondary" onClick={() => restore(list.id)}>Obnovit</button></article>)}</section>
}

function Recipes({ data, setData, notify, go }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; notify: (s: string) => void; go: (p: Page) => void }) {
  const [query, setQuery] = useState('')
  const recipes = data.recipes.filter(r => r.name.toLowerCase().includes(query.toLowerCase()))
  const addIngredients = (id: string) => {
    const recipe = data.recipes.find(r => r.id === id)!
    const items: ShoppingItem[] = recipe.ingredients.map(i => ({ id: uid(), name: i.name, quantity: 1, unit: 'ks', checked: false, addToPantry: false }))
    setData(p => ({ ...p, shoppingLists: p.shoppingLists.map((l, n) => n === 0 ? { ...l, items: [...l.items, ...items] } : l) }))
    notify(`Ingredience pro „${recipe.name}“ přidány na nákup`); go('Nákupy')
  }
  return <><PageIntro title="Co dnes uvaříme?" subtitle="Oblíbené recepty propojené s nákupem a domácími zásobami." button="Nový recept" icon={<Plus />} onClick={() => notify('Editor receptu připravujeme do další verze')} />
    <label className="input-search wide"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Hledat recept nebo ingredienci…" /></label>
    <div className="recipe-grid">{recipes.map(recipe => <article className="recipe-card" key={recipe.id}><div className="recipe-cover"><span>{recipe.emoji}</span><button className={recipe.favorite ? 'favorite' : ''} onClick={() => setData(p => ({ ...p, recipes: p.recipes.map(r => r.id === recipe.id ? { ...r, favorite: !r.favorite } : r) }))}>♥</button></div><div className="recipe-body"><div className="tag-row">{recipe.tags.map(t => <span key={t}>{t}</span>)}</div><h3>{recipe.name}</h3><p><Clock3 size={15} />{recipe.minutes} min <span>·</span> {recipe.servings} porce</p><div className="ingredients-preview">{recipe.ingredients.slice(0, 3).map(i => <span key={i.name}>{i.name} <b>{i.amount}</b></span>)}</div><button className="secondary full" onClick={() => addIngredients(recipe.id)}><ShoppingBasket size={17} />Přidat ingredience na nákup</button></div></article>)}</div>
  </>
}

function Todos({ data, setData, toggle, open }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; toggle: (id: string) => void; open: () => void }) {
  const [selected, setSelected] = useState(today())
  const monthDays = useMemo(() => {
    const base = new Date(`${selected}T12:00:00`); const y = base.getFullYear(), m = base.getMonth(); const first = new Date(y, m, 1); const start = new Date(y, m, 1 - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  }, [selected])
  const selectedTasks = data.todos.filter(t => t.date === selected)
  return <><PageIntro title="Co je potřeba zařídit" subtitle="Úkoly domácnosti na jednom místě a v souvislostech." button="Přidat úkol" icon={<Plus />} onClick={open} />
    <div className="todo-layout"><section className="calendar-panel"><div className="calendar-head"><button onClick={() => { const d = new Date(selected); d.setMonth(d.getMonth() - 1); setSelected(d.toISOString().slice(0, 10)) }}>‹</button><h3>{new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric' }).format(new Date(selected))}</h3><button onClick={() => { const d = new Date(selected); d.setMonth(d.getMonth() + 1); setSelected(d.toISOString().slice(0, 10)) }}>›</button></div><div className="weekdays">{['Po','Út','St','Čt','Pá','So','Ne'].map(d => <span key={d}>{d}</span>)}</div><div className="calendar-grid">{monthDays.map(d => { const iso = d.toISOString().slice(0, 10); const currentMonth = d.getMonth() === new Date(selected).getMonth(); const has = data.todos.some(t => t.date === iso); return <button key={iso} className={`${iso === selected ? 'selected' : ''} ${iso === today() ? 'today' : ''} ${!currentMonth ? 'muted' : ''}`} onClick={() => setSelected(iso)}><span>{d.getDate()}</span>{has && <i />}</button> })}</div></section>
      <section className="tasks-panel"><div className="tasks-head"><div><span className="eyebrow">Vybraný den</span><h3>{formatDate(selected)}</h3></div><span>{selectedTasks.length} úkoly</span></div>{selectedTasks.map(t => <div className={`task-row ${t.done ? 'done' : ''}`} key={t.id}><button className="task-check" onClick={() => toggle(t.id)}>{t.done && <Check size={15} />}</button><div className="grow"><strong>{t.title}</strong><span className={`category ${t.category.toLowerCase()}`}>{t.category}</span></div><button className="icon-btn" onClick={() => setData(p => ({ ...p, todos: p.todos.filter(x => x.id !== t.id) }))}><Trash2 size={16} /></button></div>)}{!selectedTasks.length && <Empty text="Na tento den nic nemáte." />}</section></div>
  </>
}

function Modal({ kind, close, data, setData, notify, settings }: { kind: Exclude<ModalKind, null>; close: () => void; data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; notify: (s: string) => void; settings: SiteSettings }) {
  const [scannerOpen, setScannerOpen] = useState(false)
  const [barcode, setBarcode] = useState('')
  const [image, setImage] = useState<string>()
  const [imageError, setImageError] = useState('')
  const categories = [...new Set(['Konzervy', 'Přílohy', 'Mléčné výrobky', 'Maso', 'Ryby', 'Ovoce', 'Zelenina', 'Pečivo', 'Nápoje', 'Koření', 'Vaření', 'Dětské', 'Drogerie', ...data.pantry.map(i => i.category)])].sort((a, b) => a.localeCompare(b, 'cs'))
  const chooseImage = async (file?: File) => {
    if (!file) return
    setImageError('')
    try { setImage(await prepareThumbnail(file)) } catch (error) { setImageError(error instanceof Error ? error.message : 'Fotografii se nepodařilo načíst.') }
  }
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    if (kind === 'pantry') {
      const item: PantryItem = { id: uid(), name: String(f.get('name')), category: String(f.get('category') || 'Ostatní'), location: String(f.get('location')) as PantryItem['location'], quantity: Number(f.get('quantity')), minimum: Number(f.get('minimum')), unit: String(f.get('unit')) as Unit, priceCzk: Number(f.get('price')), purchasedAt: String(f.get('purchasedAt')), expiresAt: String(f.get('expiresAt')) || undefined, barcode: barcode || undefined, image }
      setData(p => ({ ...p, pantry: [item, ...p.pantry] })); notify('Položka přidána do zásob')
    } else if (kind === 'freezer') {
      const category = String(f.get('category')); const guide = freezerGuide.find(g => g.category === category)
      const item: FreezerItem = { id: uid(), name: String(f.get('name')), category, quantity: Number(f.get('quantity')), unit: String(f.get('unit')) as Unit, frozenAt: String(f.get('frozenAt')), recommendedMonths: guide?.max ?? Number(f.get('months')) ?? 6, note: String(f.get('note')) || undefined }
      setData(p => ({ ...p, freezer: [item, ...p.freezer] })); notify('Položka přidána do mrazáku')
    } else if (kind === 'shopping') {
      const listId = String(f.get('list')); const item: ShoppingItem = { id: uid(), name: String(f.get('name')), quantity: Number(f.get('quantity')), unit: String(f.get('unit')) as Unit, checked: false, priceCzk: Number(f.get('price')) || undefined, addToPantry: f.get('addToPantry') === 'on', kanbanMinimum: Number(f.get('minimum')) || undefined }
      setData(p => ({ ...p, shoppingLists: p.shoppingLists.map(l => l.id === listId ? { ...l, items: [...l.items, item] } : l) })); notify('Položka přidána na nákup')
    } else if (kind === 'todo') {
      const task: Todo = { id: uid(), title: String(f.get('title')), date: String(f.get('date')), done: false, category: String(f.get('category')) as Todo['category'] }
      setData(p => ({ ...p, todos: [...p.todos, task] })); notify('Úkol přidán')
    }
    close()
  }
  const titles = { pantry: 'Přidat do zásob', freezer: 'Přidat do mrazáku', shopping: 'Přidat na nákup', todo: 'Nový úkol', scanner: 'Skenovat kód' }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><div className="modal"><div className="modal-head"><div><span className="eyebrow">Grocy Homie</span><h2>{titles[kind]}</h2></div><button className="icon-btn" onClick={close}><X size={20} /></button></div>
    {kind === 'scanner' ? <BarcodeScanner onDetected={code => { notify(`Naskenován kód ${code}`); close() }} /> : <form onSubmit={submit}>
      {kind === 'pantry' && <><Field label="Název"><input name="name" required autoFocus placeholder="např. Červené fazole" /></Field><div className="form-grid"><Field label="Kategorie"><input name="category" list="pantry-categories" defaultValue={settings.defaultCategory} placeholder="Vyberte nebo napište novou" /><datalist id="pantry-categories">{categories.map(category => <option value={category} key={category} />)}</datalist></Field><Field label="Umístění"><select name="location" defaultValue={settings.defaultLocation}><option>Spíž</option><option>Lednice</option><option>Koupelna</option><option>Drogerie</option></select></Field><Field label="Množství"><input name="quantity" type="number" min="0" step="0.1" defaultValue={settings.defaultQuantity} required /></Field><Field label="Jednotka"><UnitSelect defaultValue={settings.defaultUnit} /></Field><Field label="Kanban minimum"><input name="minimum" type="number" min="0" step="0.1" defaultValue={settings.defaultMinimum} required /></Field><Field label="Cena v Kč"><input name="price" type="number" min="0" step="0.01" defaultValue="0" /></Field><Field label="Datum nákupu"><input name="purchasedAt" type="date" defaultValue={today()} required /></Field><Field label="Spotřebovat do (volitelně)"><input name="expiresAt" type="date" /></Field></div><Field label="EAN / čárový kód"><div className="input-with-action"><input value={barcode} onChange={e => setBarcode(e.target.value)} inputMode="numeric" placeholder="859…" /><button type="button" className="secondary" onClick={() => setScannerOpen(true)}><ScanLine size={17} />Skenovat</button></div></Field>{scannerOpen && <BarcodeScanner onDetected={code => { setBarcode(code); setScannerOpen(false); notify(`EAN ${code} načten`) }} onCancel={() => setScannerOpen(false)} compact />}<Field label="Vlastní fotografie"><label className="photo-upload"><input type="file" accept="image/*" capture="environment" onChange={e => chooseImage(e.target.files?.[0])} /><span className="photo-preview">{image ? <img src={image} alt="Náhled produktu" /> : <><Plus size={20} /><small>Vyfotit nebo vybrat obrázek</small></>}</span>{image && <span>Změnit fotografii</span>}</label>{imageError && <small className="field-error">{imageError}</small>}</Field></>}
      {kind === 'freezer' && <><Field label="Název"><input name="name" required autoFocus placeholder="např. Kuřecí stehna" /></Field><Field label="Kategorie a doporučená doba"><select name="category">{freezerGuide.map(g => <option key={g.category}>{g.category}</option>)}</select></Field><div className="form-grid"><Field label="Množství"><input name="quantity" type="number" min="0" step="0.1" defaultValue="1" required /></Field><Field label="Jednotka"><UnitSelect /></Field><Field label="Datum zmrazení"><input name="frozenAt" type="date" defaultValue={today()} required /></Field><Field label="Poznámka"><input name="note" placeholder="např. porce 500 g" /></Field></div></>}
      {kind === 'shopping' && <><Field label="Seznam"><select name="list">{data.shoppingLists.filter(l => !l.archived).map(l => <option value={l.id} key={l.id}>{l.name} · {l.type}</option>)}</select></Field><Field label="Název"><input name="name" required autoFocus placeholder="Co koupit?" /></Field><div className="form-grid"><Field label="Množství"><input name="quantity" type="number" min="0" step="0.1" defaultValue="1" /></Field><Field label="Jednotka"><UnitSelect /></Field><Field label="Odhad ceny v Kč"><input name="price" type="number" min="0" step="0.01" /></Field><Field label="Kanban minimum"><input name="minimum" type="number" min="0" step="1" /></Field></div><label className="switch-row"><input type="checkbox" name="addToPantry" defaultChecked /><span />Po nákupu přidat do domácích zásob</label></>}
      {kind === 'todo' && <><Field label="Co je potřeba udělat?"><input name="title" required autoFocus placeholder="např. Uklidit lednici" /></Field><div className="form-grid"><Field label="Datum"><input name="date" type="date" defaultValue={today()} required /></Field><Field label="Kategorie"><select name="category"><option>Domácnost</option><option>Nákup</option><option>Rodina</option><option>Jiné</option></select></Field></div></>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={close}>Zrušit</button><button className="primary" type="submit"><Plus size={18} />Přidat</button></div>
    </form>}
  </div></div>
}

function BarcodeScanner({ onDetected, onCancel, compact }: { onDetected: (code: string) => void; onCancel?: () => void; compact?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('Namiřte zadní kameru na čárový nebo QR kód.')
  const secure = window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname)
  const stop = () => { controlsRef.current?.stop(); controlsRef.current = null; setRunning(false) }
  useEffect(() => stop, [])
  const start = async () => {
    if (!secure || !navigator.mediaDevices?.getUserMedia) { setMessage('Kamera vyžaduje otevření aplikace přes HTTPS. Zatím můžete EAN zadat ručně.'); return }
    setMessage('Povolte kameru a podržte kód uvnitř rámečku.'); setRunning(true)
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
      setMessage(name === 'NotAllowedError' ? 'Přístup ke kameře nebyl povolen. Povolte jej v nastavení prohlížeče.' : 'Kameru se nepodařilo spustit. Zkontrolujte, zda ji nepoužívá jiná aplikace.')
    }
  }
  const scanPhoto = async (file?: File) => {
    if (!file) return
    const url = URL.createObjectURL(file); setMessage('Rozpoznávám kód z fotografie…')
    try { const { BrowserMultiFormatReader } = await import('@zxing/browser'); const result = await new BrowserMultiFormatReader().decodeFromImageUrl(url); onDetected(result.getText()) }
    catch { setMessage('Na fotografii se nepodařilo najít kód. Zkuste jej vyfotit zblízka a bez odlesku.') }
    finally { URL.revokeObjectURL(url) }
  }
  return <div className={`scanner ${compact ? 'compact' : ''}`}><div className={`scanner-frame ${running ? 'scanning' : ''}`}><video ref={videoRef} muted playsInline />{!running && <ScanLine size={46} />}<span>{message}</span></div><div className="scanner-actions">{running ? <button type="button" className="secondary" onClick={stop}><X size={17} />Zastavit</button> : <button type="button" className="primary" onClick={start}><ScanLine size={17} />Živá kamera</button>}<label className="secondary capture-code"><input type="file" accept="image/*" capture="environment" onChange={e => scanPhoto(e.target.files?.[0])} /><ScanLine size={17} />Vyfotit kód</label>{onCancel && <button type="button" className="secondary" onClick={() => { stop(); onCancel() }}>Zavřít</button>}</div></div>
}

function Stat({ icon, tone, label, value, note, warning, onClick }: { icon: ReactNode; tone: string; label: string; value: string; note: string; warning?: boolean; onClick?: () => void }) { return <button className="stat-card" onClick={onClick}><span className={`stat-icon ${tone}`}>{icon}</span><span><small>{label}</small><strong>{value}</strong><em className={warning ? 'warn' : ''}>{warning && <AlertTriangle size={12} />}{note}</em></span>{onClick && <ChevronRight className="stat-arrow" size={18} />}</button> }
function PanelHead({ title, subtitle, action, onClick }: { title: string; subtitle: string; action?: string; onClick?: () => void }) { return <div className="panel-head"><div><h3>{title}</h3><p>{subtitle}</p></div>{action && <button onClick={onClick}>{action}<ChevronRight size={15} /></button>}</div> }
function PageIntro({ title, subtitle, button, icon, onClick }: { title: string; subtitle: string; button: string; icon: ReactNode; onClick: () => void }) { return <section className="page-intro"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="primary" onClick={onClick}>{icon}{button}</button></section> }
function ProductIcon({ name, image, large }: { name: string; image?: string; large?: boolean }) { const n = name.toLowerCase(); const emoji = n.includes('mlék') ? '🥛' : n.includes('fazol') ? '🫘' : n.includes('losos') || n.includes('ryb') ? '🐟' : n.includes('kuř') ? '🍗' : n.includes('zelen') ? '🥦' : n.includes('vývar') || n.includes('polév') ? '🥣' : n.includes('olej') ? '🫒' : n.includes('těst') ? '🍝' : n.includes('pleny') || n.includes('ubrou') ? '🧸' : '📦'; return <span className={`product-icon ${large ? 'large' : ''}`}>{image ? <img src={image} alt="" /> : emoji}</span> }
function Quantity({ value, unit, onMinus, onPlus, large }: { value: number; unit: Unit; onMinus: () => void; onPlus: () => void; large?: boolean }) { return <div className={`quantity ${large ? 'large' : ''}`}><button onClick={onMinus}><Minus size={15} /></button><strong>{value}<small>{unit}</small></strong><button onClick={onPlus}><Plus size={15} /></button></div> }
function Empty({ text }: { text: string }) { return <div className="empty"><CheckCircle2 size={22} /><span>{text}</span></div> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
function UnitSelect({ defaultValue }: { defaultValue?: Unit }) { return <select name="unit" defaultValue={defaultValue}>{units.map(u => <option key={u}>{u}</option>)}</select> }
function freezerProgress(item: FreezerItem) { const months = Math.max(0, daysBetween(item.frozenAt, today()) / 30.44); return months / item.recommendedMonths * 100 }

export default App
