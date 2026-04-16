//academy\app\src\pages\admin\AdminExercises.tsx
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  buildAiWorkoutPrompt,
  buildExerciseBankText,
  WORKOUT_JSON_TEMPLATE,
} from '@/lib/aiWorkoutJson'

type ExerciseType = 'strength' | 'cardio'

type Exercise = {
  id: string
  name: string
  muscle_group: string
  type: ExerciseType
  equipment: string | null
  aliases: string[] | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

const MUSCLE_GROUPS = [
  'Peito',
  'Costas',
  'Pernas',
  'Ombro',
  'Bíceps',
  'Tríceps',
  'Core',
  'Cardio',
]

const EQUIPMENTS = [
  'Máquina',
  'Barra',
  'Halter',
  'Cabo/Polia',
  'Peso corporal',
  'Esteira',
  'Bike',
  'Escada',
  'Outro',
]

function emptyForm(): Omit<Exercise, 'id' | 'created_at' | 'updated_at'> {
  return {
    name: '',
    muscle_group: 'Peito',
    type: 'strength',
    equipment: null,
    aliases: [],
    notes: null,
    is_active: true,
  }
}

export default function AdminExercises() {
  const { profile } = useAuth()
  const role = profile?.role ?? 'user'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const canAdmin = role === 'admin'

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return items.filter((e) => {
      if (!showInactive && !e.is_active) return false
      if (!s) return true
      const hay = [
        e.name,
        e.muscle_group,
        e.type,
        e.equipment ?? '',
        ...(e.aliases ?? []),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(s)
    })
  }, [items, search, showInactive])

  const activeBankText = useMemo(() => {
    return buildExerciseBankText(
      items
        .filter((item) => item.is_active)
        .map((item) => ({
          name: item.name,
          muscle_group: item.muscle_group,
          type: item.type,
          equipment: item.equipment,
          aliases: item.aliases ?? [],
        }))
    )
  }, [items])

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(successMessage)
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível copiar.')
    }
  }

  async function load() {
    setLoading(true)
    setErrorMsg(null)
    try {
      // Admin pode ver tudo; policies já permitem
      const { data, error } = await supabase
        .from('exercises')
        .select('id,name,muscle_group,type,equipment,aliases,notes,is_active,created_at,updated_at')
        .order('name', { ascending: true })

      if (error) throw error
      setItems((data ?? []) as Exercise[])
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Erro ao carregar exercícios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setErrorMsg(null)
    setIsModalOpen(true)
  }

  function openEdit(ex: Exercise) {
    setEditingId(ex.id)
    setForm({
      name: ex.name,
      muscle_group: ex.muscle_group,
      type: ex.type,
      equipment: ex.equipment,
      aliases: ex.aliases ?? [],
      notes: ex.notes,
      is_active: ex.is_active,
    })
    setErrorMsg(null)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingId(null)
    setForm(emptyForm())
    setErrorMsg(null)
  }

  async function save() {
    if (!canAdmin) return
    const name = form.name.trim()
    if (!name) {
      setErrorMsg('Nome é obrigatório.')
      return
    }

    setSaving(true)
    setErrorMsg(null)
    try {
      const payload = {
        name,
        muscle_group: form.muscle_group,
        type: form.type,
        equipment: form.equipment?.trim() ? form.equipment.trim() : null,
        aliases: (form.aliases ?? []).map((a) => a.trim()).filter(Boolean),
        notes: form.notes?.trim() ? form.notes.trim() : null,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error } = await supabase.from('exercises').update(payload).eq('id', editingId)
        if (error) throw error
      } else {
        // created_by é opcional; se quiser, podemos preencher depois via trigger
        const { error } = await supabase.from('exercises').insert(payload)
        if (error) throw error
      }

      await load()
      closeModal()
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Erro ao salvar exercício.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(ex: Exercise) {
    if (!canAdmin) return
    try {
      const { error } = await supabase
        .from('exercises')
        .update({ is_active: !ex.is_active, updated_at: new Date().toISOString() })
        .eq('id', ex.id)
      if (error) throw error
      await load()
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Erro ao atualizar status.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-white">Admin • Exercícios</h2>
          <p className="text-white/70">
            Cadastre exercícios para montar Programas/Splits. Desativar mantém histórico.
          </p>
        </div>

        {canAdmin && (
          <button
            onClick={openCreate}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
          >
            + Novo exercício
          </button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar (nome, grupo, equipamento, alias...)"
          className="w-full max-w-md px-3 py-2 rounded-lg bg-card border border-border text-white placeholder:text-white/40"
        />

        <label className="flex items-center gap-2 text-white/70 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Mostrar inativos
        </label>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-white">Solicitar treino para IA</h3>
            <p className="text-sm text-white/70">
              Copie o prompt, a lista do banco e o modelo JSON para pedir um treino semanal já compatível com a importação em `Programas`.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void copyText(buildAiWorkoutPrompt(), 'Prompt copiado.')}
              className="px-3 py-2 rounded-lg border border-border bg-background text-white hover:bg-muted/40"
            >
              Copiar prompt
            </button>
            <button
              onClick={() => void copyText(activeBankText, 'Banco de exercícios copiado.')}
              className="px-3 py-2 rounded-lg border border-border bg-background text-white hover:bg-muted/40"
            >
              Copiar exercícios do banco
            </button>
            <button
              onClick={() => void copyText(WORKOUT_JSON_TEMPLATE, 'Modelo JSON copiado.')}
              className="px-3 py-2 rounded-lg border border-border bg-background text-white hover:bg-muted/40"
            >
              Copiar modelo JSON
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="text-sm font-medium text-white">Prompt</div>
            <p className="mt-1 text-xs text-white/60">
              Explica o formato do JSON, campos aceitos, diferenças entre `strength` e `cardio`, além das regras para dias vazios e exercícios por tempo.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="text-sm font-medium text-white">Banco</div>
            <p className="mt-1 text-xs text-white/60">
              Lista os exercícios ativos com grupo, tipo, equipamento e aliases para ajudar a IA a responder com nomes mais compatíveis.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="text-sm font-medium text-white">Modelo JSON</div>
            <p className="mt-1 text-xs text-white/60">
              Entrega uma estrutura pronta de semana com `days`, `weekday` e `items` para colar direto no importador.
            </p>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-200">
          {errorMsg}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-white font-medium">Lista</p>
          <button
            onClick={load}
            className="text-sm text-white/70 hover:text-white"
            disabled={loading}
          >
            {loading ? 'Carregando...' : 'Recarregar'}
          </button>
        </div>

        <div className="p-2">
          {loading ? (
            <div className="p-4 text-white/70">Carregando exercícios...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-white/70">Nenhum exercício encontrado.</div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((ex) => (
                <li key={ex.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">
                      {ex.name}{' '}
                      {!ex.is_active && (
                        <span className="text-xs text-white/50">(inativo)</span>
                      )}
                    </p>
                    <p className="text-white/60 text-sm">
                      {ex.muscle_group} • {ex.type === 'strength' ? 'Força' : 'Cardio'}
                      {ex.equipment ? ` • ${ex.equipment}` : ''}
                    </p>
                    {ex.aliases?.length ? (
                      <p className="text-white/40 text-xs mt-1">
                        Aliases: {ex.aliases.join(', ')}
                      </p>
                    ) : null}
                  </div>

                  {canAdmin && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => openEdit(ex)}
                        className="px-3 py-1.5 rounded-lg bg-muted text-white/90 hover:text-white"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => toggleActive(ex)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg border',
                          ex.is_active
                            ? 'border-border text-white/80 hover:text-white'
                            : 'border-border text-white/80 hover:text-white'
                        )}
                      >
                        {ex.is_active ? 'Desativar' : 'Ativar'}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Modal simples */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-card border border-border p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {editingId ? 'Editar exercício' : 'Novo exercício'}
                </h3>
                <p className="text-white/60 text-sm">
                  Preencha os campos principais. Você pode deixar “Peso sugerido” para o plano (mais tarde).
                </p>
              </div>
              <button onClick={closeModal} className="text-white/70 hover:text-white">
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-200 mb-3">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-white/70 text-sm">Nome</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-white"
                  placeholder="Ex: Supino máquina (Chest Press)"
                />
              </div>

              <div className="space-y-1">
                <label className="text-white/70 text-sm">Grupo</label>
                <select
                  value={form.muscle_group}
                  onChange={(e) => setForm((p) => ({ ...p, muscle_group: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-white"
                >
                  {MUSCLE_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-white/70 text-sm">Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ExerciseType }))}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-white"
                >
                  <option value="strength">Força</option>
                  <option value="cardio">Cardio</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-white/70 text-sm">Equipamento (opcional)</label>
                <select
                  value={form.equipment ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, equipment: e.target.value ? e.target.value : null }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-white"
                >
                  <option value="">—</option>
                  {EQUIPMENTS.map((eq) => (
                    <option key={eq} value={eq}>
                      {eq}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-white/70 text-sm">Aliases (separe por vírgula)</label>
                <input
                  value={(form.aliases ?? []).join(', ')}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      aliases: e.target.value
                        .split(',')
                        .map((x) => x.trim())
                        .filter(Boolean),
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-white"
                  placeholder="Ex: Puxada na frente, Lat Pulldown"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-white/70 text-sm">Notas (opcional)</label>
                <textarea
                  value={form.notes ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-white min-h-[90px]"
                  placeholder="Dica técnica / restrição / observações..."
                />
              </div>

              <label className="flex items-center gap-2 text-white/70 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                Exercício ativo (visível para usuários)
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={closeModal}
                className="px-4 py-2 rounded-lg bg-muted text-white/90 hover:text-white"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={save}
                className={cn(
                  'px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90',
                  saving && 'opacity-70 cursor-not-allowed'
                )}
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
