import { useMemo } from 'react'
import {
  Bar, BarChart, Cell, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { Expense } from '@/types'
import { currency } from '@/lib/utils'

const PALETTE = ['#3B82F6', '#22C55E', '#F59E0B', '#A855F7', '#EF4444', '#38BDF8', '#FB923C']

const tooltipStyle = {
  background: '#121722',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 8,
  fontSize: 13,
  color: '#fff',
}

// Donut chart with simple colour legend — no card wrapper
export function CategoryDonut({ expenses }: { expenses: Expense[] }) {
  const data = useMemo(() => {
    const grouped = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
      return acc
    }, {})
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [expenses])

  if (data.length === 0) return null

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={60}
            outerRadius={88}
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={PALETTE[i % PALETTE.length]} strokeWidth={0} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => currency(v)}
            contentStyle={tooltipStyle}
            itemStyle={{ color: '#fff' }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-3 grid grid-cols-2 gap-y-2 gap-x-4">
        {data.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span className="size-2 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="text-[12px] text-muted truncate">{entry.name}</span>
            <span className="ml-auto text-[12px] tabular text-white">{currency(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Full analytics charts — no card wrappers
export function AnalyticsCharts({ expenses }: { expenses: Expense[] }) {
  const monthlyTrend = useMemo(() => {
    const grouped = expenses.reduce<Record<string, number>>((acc, e) => {
      const key = format(parseISO(e.date), 'MMM d')
      acc[key] = (acc[key] ?? 0) + e.amount
      return acc
    }, {})
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .slice(-14)
  }, [expenses])

  const categoryData = useMemo(() => {
    const grouped = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
      return acc
    }, {})
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [expenses])

  const bankData = useMemo(() => {
    const grouped = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.bank] = (acc[e.bank] ?? 0) + e.amount
      return acc
    }, {})
    return Object.entries(grouped).map(([name, value]) => ({ name, value }))
  }, [expenses])

  return (
    <div className="space-y-10">

      {/* Monthly trend */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-4">Monthly Trend</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={monthlyTrend}>
            <XAxis dataKey="name" stroke="#94A3B8" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis hide />
            <Tooltip formatter={(v: number) => currency(v)} contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#3B82F6', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </section>

      {/* Category split */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-4">Category Split</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={categoryData} barSize={24}>
            <XAxis dataKey="name" stroke="#94A3B8" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis hide />
            <Tooltip formatter={(v: number) => currency(v)} contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {categoryData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Bank split */}
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-4">Bank Split</p>
        <ResponsiveContainer width="100%" height={Math.max(120, bankData.length * 44)}>
          <BarChart data={bankData} layout="vertical" barSize={16}>
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              stroke="#94A3B8"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
              width={56}
            />
            <Tooltip formatter={(v: number) => currency(v)} contentStyle={tooltipStyle} itemStyle={{ color: '#fff' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#22C55E" />
          </BarChart>
        </ResponsiveContainer>
      </section>

    </div>
  )
}

// Keep old export names so nothing breaks
export { CategoryDonut as HomeCharts }
