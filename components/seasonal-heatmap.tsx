"use client"

interface SeasonalHeatmapProps {
  data: Record<string, number>
  years: number[]
}

export function SeasonalHeatmap({ data, years }: SeasonalHeatmapProps) {
  // Ensure data is valid
  if (!data || Object.keys(data).length === 0 || !Array.isArray(years) || years.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  // Get color for a return value
  const getColor = (returnValue: number | undefined) => {
    if (returnValue === undefined) return "#f0f0f0"

    if (returnValue > 0) {
      // Green for positive
      const intensity = Math.min(returnValue * 5, 1)
      return `rgba(0, 128, 0, ${intensity})`
    } else {
      // Red for negative
      const intensity = Math.min(Math.abs(returnValue) * 5, 1)
      return `rgba(255, 0, 0, ${intensity})`
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-2 border"></th>
            {months.map((month) => (
              <th key={month} className="p-2 border text-center font-medium">
                {month}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td className="p-2 border font-medium text-center">{year}</td>
              {months.map((_, monthIndex) => {
                const month = monthIndex + 1
                const returnValue = data[`${year}-${month}`]
                const displayValue = returnValue !== undefined ? (returnValue * 100).toFixed(2) + "%" : "N/A"

                return (
                  <td
                    key={`${year}-${month}`}
                    className="p-2 border text-center"
                    style={{
                      backgroundColor: getColor(returnValue),
                      color: returnValue !== undefined ? (Math.abs(returnValue) > 0.15 ? "white" : "black") : "black",
                    }}
                  >
                    {displayValue}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
