// Process monthly data for seasonality analysis
export function processSeasonalityData(monthlyData: any[]) {
  if (!Array.isArray(monthlyData) || monthlyData.length === 0) {
    return {
      monthlyReturns: [],
      heatmapData: {},
      years: [],
    }
  }

  try {
    // Extract unique years
    const years = [...new Set(monthlyData.map((item) => item.year))].sort()

    // Process monthly returns (average by month)
    const monthlyReturns = Array(12)
      .fill(0)
      .map((_, index) => ({
        month: index + 1,
        monthName: getMonthName(index + 1),
        return: 0,
        count: 0,
      }))

    // Process heatmap data (returns by year and month)
    const heatmapData: Record<string, number> = {}

    for (const item of monthlyData) {
      if (item && typeof item.month === "number" && item.return_pct !== null) {
        // Add to monthly returns
        const monthIndex = item.month - 1
        if (monthIndex >= 0 && monthIndex < 12) {
          monthlyReturns[monthIndex].return += Number(item.return_pct)
          monthlyReturns[monthIndex].count += 1
        }

        // Add to heatmap data
        const key = `${item.year}-${item.month}`
        heatmapData[key] = Number(item.return_pct)
      }
    }

    // Calculate average returns
    for (const month of monthlyReturns) {
      if (month.count > 0) {
        month.return = month.return / month.count
      }
    }

    return {
      monthlyReturns,
      heatmapData,
      years,
    }
  } catch (error) {
    console.error("Error processing seasonality data:", error)
    return {
      monthlyReturns: [],
      heatmapData: {},
      years: [],
    }
  }
}

// Helper function to get month name
function getMonthName(month: number): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return months[month - 1] || ""
}
