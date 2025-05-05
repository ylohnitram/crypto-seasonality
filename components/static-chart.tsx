"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"

const staticData = [
  { name: "Jan", value: 5 },
  { name: "Feb", value: -3 },
  { name: "Mar", value: 2 },
  { name: "Apr", value: 1 },
  { name: "May", value: -2 },
  { name: "Jun", value: 4 },
  { name: "Jul", value: 6 },
  { name: "Aug", value: -1 },
  { name: "Sep", value: 3 },
  { name: "Oct", value: -2 },
  { name: "Nov", value: 5 },
  { name: "Dec", value: 7 },
]

export function StaticChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={staticData}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" />
        <YAxis />
        <Bar dataKey="value" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  )
}
