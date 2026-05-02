import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as Dialog from '@radix-ui/react-dialog'
import { format } from 'date-fns'
import { X } from 'lucide-react'
import { z } from 'zod'
import { categories, paymentModes } from '@/lib/constants'
import { ExpenseInput } from '@/types'

const schema = z.object({
  amount:   z.coerce.number().min(1),
  category: z.string().min(1),
  mode:     z.enum(['UPI', 'Card', 'Cash']),
  bank:     z.string().min(1),
  note:     z.string().optional().default(''),
  date:     z.string(),
})
type FormValues = z.infer<typeof schema>

const fieldCls = `w-full h-11 rounded-lg bg-surface border border-border px-4 text-[15px] text-white
  placeholder:text-muted outline-none focus:border-primary/60 transition-colors`

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  banks: string[]
  defaults: Pick<ExpenseInput, 'category' | 'mode' | 'bank'>
  onSubmit: (input: ExpenseInput) => Promise<void> | void
}

export function QuickAddSheet({ open, onOpenChange, banks, defaults, onSubmit }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: undefined, category: defaults.category,
      mode: defaults.mode, bank: defaults.bank,
      note: '', date: format(new Date(), 'yyyy-MM-dd'),
    },
  })

  useEffect(() => {
    form.reset({
      amount: undefined, category: defaults.category,
      mode: defaults.mode, bank: defaults.bank,
      note: '', date: format(new Date(), 'yyyy-MM-dd'),
    })
  }, [defaults, form])

  const selectedCategory = form.watch('category')
  const Icon = useMemo(() => categories.find((c) => c.label === selectedCategory)?.icon, [selectedCategory])

  async function handleSubmit(values: FormValues) {
    await onSubmit({ ...values, note: values.note ?? '' })
    form.reset({ amount: undefined, category: values.category, mode: values.mode, bank: values.bank, note: '', date: format(new Date(), 'yyyy-MM-dd') })
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
              <select className={fieldCls} {...form.register('category')}>
                {categories.map((c) => (
                  <option key={c.label} value={c.label} className="bg-[#0F1319]">{c.label}</option>
                ))}
              </select>
              <select className={fieldCls} {...form.register('mode')}>
                {paymentModes.map((m) => (
                  <option key={m} value={m} className="bg-[#0F1319]">{m}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                list="bank-options"
                placeholder="Bank"
                className={fieldCls}
                {...form.register('bank')}
              />
              <input
                type="date"
                className={fieldCls}
                {...form.register('date')}
              />
            </div>

            <datalist id="bank-options">
              {banks.map((b) => <option key={b} value={b} />)}
            </datalist>

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
