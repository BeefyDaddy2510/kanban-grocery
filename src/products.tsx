import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { ExternalLink, Package, Pencil, Plus, QrCode, ScanLine, Search, ShoppingBasket, Snowflake, Trash2, X } from 'lucide-react'
import { categoryImageFor } from './foodCatalog'
import { useI18n } from './i18n'
import type { FoodProduct, ShoppingList, SiteSettings, Unit } from './types'

export type ProductDraft = Omit<FoodProduct, 'id' | 'createdAt' | 'updatedAt'>
export type ProductDestination = 'pantry' | 'freezer' | 'shopping'
export type ProductAction = {
  product: ProductDraft
  existingId?: string
  destination: ProductDestination
  quantity: number
  unit: Unit
  location?: string
  listId?: string
  saveToCatalog: boolean
}

const emptyNutrition = { kcal: 0, carbs: 0, sugars: 0, fat: 0, protein: 0, fiber: 0 }
export const emptyProduct = (ean = ''): ProductDraft => ({
  name: '', ean, image: '', nutritionPer100g: { ...emptyNutrition }, packageGrams: 0,
  category: '', brand: '', stores: '', eshopUrl: '', priceCzk: 0, notes: '', source: 'local',
})
const productUid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

export function toFoodProduct(draft: ProductDraft, existing?: FoodProduct): FoodProduct {
  const timestamp = new Date().toISOString()
  return { ...existing, ...draft, id: existing?.id ?? productUid(), createdAt: existing?.createdAt ?? timestamp, updatedAt: timestamp }
}

export const findProductByEan = (products: FoodProduct[], ean: string) => ean ? products.find(product => product.ean === ean) : undefined

export const upsertFoodProduct = (products: FoodProduct[], product: FoodProduct) => {
  const matches = (candidate: FoodProduct) => candidate.id === product.id || Boolean(product.ean && candidate.ean === product.ean)
  return products.some(matches) ? products.map(candidate => matches(candidate) ? product : candidate) : [product, ...products]
}

const prepareImage = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(new Error('Fotografii se nepodařilo načíst.'))
  reader.onload = () => {
    const image = new Image()
    image.onerror = () => reject(new Error('Tento formát obrázku nelze použít.'))
    image.onload = () => {
      const size = 480
      const scale = Math.min(1, size / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', .8))
    }
    image.src = String(reader.result)
  }
  reader.readAsDataURL(file)
})

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}

export function ProductFields({ product, setProduct, requireComplete = true }: { product: ProductDraft; setProduct: Dispatch<SetStateAction<ProductDraft>>; requireComplete?: boolean }) {
  const [imageError, setImageError] = useState('')
  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => setProduct(current => ({ ...current, [key]: value }))
  const setNutrition = (key: keyof ProductDraft['nutritionPer100g'], value: number) => setProduct(current => ({ ...current, nutritionPer100g: { ...current.nutritionPer100g, [key]: value } }))
  const chooseImage = async (file?: File) => {
    if (!file) return
    setImageError('')
    try { set('image', await prepareImage(file)) } catch (error) { setImageError(error instanceof Error ? error.message : 'Fotografii se nepodařilo načíst.') }
  }
  return <>
    <div className="product-form-lead">
      <Field label="Název potraviny"><input value={product.name} onChange={event => set('name', event.target.value)} required placeholder="např. Řecký jogurt" /></Field>
      <Field label="EAN / GTIN (volitelně)"><input value={product.ean} onChange={event => set('ean', event.target.value.replace(/\D/g, '').slice(0, 14))} pattern={product.ean ? '\\d{8,14}' : undefined} inputMode="numeric" placeholder="859…" /></Field>
    </div>
    <div className="form-grid">
      <Field label="Značka (volitelně)"><input value={product.brand ?? ''} onChange={event => set('brand', event.target.value)} /></Field>
      <Field label="Kategorie (volitelně)"><input value={product.category ?? ''} onChange={event => set('category', event.target.value)} /></Field>
      <Field label="Gramáž balení"><div className="number-with-unit"><input type="number" min="1" step="1" value={product.packageGrams || ''} onChange={event => set('packageGrams', Number(event.target.value))} required={requireComplete} /><span>g</span></div></Field>
      <Field label="Obvyklá cena (volitelně)"><div className="number-with-unit"><input type="number" min="0" step="0.01" value={product.priceCzk || ''} onChange={event => set('priceCzk', Number(event.target.value))} /><span>Kč</span></div></Field>
    </div>
    <section className="nutrition-editor product-nutrition"><div className="nutrition-head"><div><strong>Výživové hodnoty</strong><small>Údaje na 100 g</small></div></div><div className="nutrition-fields">{([
      ['kcal', 'kcal', 'kcal'], ['carbs', 'Sacharidy', 'g'], ['sugars', 'z toho cukry', 'g'], ['fat', 'Tuky', 'g'], ['protein', 'Proteiny', 'g'], ['fiber', 'Vláknina', 'g'],
    ] as const).map(([key, label, unit]) => <Field label={label} key={key}><div className="number-with-unit"><input type="number" min="0" step="0.01" value={product.nutritionPer100g[key] || ''} onChange={event => setNutrition(key, Number(event.target.value))} required={requireComplete && key !== 'fiber'} /><span>{unit}</span></div></Field>)}</div></section>
    <div className="form-grid">
      <Field label="Obchody (volitelně)"><input value={product.stores ?? ''} onChange={event => set('stores', event.target.value)} placeholder="Albert, Lidl…" /></Field>
      <Field label="Odkaz na e-shop (volitelně)"><input type="url" value={product.eshopUrl ?? ''} onChange={event => set('eshopUrl', event.target.value)} placeholder="https://…" /></Field>
    </div>
    <Field label="Poznámky (volitelně)"><textarea rows={3} value={product.notes ?? ''} onChange={event => set('notes', event.target.value)} placeholder="Příchuť, velikost balení, akce…" /></Field>
    <Field label="Fotografie potraviny">
      <div className="product-photo-field">
        <label className="photo-upload"><input type="file" accept="image/*" capture="environment" onChange={event => chooseImage(event.target.files?.[0])} /><span className="photo-preview">{product.image ? <img src={product.image} alt="Náhled produktu" /> : <><Plus size={20} /><small>Vyfotit nebo nahrát</small></>}</span><span>{product.image ? 'Změnit fotografii' : 'Vybrat fotografii'}</span></label>
        <span className="or-divider">nebo</span>
        <input type="url" value={product.image.startsWith('http') ? product.image : ''} onChange={event => set('image', event.target.value)} placeholder="https://…/produkt.jpg" required={requireComplete && !product.image} />
      </div>
      {imageError && <small className="field-error">{imageError}</small>}
    </Field>
  </>
}

export function ProductCatalogPage({ products, onAdd, onEdit, onDelete, onUse, onScan }: { products: FoodProduct[]; onAdd: () => void; onEdit: (product: FoodProduct) => void; onDelete: (id: string) => void; onUse: (product: FoodProduct) => void; onScan: () => void }) {
  const { locale } = useI18n()
  const [query, setQuery] = useState('')
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale)
    return products.filter(product => !needle || [product.name, product.ean, product.brand, product.category, product.stores].join(' ').toLocaleLowerCase(locale).includes(needle))
  }, [locale, products, query])
  return <>
    <section className="page-intro"><div><h2>Databáze potravin</h2><p>Vlastní katalog produktů s EAN, fotografií, gramáží a nutričními hodnotami.</p></div><button className="primary" onClick={onAdd}><Plus />Přidat potravinu</button></section>
    <div className="catalog-toolbar"><label className="input-search"><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Hledat název, značku nebo EAN…" /></label><button className="secondary scan-button" onClick={onScan}><QrCode size={18} />SCAN</button></div>
    {visible.length ? <div className="product-catalog-grid">{visible.map(product => <article className="product-catalog-card" key={product.id}>
      <div className="catalog-photo">{product.image ? <img src={product.image} alt={product.name} loading="lazy" decoding="async" onError={event => { const fallback = categoryImageFor(product.category); if (fallback && !event.currentTarget.dataset.fallback) { event.currentTarget.dataset.fallback = 'true'; event.currentTarget.src = fallback } }} /> : <Package size={28} />}{product.imageSourceUrl && <a className="catalog-photo-credit" href={product.imageSourceUrl} target="_blank" rel="noreferrer" title={[product.imageSourceTitle, product.imageCreator, product.imageLicense].filter(Boolean).join(' · ')}><ExternalLink size={11} />Foto: {product.imageCreator || 'zdroj'}</a>}</div>
      <div className="catalog-card-body"><div className="catalog-card-title"><div><span>{product.source === 'open-food-facts' ? 'Open Food Facts' : product.brand || 'Vlastní produkt'}</span><h3>{product.name}</h3></div><div><button className="icon-btn" onClick={() => onEdit(product)} aria-label="Upravit"><Pencil size={15} /></button><button className="icon-btn" onClick={() => onDelete(product.id)} aria-label="Smazat"><Trash2 size={15} /></button></div></div>
        <p className="catalog-ean">{product.ean ? `EAN ${product.ean} · ` : ''}{product.packageGrams} g</p>
        <div className="catalog-macros"><span><b>{product.nutritionPer100g.kcal}</b> kcal</span><span><b>{product.nutritionPer100g.protein}</b> g B</span><span><b>{product.nutritionPer100g.carbs}</b> g S<small>cukry {product.nutritionPer100g.sugars ?? 0} g</small></span><span><b>{product.nutritionPer100g.fat}</b> g T</span></div>
        {(product.stores || product.priceCzk) && <p className="catalog-meta">{[product.stores, product.priceCzk ? `${product.priceCzk} Kč` : ''].filter(Boolean).join(' · ')}</p>}
        <div className="catalog-actions"><button className="primary" onClick={() => onUse(product)}><Plus size={16} />Použít produkt</button>{product.eshopUrl && <a className="secondary" href={product.eshopUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />E-shop</a>}</div>
      </div>
    </article>)}</div> : <div className="catalog-empty"><Package size={34} /><strong>{products.length ? 'Žádný produkt neodpovídá hledání.' : 'Databáze potravin je zatím prázdná.'}</strong><span>Naskenujte EAN nebo přidejte první potravinu ručně.</span></div>}
  </>
}

export function ProductEditorDialog({ initial, close, save }: { initial?: FoodProduct; close: () => void; save: (product: ProductDraft, existing?: FoodProduct) => void }) {
  const [product, setProduct] = useState<ProductDraft>(() => initial ? { name: initial.name, ean: initial.ean, image: initial.image, nutritionPer100g: { ...initial.nutritionPer100g }, packageGrams: initial.packageGrams, category: initial.category, brand: initial.brand, stores: initial.stores, eshopUrl: initial.eshopUrl, priceCzk: initial.priceCzk, notes: initial.notes, source: initial.source } : emptyProduct())
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><div className="modal product-editor-modal"><div className="modal-head"><div><span className="eyebrow">Databáze potravin</span><h2>{initial ? 'Upravit potravinu' : 'Nová potravina'}</h2></div><button className="icon-btn" onClick={close}><X size={20} /></button></div><form onSubmit={event => { event.preventDefault(); save(product, initial) }}><ProductFields product={product} setProduct={setProduct} /><div className="modal-actions"><button type="button" className="secondary" onClick={close}>Zrušit</button><button type="submit" className="primary"><Package size={17} />Uložit do databáze</button></div></form></div></div>
}

type LookupResponse = { found: boolean; source: 'open-food-facts'; product?: Partial<ProductDraft> }

export function ProductScanResultDialog({ ean, localProduct, products, settings, shoppingLists, close, confirm }: { ean: string; localProduct?: FoodProduct; products: FoodProduct[]; settings: SiteSettings; shoppingLists: ShoppingList[]; close: () => void; confirm: (action: ProductAction) => void }) {
  const local = localProduct ?? findProductByEan(products, ean)
  const [product, setProduct] = useState<ProductDraft>(() => local ? { name: local.name, ean: local.ean, image: local.image, nutritionPer100g: { ...local.nutritionPer100g }, packageGrams: local.packageGrams, category: local.category, brand: local.brand, stores: local.stores, eshopUrl: local.eshopUrl, priceCzk: local.priceCzk, notes: local.notes, source: local.source } : emptyProduct(ean))
  const [loading, setLoading] = useState(!local)
  const [lookupMessage, setLookupMessage] = useState(local ? 'Nalezeno ve vaší databázi.' : 'Hledám produkt v Open Food Facts…')
  const [destination, setDestination] = useState<ProductDestination>('pantry')
  const [quantity, setQuantity] = useState(1)
  const [unit, setUnit] = useState<Unit>('ks')
  const [location, setLocation] = useState(settings.defaultLocation)
  const [listId, setListId] = useState(shoppingLists.find(list => !list.archived)?.id ?? '')
  const [saveToCatalog, setSaveToCatalog] = useState(!local)
  useEffect(() => {
    if (local || !ean) return
    const controller = new AbortController()
    fetch(new URL(`api/products/${ean}`, document.baseURI), { signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error(String(response.status)); return response.json() as Promise<LookupResponse> })
      .then(result => {
        if (!result.found || !result.product) { setLookupMessage('EAN v Open Food Facts zatím není. Údaje můžete doplnit ručně.'); return }
        setProduct(current => ({ ...current, ...result.product, nutritionPer100g: { ...current.nutritionPer100g, ...result.product?.nutritionPer100g }, source: 'open-food-facts' }))
        setLookupMessage('Produkt nalezen v Open Food Facts. Zkontrolujte doplněné údaje.')
      })
      .catch(error => { if (error.name !== 'AbortError') setLookupMessage('Open Food Facts není dostupné. Produkt lze zadat ručně.') })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [ean, local])
  return <div className="modal-backdrop scan-result-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><div className="modal product-editor-modal"><div className="modal-head"><div><span className="eyebrow">{ean ? `Naskenováno · EAN ${ean}` : 'Databáze potravin'}</span><h2>{loading ? 'Hledám potravinu…' : product.name || 'Neznámá potravina'}</h2></div><button className="icon-btn" onClick={close}><X size={20} /></button></div><form onSubmit={event => { event.preventDefault(); confirm({ product, existingId: local?.id, destination, quantity, unit, location, listId, saveToCatalog }) }}>
    <div className={`lookup-status ${loading ? 'loading' : ''}`}><ScanLine size={18} /><span>{lookupMessage}</span></div>
    <ProductFields product={product} setProduct={setProduct} requireComplete={saveToCatalog} />
    <section className="scan-destination"><strong>Kam potravinu přidat?</strong><div className="destination-options"><button type="button" className={destination === 'pantry' ? 'active' : ''} onClick={() => setDestination('pantry')}><Package size={19} />Zásoby</button><button type="button" className={destination === 'freezer' ? 'active' : ''} onClick={() => setDestination('freezer')}><Snowflake size={19} />Mrazák</button><button type="button" className={destination === 'shopping' ? 'active' : ''} onClick={() => setDestination('shopping')}><ShoppingBasket size={19} />Nákupní seznam</button></div>
      <div className="form-grid"><Field label="Množství"><input type="number" min="0.1" step="0.1" value={quantity} onChange={event => setQuantity(Number(event.target.value))} required /></Field><Field label="Jednotka"><select value={unit} onChange={event => setUnit(event.target.value as Unit)}>{['ks', 'bal.', 'kg', 'g', 'l', 'ml'].map(value => <option key={value}>{value}</option>)}</select></Field>{destination === 'pantry' && <Field label="Umístění"><select value={location} onChange={event => setLocation(event.target.value)}>{settings.locations.map(value => <option key={value}>{value}</option>)}</select></Field>}{destination === 'shopping' && <Field label="Nákupní seznam"><select value={listId} onChange={event => setListId(event.target.value)} required>{shoppingLists.filter(list => !list.archived).map(list => <option value={list.id} key={list.id}>{list.name}</option>)}</select></Field>}</div>
    </section>
    <label className="switch-row catalog-save-switch"><input type="checkbox" checked={saveToCatalog} onChange={event => setSaveToCatalog(event.target.checked)} /><span />{local ? 'Aktualizovat údaje v databázi potravin' : 'Uložit potravinu do databáze'}</label>
    <div className="modal-actions"><button type="button" className="secondary" onClick={close}>Zrušit</button><button className="primary" type="submit" disabled={loading}><Plus size={17} />Přidat</button></div>
  </form></div></div>
}
