//academy\app\src\components\exercises\ExercisePicker.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, X, Check, Dumbbell, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export type ExercisePickerOption = {
  id: string
  name: string
  muscle_group: string | null
  category?: string | null
  type?: string | null
  equipment?: string | null
  aliases?: string[] | null
  notes?: string | null
  is_active?: boolean | null
}

type QuickTypeFilter = 'all' | 'strength' | 'cardio' | 'core' | 'mobilidade'

type ExercisePickerProps = {
  options: ExercisePickerOption[]
  value?: string | null
  onValueChange: (exerciseId: string) => void
  placeholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
}

const TYPE_LABELS: Record<QuickTypeFilter, string> = {
  all: 'Todos',
  strength: 'Força',
  cardio: 'Cardio',
  core: 'Core',
  mobilidade: 'Mobilidade',
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function resolveQuickType(option: ExercisePickerOption): QuickTypeFilter | 'other' {
  const category = normalizeText(option.category)
  const muscle = normalizeText(option.muscle_group)
  const type = normalizeText(option.type)

  if (category === 'core' || muscle === 'core') return 'core'
  if (category === 'mobilidade' || muscle === 'mobilidade') return 'mobilidade'
  if (category === 'cardio' || type === 'cardio' || muscle === 'cardio') return 'cardio'
  if (category === 'forca' || category === 'força' || type === 'strength') return 'strength'

  return 'other'
}

function buildSearchBlob(option: ExercisePickerOption) {
  return normalizeText([
    option.name,
    option.muscle_group,
    option.category,
    option.type,
    option.equipment,
    option.notes,
    ...(option.aliases ?? []),
  ].filter(Boolean).join(' '))
}

function getSecondaryLabel(option: ExercisePickerOption) {
  const parts = [option.category, option.muscle_group, option.equipment].filter(Boolean)
  return parts.length > 0 ? parts.join(' • ') : 'Sem categoria'
}

export function ExercisePicker({
  options,
  value = null,
  onValueChange,
  placeholder = 'Buscar exercício...',
  emptyMessage = 'Nenhum exercício encontrado.',
  disabled = false,
  className = '',
}: ExercisePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [quickType, setQuickType] = useState<QuickTypeFilter>('all')
  const [equipmentFilter, setEquipmentFilter] = useState('all')

  const wrapperRef = useRef<HTMLDivElement | null>(null)

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value]
  )

  const typeFilteredOptions = useMemo(() => {
    if (quickType === 'all') return options
    return options.filter((option) => resolveQuickType(option) === quickType)
  }, [options, quickType])

  const equipmentOptions = useMemo(() => {
    const all = Array.from(
      new Set(
        typeFilteredOptions
          .map((option) => option.equipment?.trim())
          .filter((equipment): equipment is string => Boolean(equipment))
      )
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

    return ['all', ...all]
  }, [typeFilteredOptions])

  const resolvedEquipmentFilter = useMemo(() => {
    if (equipmentFilter === 'all') return 'all'

    const equipmentStillAvailable = equipmentOptions.some(
      (equipment) => normalizeText(equipment) === normalizeText(equipmentFilter)
    )

    return equipmentStillAvailable ? equipmentFilter : 'all'
  }, [equipmentFilter, equipmentOptions])

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeText(query)

    return typeFilteredOptions.filter((option) => {
      const matchesText =
        !normalizedQuery || buildSearchBlob(option).includes(normalizedQuery)

      const matchesEquipment =
        resolvedEquipmentFilter === 'all' ||
        normalizeText(option.equipment) === normalizeText(resolvedEquipmentFilter)

      return matchesText && matchesEquipment
    })
  }, [typeFilteredOptions, query, resolvedEquipmentFilter])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (exerciseId: string) => {
    onValueChange(exerciseId)
    setOpen(false)
  }

  const clearFilters = () => {
    setQuery('')
    setQuickType('all')
    setEquipmentFilter('all')
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-3 text-left text-sm text-white transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div className="min-w-0">
          {selectedOption ? (
            <div className="min-w-0">
              <div className="truncate font-medium text-white">{selectedOption.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {getSecondaryLabel(selectedOption)}
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">Selecione um exercício</span>
          )}
        </div>

        <div className="ml-3 flex items-center gap-2">
          {selectedOption && (
            <Badge variant="outline" className="hidden sm:inline-flex">
              {selectedOption.muscle_group ?? 'Sem grupo'}
            </Badge>
          )}
          <span className="text-muted-foreground">▾</span>
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-2xl border border-border bg-card p-3 shadow-2xl">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="border-border bg-background pl-9 pr-9"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <Filter className="h-3.5 w-3.5" />
                Tipo
              </div>

              <div className="flex flex-wrap gap-2">
                {(Object.keys(TYPE_LABELS) as QuickTypeFilter[]).map((key) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={quickType === key ? 'default' : 'outline'}
                    onClick={() => setQuickType(key)}
                  >
                    {TYPE_LABELS[key]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Equipamento
              </div>

              <div className="flex flex-wrap gap-2">
                {equipmentOptions.map((equipment) => (
                  <Button
                    key={equipment}
                    type="button"
                    size="sm"
                    variant={resolvedEquipmentFilter === equipment ? 'default' : 'outline'}
                    onClick={() => setEquipmentFilter(equipment)}
                  >
                    {equipment === 'all' ? 'Todos' : equipment}
                  </Button>
                ))}
              </div>
            </div>

            {(query || quickType !== 'all' || resolvedEquipmentFilter !== 'all') && (
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            )}

            <div className="max-h-80 overflow-y-auto rounded-xl border border-border bg-background">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredOptions.map((option) => {
                    const isSelected = option.id === value

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleSelect(option.id)}
                        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Dumbbell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span className="truncate font-medium text-white">
                              {option.name}
                            </span>
                          </div>

                          <div className="mt-1 text-xs text-muted-foreground">
                            {getSecondaryLabel(option)}
                          </div>

                          {option.aliases && option.aliases.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {option.aliases.slice(0, 3).map((alias) => (
                                <Badge key={alias} variant="secondary" className="text-[10px]">
                                  {alias}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {isSelected && (
                          <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
