// Utility function for fetching data with retry logic and proper error handling
export async function fetchWithRetry(url: string, options = {}, retries = 3, backoff = 300) {
  try {
    const response = await fetch(url, options)

    // If rate limited or server error, retry with backoff
    if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
      if (retries === 0) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      console.log(`Rate limited or server error. Retrying in ${backoff}ms... (${retries} retries left)`)
      await new Promise((resolve) => setTimeout(resolve, backoff))
      return fetchWithRetry(url, options, retries - 1, backoff * 2)
    }

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    // Check if the response is JSON
    const contentType = response.headers.get("content-type")
    if (contentType && contentType.includes("application/json")) {
      return await response.json()
    } else {
      // Handle non-JSON response
      const text = await response.text()
      throw new Error(`Non-JSON response: ${text}`)
    }
  } catch (error) {
    if (retries === 0) throw error

    console.log(`Fetch error: ${error}. Retrying in ${backoff}ms... (${retries} retries left)`)
    await new Promise((resolve) => setTimeout(resolve, backoff))
    return fetchWithRetry(url, options, retries - 1, backoff * 2)
  }
}
