"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Tooltip } from "recharts"

interface MonthlyReturnsChartProps {
  data: any[]
}

export function MonthlyReturnsChart({ data }: MonthlyReturnsChartProps) {
  // Ensure data is valid
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  // Custom bar component to render different colors based on value
  const CustomBar = (props: any) => {
    const { x, y, width, height, value } = props
    const fill = value >= 0 ? "#4ade80" : "#f87171"

    return <rect x={x} y={y} width={width} height={height} fill={fill} radius={[4, 4, 0, 0]} />
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="monthName" />
        <YAxis tickFormatter={(value) => `${(value * 100).toFixed(2)}%`} domain={["auto", "auto"]} />
        <Tooltip
          formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
          labelFormatter={(label) => `Month: ${label}`}
        />
        <ReferenceLine y={0} stroke="#666" />
        <Bar dataKey="return" name="Average Return" shape={<CustomBar />} />
      </BarChart>
    </ResponsiveContainer>
  )
}
