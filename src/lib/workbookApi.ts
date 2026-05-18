import type { WorkbookData } from './employeeData'

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
