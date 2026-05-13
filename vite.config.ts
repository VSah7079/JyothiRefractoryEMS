import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {
  recalculateDerivedData,
  seedWorkbookData,
  type WorkbookData,
} from './src/lib/employeeData'

const configDirectory = path.resolve(fileURLToPath(new URL('.', import.meta.url)))
const workbookDirectory = path.join(configDirectory, 'data')
const workbookPath = path.join(workbookDirectory, 'employee-management.xlsx')

function toSheets(workbookData: WorkbookData) {
  return {
    Employees: workbookData.employees,
    Companies: workbookData.companies,
    Attendance: workbookData.attendance,
    Salary: workbookData.salaries,
    Advance: workbookData.advances,
    WorkDetails: workbookData.workDetails,
  }
}

function createWorkbook(workbookData: WorkbookData) {
  const workbook = XLSX.utils.book_new()

  for (const [sheetName, rows] of Object.entries(toSheets(workbookData))) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName)
  }

  return workbook
}

function ensureWorkbook() {
  mkdirSync(workbookDirectory, { recursive: true })

  if (!existsSync(workbookPath)) {
    XLSX.writeFile(createWorkbook(seedWorkbookData), workbookPath)
  }
}

function readWorkbookFile() {
  ensureWorkbook()
  const parsed = XLSX.readFile(workbookPath)

  return recalculateDerivedData(
    {
      employees: XLSX.utils.sheet_to_json(parsed.Sheets.Employees ?? {}, { defval: '' }),
      companies: XLSX.utils.sheet_to_json(parsed.Sheets.Companies ?? {}, { defval: '' }),
      attendance: XLSX.utils.sheet_to_json(parsed.Sheets.Attendance ?? {}, { defval: '' }),
      salaries: XLSX.utils.sheet_to_json(parsed.Sheets.Salary ?? {}, { defval: '' }),
      advances: XLSX.utils.sheet_to_json(parsed.Sheets.Advance ?? {}, { defval: '' }),
      workDetails: XLSX.utils.sheet_to_json(parsed.Sheets.WorkDetails ?? {}, { defval: '' }),
    },
    seedWorkbookData,
  )
}

function writeWorkbookFile(workbookData: WorkbookData) {
  ensureWorkbook()
  XLSX.writeFile(createWorkbook(workbookData), workbookPath)
}

function workbookApiPlugin(): Plugin {
  return {
    name: 'workbook-api',
    configureServer(server) {
      ensureWorkbook()

      server.middlewares.use('/api/state', async (req, res, next) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(readWorkbookFile()))
          return
        }

        if (req.method === 'PUT') {
          const body = await new Promise<string>((resolve) => {
            const chunks: Buffer[] = []

            req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
            req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
          })

          const incoming = JSON.parse(body) as WorkbookData
          const workbookData = recalculateDerivedData(incoming, readWorkbookFile())

          writeWorkbookFile(workbookData)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true }))
          return
        }

        next()
      })

      server.middlewares.use('/api/download', (_req, res, next) => {
        ensureWorkbook()
        const file = readFileSync(workbookPath)

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Content-Disposition', 'attachment; filename="employee-management.xlsx"')
        res.end(file)
        next()
      })
    },
    buildStart() {
      ensureWorkbook()
    },
  }
}

export default defineConfig({
  server: {
    open: false,
  },
  plugins: [tailwindcss(), react(), workbookApiPlugin()],
})
