import fs from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

/**
 * Write `content` to `targetPath` durably:
 *
 *   1. Write to a temp file in the same directory.
 *   2. fsync to ensure data is on disk.
 *   3. Rename over the target (atomic within a filesystem).
 *
 * Ensures readers never see a half-written file even if the process is
 * killed mid-write. Also creates parent directories if they don't exist.
 *
 * NOTE: this is intentionally per-call. For per-file serialization
 * (two writers to the same path racing), wrap callers with a mutex.
 */
export async function atomicWriteFile(targetPath: string, content: string | Buffer): Promise<void> {
  const dir = path.dirname(targetPath)
  await fs.mkdir(dir, { recursive: true })
  const tmp = path.join(dir, `.${path.basename(targetPath)}.${randomBytes(6).toString('hex')}.tmp`)

  const handle = await fs.open(tmp, 'w')
  try {
    await handle.writeFile(content)
    await handle.sync()
  } finally {
    await handle.close()
  }

  try {
    await fs.rename(tmp, targetPath)
  } catch (err) {
    // Clean up the temp file if rename failed (e.g. permissions).
    await fs.unlink(tmp).catch(() => {})
    throw err
  }
}

/**
 * Simple per-path mutex so multiple in-flight writers to the same file
 * serialize. Use the same instance across the process — exposed below.
 */
class PathMutex {
  private chain = new Map<string, Promise<unknown>>()

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chain.get(key) ?? Promise.resolve()
    let resolve!: () => void
    const slot = new Promise<void>((r) => { resolve = r })
    this.chain.set(key, prev.then(() => slot))
    try {
      await prev
      return await fn()
    } finally {
      resolve()
      // Clean up if no one is waiting on us.
      if (this.chain.get(key) === slot) this.chain.delete(key)
    }
  }
}

export const pathMutex = new PathMutex()
