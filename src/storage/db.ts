import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export interface ProjectRecord {
  id: string
  name: string
  rootFile: string
  createdAt: string
  updatedAt: string
}

export type FileKind = 'tex' | 'bib' | 'image' | 'other'

export interface FileRecord {
  id: string
  projectId: string
  path: string
  kind: FileKind
  content: string
  /** Raw bytes for binary files (images); `content` is empty for these. */
  data?: Uint8Array
  updatedAt: string
}

export interface MetaRecord {
  key: 'app'
  lastOpenedProjectId?: string
  seeded: boolean
}

interface TexaiStudioSchema extends DBSchema {
  projects: {
    key: string
    value: ProjectRecord
  }
  files: {
    key: string
    value: FileRecord
    indexes: {
      'by-project': string
      'by-project-path': [string, string]
    }
  }
  meta: {
    key: string
    value: MetaRecord
  }
}

const DB_NAME = 'texai-studio'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<TexaiStudioSchema>> | undefined

export function getDb(): Promise<IDBPDatabase<TexaiStudioSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<TexaiStudioSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('projects', { keyPath: 'id' })

        const files = db.createObjectStore('files', { keyPath: 'id' })
        files.createIndex('by-project', 'projectId')
        files.createIndex('by-project-path', ['projectId', 'path'], { unique: true })

        db.createObjectStore('meta', { keyPath: 'key' })
      },
    })
  }
  return dbPromise
}
