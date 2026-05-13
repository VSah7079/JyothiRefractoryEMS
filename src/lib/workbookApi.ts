import type { WorkbookData } from './employeeData'

const STORAGE_KEY = 'jyothi-workbook-data'

export async function loadWorkbookData(): Promise<WorkbookData | null> {
  try {
    const response = await fetch('/api/state')

    if (response.ok) {
      return (await response.json()) as WorkbookData
    }
  } catch {
    return null
  }

  return null
}

export async function saveWorkbookData(data: WorkbookData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

  try {
    await fetch('/api/state', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
  } catch {
    return
  }
}

export function getCachedWorkbookData() {
  const saved = localStorage.getItem(STORAGE_KEY)

  if (!saved) {
    return null
  }

  try {
    return JSON.parse(saved) as WorkbookData
  } catch {
    return null
  }
}
