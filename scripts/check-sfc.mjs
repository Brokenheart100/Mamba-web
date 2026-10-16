import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parse } from '@vue/compiler-sfc'
async function scan(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await scan(path)
    else if (path.endsWith('.vue')) {
      const { errors } = parse(await readFile(path, 'utf8'), { filename: path })
      for (const error of errors) console.log(path, error.message, error.loc)
    }
  }
}
await scan('app')
