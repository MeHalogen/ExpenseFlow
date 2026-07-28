import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as Dialog from '@radix-ui/react-dialog'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import { z } from 'zod'
import { categories, paymentModes, accounts } from '@/lib/constants'
import { buildTaxonomy, subcategoriesFor, deriveTxType } from '@/lib/taxonomy'
import { PasteSmsBox } from '@/components/PasteSmsBox'
import { Config, Expense, ExpenseInput } from '@/types'

const schema = z.object({
  amount: z.coerce.number().min(1),
  type: z.enum(['expense', 'income', 'investment']).default('expense'),
  category: z.string().min(1),
  subcategory: z.string().optional().default(''),
  mode: z.enum(['UPI', 'Card', 'Cash', 'Auto']),
  bank: z.string().optional().default(''),
  note: z.string().optional().default(''),
  date: z.string(),
}).refine((d) => d.mode === 'Cash' || (d.bank && d.bank.length > 0), {
  message: 'Account is required for UPI and Card', path: ['bank'],
})
type FormValues = z.infer<typeof schema>

const fieldCls = `w-full h-11 rounded-lg bg-surface border border-border px-4 text-[15px] text-white
  placeholder:text-muted outline-none focus:border-primary/60 transition-colors`

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  banks: string[]
  defaults: Pick<ExpenseInput, 'category' | 'mode' | 'bank'>
  config: Config
  onSubmit: (input: ExpenseInput) => Promise<void> | void
  onSubmitSms: (text: string) => Promise<{ status: string; expense?: Expense }>
}

export function QuickAddSheet({ open, onOpenChange, banks, defaults, config, onSubmit, onSubmitSms }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: undefined, type: 'expense', category: defaults.category, subcategory: '',
      mode: defaults.mode, bank: defaults.bank,
      note: '', date: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  useEffect(() => {
    form.reset({
      amount: undefined, type: 'expense', category: defaults.category, subcategory: '',
      mode: defaults.mode, bank: defaults.bank,
      note: '', date: format(new Date(), 'yyyy-MM-dd'),
    })
  }, [defaults, form])

  const selectedCategory = form.watch('category')
  const selectedMode     = form.watch('mode')
  const isCash           = selectedMode === 'Cash'
  const Icon = useMemo(() => categories.find((c) => c.label === selectedCategory)?.icon, [selectedCategory])
  const taxonomy = useMemo(() => buildTaxonomy(config.taxonomy), [config.taxonomy])
  const subcategoryOptions = useMemo(() => subcategoriesFor(taxonomy, selectedCategory), [taxonomy, selectedCategory])

  async function handleSubmit(values: FormValues) {
    await onSubmit({
      ...values,
      type: deriveTxType(values.category),
      note: values.note ?? '',
      bank: values.mode === 'Cash' ? 'Cash' : values.bank ?? '',
      subcategory: values.subcategory ?? '',
      merchant: '',
      status: 'confirmed',
      recurringId: '',
      rawSms: '',
    })
    form.reset({ amount: undefined, type: values.type, category: values.category, subcategory: '', mode: values.mode, bank: values.bank, note: '', date: format(new Date(), 'yyyy-MM-dd') })
    onOpenChange(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-[#0F1319] border-t border-border p-5 outline-none animate-slide-up">

          {/* Handle */}
          <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/10" />

          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="size-4 text-primary" />
                </div>
              )}
              <Dialog.Title className="text-base font-semibold text-white">Add Expense</Dialog.Title>
            </div>
            <Dialog.Close className="pressable flex size-8 items-center justify-center rounded-lg text-muted hover:text-white transition-colors">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <PasteSmsBox onSubmit={onSubmitSms} />

          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wider text-muted">or add manually</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Form */}
          <form className="space-y-3" onSubmit={form.handleSubmit(handleSubmit)}>
            <input
              autoFocus
              inputMode="decimal"
              placeholder="Amount"
              className={fieldCls}
              {...form.register('amount')}
            />

            <div className="grid grid-cols-2 gap-3">
              <select className={fieldCls} {...form.register('category')} onChange={(e) => {
                  form.setValue('category', e.target.value)
                  form.setValue('subcategory', '')
                }}>
                {categories.map((c) => (
                  <option key={c.label} value={c.label} className="bg-[#0F1319]">{c.label}</option>
                ))}
              </select>
              <select className={fieldCls} {...form.register('subcategory')}>
                <option value="" className="bg-[#0F1319]">Subcategory</option>
                {subcategoryOptions.map((s) => (
                  <option key={s} value={s} className="bg-[#0F1319]">{s}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select className={fieldCls} {...form.register('mode')} onChange={(e) => {
                  form.setValue('mode', e.target.value as 'UPI' | 'Card' | 'Cash' | 'Auto')
                  if (e.target.value === 'Cash') form.setValue('bank', '')
                }}>
                {paymentModes.map((m) => (
                  <option key={m} value={m} className="bg-[#0F1319]">{m}</option>
                ))}
              </select>
              {!isCash && (
                <select className={fieldCls} {...form.register('bank')}>
                  <option value="" className="bg-[#0F1319]">Select account</option>
                  {accounts.map((b) => (
                    <option key={b} value={b} className="bg-[#0F1319]">{b}</option>
                  ))}
                </select>
              )}
            </div>

            <input
              type="date"
              className={fieldCls}
              {...form.register('date')}
            />

            {form.formState.errors.bank && (
              <p className="text-xs text-danger">{form.formState.errors.bank.message}</p>
            )}

            <input
              placeholder="Note (optional)"
              className={fieldCls}
              {...form.register('note')}
            />

            {form.formState.errors.amount && (
              <p className="text-xs text-danger">Enter a valid amount</p>
            )}

            <button
              type="submit"
              className="pressable mt-2 w-full h-12 rounded-xl bg-primary text-sm font-semibold text-white transition-opacity active:opacity-80"
            >
              Save Expense
            </button>
          </form>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
