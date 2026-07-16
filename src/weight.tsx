import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { ArrowRightLeft, CalendarDays, ChefHat, ChevronLeft, ChevronRight, Copy, Pencil, Plus, Scale, Target, Trash2, TrendingDown, UserRound, X } from 'lucide-react'
import { emptyProduct, ProductFields, toFoodProduct, type ProductDraft } from './products'
import { calculateRecipeNutrition } from './nutrition'
import type { AppData, FoodProduct, MealEntry, MealType, NutritionPer100g, Recipe, WeightProfile } from './types'

const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
const today = () => new Date().toISOString().slice(0, 10)
const emptyNutrition = (): NutritionPer100g => ({ kcal: 0, carbs: 0, sugars: 0, fat: 0, protein: 0, fiber: 0 })
const mealLabels: { key: MealType; label: string; destination: string; hint: string }[] = [
  { key: 'breakfast', label: 'Snídaně', destination: 'snídaně', hint: 'Začněte den vyváženě' },
  { key: 'morningSnack', label: 'Dopolední svačina', destination: 'dopolední svačiny', hint: 'Malé doplnění energie' },
  { key: 'lunch', label: 'Oběd', destination: 'oběda', hint: 'Hlavní jídlo dne' },
  { key: 'afternoonSnack', label: 'Odpolední svačina', destination: 'odpolední svačiny', hint: 'Energie na odpoledne' },
  { key: 'dinner', label: 'Večeře', destination: 'večeře', hint: 'Závěr denního jídelníčku' },
]
const nutrientMeta: { key: keyof NutritionPer100g; label: string; unit: string; nested?: boolean }[] = [
  { key: 'kcal', label: 'Energie', unit: 'kcal' },
  { key: 'carbs', label: 'Sacharidy', unit: 'g' },
  { key: 'sugars', label: 'z toho cukry', unit: 'g', nested: true },
  { key: 'fat', label: 'Tuky', unit: 'g' },
  { key: 'protein', label: 'Bílkoviny', unit: 'g' },
  { key: 'fiber', label: 'Vláknina', unit: 'g' },
]

const amountNutrition = (nutrition: NutritionPer100g, grams: number) => Object.fromEntries(
  nutrientMeta.map(({ key }) => [key, (Number(nutrition[key]) || 0) * grams / 100]),
) as unknown as NutritionPer100g

const sumNutrition = (entries: MealEntry[]) => entries.reduce<NutritionPer100g>((total, entry) => {
  const amount = amountNutrition(entry.nutritionPer100g, entry.grams)
  nutrientMeta.forEach(({ key }) => { total[key] += amount[key] })
  return total
}, emptyNutrition())

const format = (value: number, digits = 1) => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: digits }).format(value)
const formatDay = (value: string) => new Intl.DateTimeFormat('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00`))
const moveDay = (value: string, delta: number) => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + delta); return date.toISOString().slice(0, 10) }

export function WeightTrackingPage({ data, setData, notify }: { data: AppData; setData: Dispatch<SetStateAction<AppData>>; notify: (message: string) => void }) {
  const [selectedProfileId, setSelectedProfileId] = useState(data.weightProfiles[0]?.id ?? '')
  const [selectedDate, setSelectedDate] = useState(today())
  const [profileEditor, setProfileEditor] = useState<WeightProfile | 'new' | null>(null)
  const [mealEditor, setMealEditor] = useState<MealType | null>(null)
  const [weighInOpen, setWeighInOpen] = useState(false)
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(() => new Set())
  const [bulkDialog, setBulkDialog] = useState<'recipe' | 'move' | 'copy' | null>(null)

  useEffect(() => {
    if (!data.weightProfiles.some(profile => profile.id === selectedProfileId)) setSelectedProfileId(data.weightProfiles[0]?.id ?? '')
  }, [data.weightProfiles, selectedProfileId])
  useEffect(() => setSelectedEntryIds(new Set()), [selectedDate, selectedProfileId])

  const profile = data.weightProfiles.find(item => item.id === selectedProfileId)
  const dayEntries = data.mealEntries.filter(entry => entry.profileId === selectedProfileId && entry.date === selectedDate)
  const selectedEntries = dayEntries.filter(entry => selectedEntryIds.has(entry.id))
  const totals = sumNutrition(dayEntries)

  const saveProfile = (next: WeightProfile) => {
    setData(current => ({ ...current, weightProfiles: current.weightProfiles.some(item => item.id === next.id) ? current.weightProfiles.map(item => item.id === next.id ? next : item) : [...current.weightProfiles, next] }))
    setSelectedProfileId(next.id)
    setProfileEditor(null)
    notify('Karta osoby byla uložena.')
  }
  const deleteProfile = (id: string) => {
    if (!window.confirm('Smazat kartu osoby včetně jejích jídelních záznamů?')) return
    setData(current => ({ ...current, weightProfiles: current.weightProfiles.filter(item => item.id !== id), mealEntries: current.mealEntries.filter(entry => entry.profileId !== id) }))
    notify('Karta osoby byla smazána.')
  }
  const deleteMeal = (id: string) => setData(current => ({ ...current, mealEntries: current.mealEntries.filter(entry => entry.id !== id) }))
  const toggleEntry = (id: string) => setSelectedEntryIds(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next })

  if (!data.weightProfiles.length) return <>
    <section className="page-intro"><div><h2>Sledování hmotnosti</h2><p>Osobní cíle, vývoj váhy a každodenní přehled makroživin na jednom místě.</p></div><button className="primary" onClick={() => setProfileEditor('new')}><Plus />Vytvořit kartu osoby</button></section>
    <div className="weight-empty"><span><Scale size={38} /></span><h3>Začněte vytvořením osobní karty</h3><p>Nastavíte základní údaje, cílovou váhu a doporučený denní limit energie i makroživin.</p><button className="primary" onClick={() => setProfileEditor('new')}><UserRound size={17} />Vytvořit první kartu</button></div>
    {profileEditor && <ProfileDialog initial={undefined} close={() => setProfileEditor(null)} save={saveProfile} />}
  </>

  if (!profile) return null
  const history = [...profile.weightEntries].sort((a, b) => a.date.localeCompare(b.date))
  const recentHistory = [...history].reverse().slice(0, 6)
  const startWeight = history[0]?.weightKg ?? profile.currentWeightKg
  const goalDistance = profile.targetWeightKg - startWeight
  const progress = goalDistance === 0 ? 100 : Math.max(0, Math.min(100, (profile.currentWeightKg - startWeight) / goalDistance * 100))
  const bmi = profile.heightCm > 0 ? profile.currentWeightKg / ((profile.heightCm / 100) ** 2) : 0

  return <>
    <section className="page-intro weight-intro"><div><h2>Sledování hmotnosti</h2><p>Osobní cíle, vývoj váhy a denní jídelní přehled.</p></div><div className="weight-intro-actions"><button className="secondary" onClick={() => setWeighInOpen(true)}><Scale size={17} />Zapsat váhu</button><button className="primary" onClick={() => setProfileEditor('new')}><Plus />Nová osoba</button></div></section>

    <div className="profile-tabs">{data.weightProfiles.map(item => <button key={item.id} className={item.id === selectedProfileId ? 'active' : ''} onClick={() => setSelectedProfileId(item.id)}><span>{item.name.slice(0, 1).toUpperCase()}</span><b>{item.name}</b><small>{format(item.currentWeightKg)} kg</small></button>)}</div>

    <section className="profile-hero">
      <div className="profile-person"><span className="profile-avatar">{profile.name.slice(0, 1).toUpperCase()}</span><div><span className="eyebrow">Osobní karta</span><h3>{profile.name}</h3><p>{profile.age} let · {profile.heightCm} cm · BMI {format(bmi)}</p></div><div className="profile-card-actions"><button className="icon-btn" onClick={() => setProfileEditor(profile)} aria-label="Upravit kartu"><Pencil size={16} /></button><button className="icon-btn" onClick={() => deleteProfile(profile.id)} aria-label="Smazat kartu"><Trash2 size={16} /></button></div></div>
      <div className="weight-goal"><div><span><TrendingDown size={18} />Aktuální váha</span><strong>{format(profile.currentWeightKg)} <small>kg</small></strong></div><div><span><Target size={18} />Cílová váha</span><strong>{format(profile.targetWeightKg)} <small>kg</small></strong></div><div className="goal-progress"><span><b>Pokrok k cíli</b><b>{format(progress, 0)} %</b></span><i><em style={{ width: `${progress}%` }} /></i><small>Zbývá {format(Math.abs(profile.targetWeightKg - profile.currentWeightKg))} kg</small></div></div>
    </section>

    <section className="weight-history"><header><div><span className="eyebrow">Vývoj hmotnosti</span><h3>Historie vážení</h3></div><small>{history.length} {history.length === 1 ? 'zápis' : history.length < 5 ? 'zápisy' : 'zápisů'}</small></header><div>{recentHistory.map(entry => { const index = history.findIndex(item => item.id === entry.id); const previous = index > 0 ? history[index - 1].weightKg : entry.weightKg; const change = entry.weightKg - previous; return <article key={entry.id}><span>{new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'short' }).format(new Date(`${entry.date}T12:00:00`))}</span><strong>{format(entry.weightKg)} kg</strong><small className={change < 0 ? 'down' : change > 0 ? 'up' : ''}>{change === 0 ? 'výchozí' : `${change > 0 ? '+' : ''}${format(change)} kg`}</small></article> })}</div></section>

    <section className="day-toolbar"><button className="icon-btn" onClick={() => setSelectedDate(moveDay(selectedDate, -1))}><ChevronLeft size={19} /></button><label><CalendarDays size={18} /><input type="date" value={selectedDate} onChange={event => setSelectedDate(event.target.value)} /><strong>{selectedDate === today() ? 'Dnes' : formatDay(selectedDate)}</strong></label><button className="icon-btn" onClick={() => setSelectedDate(moveDay(selectedDate, 1))}><ChevronRight size={19} /></button></section>

    {selectedEntries.length > 0 && <section className="meal-selection-bar"><div><strong>Vybráno {selectedEntries.length} položek</strong><button onClick={() => setSelectedEntryIds(new Set())}>Zrušit výběr</button></div><div><button className="secondary" onClick={() => setBulkDialog('move')}><ArrowRightLeft size={16} />Přesunout</button><button className="secondary" onClick={() => setBulkDialog('copy')}><Copy size={16} />Kopírovat</button><button className="primary" onClick={() => setBulkDialog('recipe')}><ChefHat size={16} />Vytvořit recept</button></div></section>}

    <section className="macro-overview"><div className="macro-overview-head"><div><span className="eyebrow">Denní přehled</span><h3>Energetická hodnota a makroživiny</h3></div><strong>Příjem {format(totals.kcal, 0)} kcal</strong></div><div className="macro-dashboard"><div className="energy-circle" style={{ background: `conic-gradient(var(--brand) ${profile.dailyTargets.kcal > 0 ? Math.min(100, totals.kcal / profile.dailyTargets.kcal * 100) : 0}%, var(--surface-2) 0)` }}><div><small>{profile.dailyTargets.kcal > 0 ? format(Math.min(100, totals.kcal / profile.dailyTargets.kcal * 100), 0) : 0} %</small><strong>{format(totals.kcal, 0)} kcal</strong><span>z {format(profile.dailyTargets.kcal, 0)} kcal</span></div></div><div className="macro-target-grid">{nutrientMeta.filter(meta => meta.key !== 'kcal').map(meta => { const consumed = totals[meta.key]; const target = profile.dailyTargets[meta.key]; const percent = target > 0 ? Math.min(100, consumed / target * 100) : 0; return <article className={meta.nested ? 'nested' : ''} key={meta.key}><div className="macro-circle" style={{ background: `conic-gradient(var(--green) ${percent}%, var(--surface-2) 0)` }}><span>{format(percent, 0)}%</span></div><div><span>{meta.label}</span><b>{format(consumed)} {meta.unit}</b><small>z {format(target)} {meta.unit}</small></div></article> })}</div></div></section>

    <div className="meal-day-list">{mealLabels.map(meal => { const entries = dayEntries.filter(entry => entry.meal === meal.key); const mealTotal = sumNutrition(entries); return <section className="meal-card" key={meal.key}><header><div><span className="meal-dot" /><div><h3>{meal.label}</h3><p>{entries.length ? `${format(mealTotal.kcal, 0)} kcal · ${entries.length} položek` : meal.hint}</p></div></div><button className="secondary" onClick={() => setMealEditor(meal.key)}><Plus size={16} />Přidat</button></header>{entries.length ? <div className="meal-entries">{entries.map(entry => { const nutrition = amountNutrition(entry.nutritionPer100g, entry.grams); return <article className={selectedEntryIds.has(entry.id) ? 'selected' : ''} key={entry.id}><label className="meal-select" aria-label={`Vybrat ${entry.name}`}><input type="checkbox" checked={selectedEntryIds.has(entry.id)} onChange={() => toggleEntry(entry.id)} /><span /></label><span className="meal-food-image">{entry.source === 'recipe' ? <ChefHat size={18} /> : entry.image ? <img src={entry.image} alt="" /> : entry.name.slice(0, 1).toUpperCase()}</span><div><strong>{entry.name}</strong><small>{entry.portionCount ? `${format(entry.portionCount)} porce · ` : ''}{format(entry.grams, 0)} g · {format(nutrition.kcal, 0)} kcal</small></div><span className="meal-entry-macros">S {format(nutrition.carbs)} g <small>cukry {format(nutrition.sugars)} g</small> · T {format(nutrition.fat)} g · B {format(nutrition.protein)} g</span><button className="icon-btn" onClick={() => deleteMeal(entry.id)} aria-label="Smazat položku"><Trash2 size={15} /></button></article> })}</div> : <button className="meal-empty-row" onClick={() => setMealEditor(meal.key)}><Plus size={17} />Přidat potravinu, hotový recept nebo ruční záznam</button>}</section> })}</div>

    {profileEditor && <ProfileDialog initial={profileEditor === 'new' ? undefined : profileEditor} close={() => setProfileEditor(null)} save={saveProfile} />}
    {mealEditor && <MealDialog profileId={profile.id} date={selectedDate} meal={mealEditor} data={data} setData={setData} close={() => setMealEditor(null)} notify={notify} />}
    {bulkDialog === 'recipe' && <CreateRecipeFromEntriesDialog entries={selectedEntries} close={() => setBulkDialog(null)} save={recipe => { setData(current => ({ ...current, recipes: [recipe, ...current.recipes] })); setBulkDialog(null); setSelectedEntryIds(new Set()); notify('Nový recept byl vytvořen z vybraných položek.') }} />}
    {(bulkDialog === 'move' || bulkDialog === 'copy') && <MealTransferDialog mode={bulkDialog} entries={selectedEntries} currentDate={selectedDate} close={() => setBulkDialog(null)} confirm={(targetDate, targetMeal) => { setData(current => ({ ...current, mealEntries: bulkDialog === 'move' ? current.mealEntries.map(entry => selectedEntryIds.has(entry.id) ? { ...entry, meal: targetMeal } : entry) : [...current.mealEntries, ...selectedEntries.map(entry => ({ ...entry, id: uid(), date: targetDate, meal: targetMeal }))] })); setBulkDialog(null); setSelectedEntryIds(new Set()); notify(bulkDialog === 'move' ? 'Položky byly přesunuty do jiné fáze dne.' : 'Položky byly zkopírovány do vybraného dne.') }} />}
    {weighInOpen && <WeighInDialog profile={profile} close={() => setWeighInOpen(false)} save={(date, weightKg) => { setData(current => ({ ...current, weightProfiles: current.weightProfiles.map(item => { if (item.id !== profile.id) return item; const weightEntries = [...item.weightEntries.filter(entry => entry.date !== date), { id: uid(), date, weightKg }].sort((a, b) => a.date.localeCompare(b.date)); return { ...item, currentWeightKg: weightEntries.at(-1)?.weightKg ?? weightKg, weightEntries } }) })); setWeighInOpen(false); notify('Nová váha byla zapsána.') }} />}
  </>
}

function CreateRecipeFromEntriesDialog({ entries, close, save }: { entries: MealEntry[]; close: () => void; save: (recipe: Recipe) => void }) {
  const [grams, setGrams] = useState<Record<string, number>>(() => Object.fromEntries(entries.map(entry => [entry.id, entry.grams])))
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const recipe: Recipe = {
      id: uid(), name: String(form.get('name')).trim(), emoji: String(form.get('emoji') || '🍽️'), minutes: Number(form.get('minutes')) || 30, servings: Number(form.get('servings')) || 1,
      tags: String(form.get('tags')).split(',').map(tag => tag.trim()).filter(Boolean),
      ingredients: entries.map(entry => ({ name: entry.name, amount: `${grams[entry.id]} g`, grams: grams[entry.id], productId: entry.productId, nutritionPer100g: entry.nutritionPer100g })),
      instructions: String(form.get('instructions')).trim() || 'Připraveno z položek uložených v jídelním deníku.', favorite: false,
    }
    save(recipe)
  }
  return <div className="modal-backdrop meal-dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><div className="modal recipe-from-meal-modal"><div className="modal-head"><div><span className="eyebrow">Hmotnost · {entries.length} vybraných položek</span><h2>Vytvořit recept</h2></div><button className="icon-btn" onClick={close}><X size={20} /></button></div><form onSubmit={submit}><div className="recipe-title-fields"><label className="field"><span>Emoji</span><input name="emoji" defaultValue="🍽️" maxLength={4} /></label><label className="field"><span>Název receptu</span><input name="name" required autoFocus placeholder="např. Kuře s rýží" /></label></div><div className="form-grid"><label className="field"><span>Počet porcí</span><input name="servings" type="number" min="1" step="1" defaultValue="1" required /></label><label className="field"><span>Doba přípravy</span><div className="number-with-unit"><input name="minutes" type="number" min="1" defaultValue="30" /><span>min</span></div></label></div><section className="selected-recipe-ingredients"><header><strong>Ingredience a hmotnosti</strong><small>Hodnoty vycházejí z denního záznamu a můžete je upravit.</small></header>{entries.map(entry => <label key={entry.id}><span>{entry.name}</span><div className="number-with-unit"><input type="number" min="1" step="1" value={grams[entry.id]} onChange={event => setGrams(current => ({ ...current, [entry.id]: Number(event.target.value) }))} required /><span>g</span></div></label>)}</section><label className="field"><span>Štítky (volitelně)</span><input name="tags" placeholder="Oběd, rychlé…" /></label><label className="field"><span>Postup (volitelně)</span><textarea name="instructions" rows={3} placeholder="Doplňte postup přípravy…" /></label><div className="modal-actions"><button type="button" className="secondary" onClick={close}>Zrušit</button><button className="primary" type="submit"><ChefHat size={17} />Vytvořit recept</button></div></form></div></div>
}

function MealTransferDialog({ mode, entries, currentDate, close, confirm }: { mode: 'move' | 'copy'; entries: MealEntry[]; currentDate: string; close: () => void; confirm: (date: string, meal: MealType) => void }) {
  const defaultMeal = entries[0]?.meal ?? 'lunch'
  return <div className="modal-backdrop meal-dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><div className="modal transfer-meal-modal"><div className="modal-head"><div><span className="eyebrow">{entries.length} vybraných položek</span><h2>{mode === 'move' ? 'Přesunout mezi jídly' : 'Kopírovat do jiného dne'}</h2></div><button className="icon-btn" onClick={close}><X size={20} /></button></div><form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const targetDate = mode === 'move' ? currentDate : String(form.get('targetDate') || currentDate); const targetMeal = String(form.get('targetMeal') || defaultMeal) as MealType; confirm(targetDate, targetMeal) }}>{mode === 'copy' && <label className="field"><span>Cílové datum</span><input type="date" name="targetDate" defaultValue={currentDate} required /></label>}<label className="field"><span>Cílová fáze dne</span><select name="targetMeal" defaultValue={defaultMeal}>{mealLabels.map(meal => <option value={meal.key} key={meal.key}>{meal.label}</option>)}</select></label><div className="transfer-preview">{entries.map(entry => <span key={entry.id}>{entry.name}<small>{format(entry.grams, 0)} g</small></span>)}</div><p className="transfer-note">{mode === 'copy' ? 'Položky se zkopírují 1:1 včetně hmotnosti a všech nutričních hodnot. Původní záznamy zůstanou beze změny.' : 'Položky zůstanou ve stejném dni a přesunou se do vybrané fáze.'}</p><div className="modal-actions"><button type="button" className="secondary" onClick={close}>Zrušit</button><button className="primary" type="submit">{mode === 'copy' ? <Copy size={17} /> : <ArrowRightLeft size={17} />}{mode === 'copy' ? 'Kopírovat' : 'Přesunout'}</button></div></form></div></div>
}

function ProfileDialog({ initial, close, save }: { initial?: WeightProfile; close: () => void; save: (profile: WeightProfile) => void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const currentWeightKg = Number(form.get('currentWeightKg'))
    const id = initial?.id ?? uid()
    const weightEntries = initial?.weightEntries.length ? [...initial.weightEntries] : [{ id: uid(), date: today(), weightKg: currentWeightKg }]
    if (initial && currentWeightKg !== initial.currentWeightKg) weightEntries.splice(0, weightEntries.length, ...weightEntries.filter(entry => entry.date !== today()), { id: uid(), date: today(), weightKg: currentWeightKg })
    const profile: WeightProfile = {
      id, name: String(form.get('name')).trim(), gender: String(form.get('gender')) as WeightProfile['gender'], age: Number(form.get('age')), heightCm: Number(form.get('heightCm')), currentWeightKg, targetWeightKg: Number(form.get('targetWeightKg')),
      dailyTargets: { kcal: Number(form.get('kcal')), carbs: Number(form.get('carbs')), sugars: Number(form.get('sugars')), fat: Number(form.get('fat')), protein: Number(form.get('protein')), fiber: Number(form.get('fiber')) },
      weightEntries: weightEntries.sort((a, b) => a.date.localeCompare(b.date)), createdAt: initial?.createdAt ?? new Date().toISOString(),
    }
    save(profile)
  }
  const targets = initial?.dailyTargets ?? { kcal: 2000, carbs: 250, sugars: 50, fat: 70, protein: 100, fiber: 30 }
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><div className="modal profile-editor-modal"><div className="modal-head"><div><span className="eyebrow">Sledování hmotnosti</span><h2>{initial ? 'Upravit kartu osoby' : 'Nová karta osoby'}</h2></div><button className="icon-btn" onClick={close}><X size={20} /></button></div><form onSubmit={submit}><div className="form-grid profile-basics"><label className="field"><span>Jméno</span><input name="name" required autoFocus defaultValue={initial?.name} /></label><label className="field"><span>Pohlaví</span><select name="gender" defaultValue={initial?.gender ?? 'female'}><option value="female">Žena</option><option value="male">Muž</option><option value="other">Jiné / nechci uvést</option></select></label><label className="field"><span>Věk</span><div className="number-with-unit"><input name="age" type="number" min="1" max="120" required defaultValue={initial?.age} /><span>let</span></div></label><label className="field"><span>Výška</span><div className="number-with-unit"><input name="heightCm" type="number" min="50" max="250" required defaultValue={initial?.heightCm} /><span>cm</span></div></label><label className="field"><span>Aktuální váha</span><div className="number-with-unit"><input name="currentWeightKg" type="number" min="20" max="500" step="0.1" required defaultValue={initial?.currentWeightKg} /><span>kg</span></div></label><label className="field"><span>Požadovaná váha</span><div className="number-with-unit"><input name="targetWeightKg" type="number" min="20" max="500" step="0.1" required defaultValue={initial?.targetWeightKg} /><span>kg</span></div></label></div><section className="nutrition-editor profile-targets"><div className="nutrition-head"><div><strong>Požadované denní makroživiny</strong><small>Vaše osobní cíle na jeden den</small></div></div><div className="nutrition-fields">{nutrientMeta.map(meta => <label className={`field ${meta.nested ? 'nested-field' : ''}`} key={meta.key}><span>{meta.label}</span><div className="number-with-unit"><input name={meta.key} type="number" min="0" step="0.1" required defaultValue={targets[meta.key]} /><span>{meta.unit}</span></div></label>)}</div></section><div className="modal-actions"><button type="button" className="secondary" onClick={close}>Zrušit</button><button className="primary" type="submit"><UserRound size={17} />Uložit kartu</button></div></form></div></div>
}

function WeighInDialog({ profile, close, save }: { profile: WeightProfile; close: () => void; save: (date: string, weightKg: number) => void }) {
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><div className="modal weigh-in-modal"><div className="modal-head"><div><span className="eyebrow">{profile.name}</span><h2>Zapsat váhu</h2></div><button className="icon-btn" onClick={close}><X size={20} /></button></div><form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); save(String(form.get('date')), Number(form.get('weightKg'))) }}><label className="field"><span>Datum</span><input name="date" type="date" defaultValue={today()} required /></label><label className="field"><span>Hmotnost</span><div className="number-with-unit"><input name="weightKg" type="number" min="20" max="500" step="0.1" defaultValue={profile.currentWeightKg} required autoFocus /><span>kg</span></div></label><div className="modal-actions"><button type="button" className="secondary" onClick={close}>Zrušit</button><button className="primary" type="submit"><Scale size={17} />Uložit váhu</button></div></form></div></div>
}

type FoodCandidate = { id: string; name: string; image?: string; nutritionPer100g: NutritionPer100g; productId?: string; source: 'catalog' | 'pantry' }

function MealDialog({ profileId, date, meal, data, setData, close, notify }: { profileId: string; date: string; meal: MealType; data: AppData; setData: Dispatch<SetStateAction<AppData>>; close: () => void; notify: (message: string) => void }) {
  const [mode, setMode] = useState<'catalog' | 'recipe' | 'manual'>('catalog')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [recipeAmountMode, setRecipeAmountMode] = useState<'portion' | 'weight'>('portion')
  const [portionCount, setPortionCount] = useState(1)
  const [recipeWeight, setRecipeWeight] = useState(100)
  const [grams, setGrams] = useState(100)
  const [saveToCatalog, setSaveToCatalog] = useState(false)
  const [draft, setDraft] = useState<ProductDraft>(() => emptyProduct())
  const catalog = useMemo<FoodCandidate[]>(() => {
    const products = data.products.map(product => ({ id: `product-${product.id}`, name: product.name, image: product.image, nutritionPer100g: product.nutritionPer100g, productId: product.id, source: 'catalog' as const }))
    const known = new Set(products.map(item => item.name.toLocaleLowerCase('cs-CZ')))
    const pantry = data.pantry.filter(item => item.nutritionPer100g && !known.has(item.name.toLocaleLowerCase('cs-CZ'))).map(item => ({ id: `pantry-${item.id}`, name: item.name, image: item.image, nutritionPer100g: item.nutritionPer100g!, productId: item.productId, source: 'pantry' as const }))
    return [...products, ...pantry]
  }, [data.pantry, data.products])
  const recipes = useMemo(() => data.recipes.map(recipe => ({ recipe, calculated: calculateRecipeNutrition(recipe, data) })), [data])
  const visible = catalog.filter(item => item.name.toLocaleLowerCase('cs-CZ').includes(query.trim().toLocaleLowerCase('cs-CZ')))
  const selected = catalog.find(item => item.id === selectedId)
  const selectedRecipe = recipes.find(item => item.recipe.id === selectedRecipeId)
  const recipeConsumedGrams = selectedRecipe ? (recipeAmountMode === 'portion' ? selectedRecipe.calculated.totalGrams / Math.max(1, selectedRecipe.recipe.servings) * portionCount : recipeWeight) : 0
  const previewNutrition = mode === 'recipe' ? selectedRecipe?.calculated.nutritionPer100g : mode === 'manual' ? draft.nutritionPer100g : selected?.nutritionPer100g
  const previewGrams = mode === 'recipe' ? recipeConsumedGrams : grams
  const mealLabel = mealLabels.find(item => item.key === meal)
  const mealName = mealLabel?.label ?? 'Jídlo'
  const mealDestination = mealLabel?.destination ?? 'jídla'

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    let stored: FoodProduct | undefined
    let entry: MealEntry
    if (mode === 'catalog') {
      if (!selected) return
      entry = { id: uid(), profileId, date, meal, name: selected.name, grams, nutritionPer100g: selected.nutritionPer100g, productId: selected.productId, image: selected.image, source: 'catalog' }
    } else if (mode === 'recipe') {
      if (!selectedRecipe?.calculated.ready || recipeConsumedGrams <= 0) return
      entry = { id: uid(), profileId, date, meal, name: selectedRecipe.recipe.name, grams: recipeConsumedGrams, nutritionPer100g: selectedRecipe.calculated.nutritionPer100g, recipeId: selectedRecipe.recipe.id, portionCount: recipeAmountMode === 'portion' ? portionCount : undefined, source: 'recipe' }
    } else {
      if (!draft.name.trim()) return
      if (saveToCatalog) stored = toFoodProduct(draft, data.products.find(item => item.ean === draft.ean))
      entry = { id: uid(), profileId, date, meal, name: draft.name.trim(), grams, nutritionPer100g: draft.nutritionPer100g, productId: stored?.id, image: draft.image, source: 'manual' }
    }
    setData(current => ({ ...current, products: stored ? (current.products.some(item => item.id === stored.id) ? current.products.map(item => item.id === stored!.id ? stored! : item) : [stored, ...current.products.filter(item => item.ean !== stored!.ean)]) : current.products, mealEntries: [...current.mealEntries, entry] }))
    close()
    notify(mode === 'recipe' ? 'Recept byl přidán do denního přehledu.' : saveToCatalog ? 'Jídlo bylo přidáno a potravina uložena do databáze.' : 'Jídlo bylo přidáno do denního přehledu.')
  }

  return <div className="modal-backdrop meal-dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && close()}><div className="modal product-editor-modal meal-editor-modal"><div className="modal-head"><div><span className="eyebrow">{mealName} · {formatDay(date)}</span><h2>Přidat jídlo</h2></div><button className="icon-btn" onClick={close}><X size={20} /></button></div><form onSubmit={submit}>
    <div className="entry-mode"><button type="button" className={mode === 'catalog' ? 'active' : ''} onClick={() => setMode('catalog')}>Potravina</button><button type="button" className={mode === 'recipe' ? 'active' : ''} onClick={() => setMode('recipe')}><ChefHat size={15} />Hotový recept</button><button type="button" className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>Ručně zapsat</button></div>
    {mode === 'catalog' && <><label className="field"><span>Vyhledat v databázi a zásobách</span><input value={query} onChange={event => setQuery(event.target.value)} autoFocus placeholder="Název potraviny…" /></label><div className="food-picker">{visible.length ? visible.map(item => <button type="button" className={selectedId === item.id ? 'active' : ''} key={item.id} onClick={() => { setSelectedId(item.id); setGrams(100) }}><span>{item.image ? <img src={item.image} alt="" /> : item.name.slice(0, 1).toUpperCase()}</span><div><strong>{item.name}</strong><small>{item.source === 'catalog' ? 'Databáze potravin' : 'Zásoby'} · {format(item.nutritionPer100g.kcal, 0)} kcal / 100 g</small></div></button>) : <p>Žádná potravina s nutričními údaji nebyla nalezena.</p>}</div></>}
    {mode === 'recipe' && <><div className="food-picker recipe-picker">{recipes.length ? recipes.map(item => <button type="button" disabled={!item.calculated.ready} className={selectedRecipeId === item.recipe.id ? 'active' : ''} key={item.recipe.id} onClick={() => { setSelectedRecipeId(item.recipe.id); setRecipeWeight(Math.round(item.calculated.totalGrams / Math.max(1, item.recipe.servings))) }}><span>{item.recipe.emoji}</span><div><strong>{item.recipe.name}</strong><small>{item.calculated.ready ? `${format(item.calculated.totalNutrition.kcal, 0)} kcal celkem · ${format(item.calculated.totalGrams, 0)} g · ${item.recipe.servings} porcí` : `Doplňte hmotnost a výživu: ${item.calculated.missing.join(', ')}`}</small></div></button>) : <p>Nejprve vytvořte recept s ingrediencemi.</p>}</div>{selectedRecipe?.calculated.ready && <section className="recipe-amount"><strong>Kolik jste snědli?</strong><div className="entry-mode compact"><button type="button" className={recipeAmountMode === 'portion' ? 'active' : ''} onClick={() => setRecipeAmountMode('portion')}>Podle porce</button><button type="button" className={recipeAmountMode === 'weight' ? 'active' : ''} onClick={() => setRecipeAmountMode('weight')}>Podle hmotnosti</button></div>{recipeAmountMode === 'portion' ? <label className="field meal-grams"><span>Počet porcí</span><input type="number" min="0.1" step="0.1" value={portionCount} onChange={event => setPortionCount(Number(event.target.value))} required /></label> : <label className="field meal-grams"><span>Zkonzumovaná hmotnost</span><div className="number-with-unit"><input type="number" min="1" step="1" value={recipeWeight} onChange={event => setRecipeWeight(Number(event.target.value))} required /><span>g</span></div></label>}<p>{recipeAmountMode === 'portion' ? `${format(portionCount)} porce odpovídá přibližně ${format(recipeConsumedGrams, 0)} g.` : `Z celkové hmotnosti receptu ${format(selectedRecipe.calculated.totalGrams, 0)} g.`}</p></section>}</>}
    {mode === 'manual' && <><ProductFields product={draft} setProduct={setDraft} requireComplete={saveToCatalog} /><label className="switch-row catalog-save-switch"><input type="checkbox" checked={saveToCatalog} onChange={event => setSaveToCatalog(event.target.checked)} /><span />Uložit potravinu také do databáze</label></>}
    {mode !== 'recipe' && <label className="field meal-grams"><span>Zkonzumované množství</span><div className="number-with-unit"><input type="number" min="1" step="1" value={grams} onChange={event => setGrams(Number(event.target.value))} required /><span>g</span></div></label>}
    {previewNutrition && previewGrams > 0 && <div className="meal-add-preview">{nutrientMeta.map(meta => { const value = amountNutrition(previewNutrition, previewGrams)[meta.key]; return <span className={meta.nested ? 'nested' : ''} key={meta.key}><small>{meta.label}</small><b>{format(value, meta.key === 'kcal' ? 0 : 1)} {meta.unit}</b></span> })}</div>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={close}>Zrušit</button><button className="primary" type="submit" disabled={(mode === 'catalog' && !selected) || (mode === 'recipe' && !selectedRecipe?.calculated.ready)}><Plus size={17} />Přidat do {mealDestination}</button></div>
  </form></div></div>
}
