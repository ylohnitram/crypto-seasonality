"use client"

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const years = [2021, 2022, 2023]

// Static data for the heatmap
const staticData = {
  "2021-1": 0.05,
  "2021-2": -0.03,
  "2021-3": 0.02,
  "2021-4": 0.01,
  "2021-5": -0.02,
  "2021-6": 0.04,
  "2021-7": 0.06,
  "2021-8": -0.01,
  "2021-9": 0.03,
  "2021-10": -0.02,
  "2021-11": 0.05,
  "2021-12": 0.07,
  "2022-1": 0.03,
  "2022-2": -0.02,
  "2022-3": 0.04,
  "2022-4": 0.02,
  "2022-5": -0.03,
  "2022-6": 0.01,
  "2022-7": 0.05,
  "2022-8": -0.02,
  "2022-9": 0.04,
  "2022-10": -0.01,
  "2022-11": 0.03,
  "2022-12": 0.06,
  "2023-1": 0.04,
  "2023-2": -0.01,
  "2023-3": 0.03,
  "2023-4": 0.02,
  "2023-5": -0.02,
  "2023-6": 0.05,
  "2023-7": 0.07,
  "2023-8": -0.03,
  "2023-9": 0.02,
  "2023-10": -0.01,
  "2023-11": 0.04,
  "2023-12": 0.06,
}

export function StaticHeatmap() {
  // Get color for a return value
  const getColor = (returnValue) => {
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
                const returnValue = staticData[`${year}-${month}`]
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
