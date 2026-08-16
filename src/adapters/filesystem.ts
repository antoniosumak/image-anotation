import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { createServerFn } from '@tanstack/react-start'

/**
 * Where written reports land, relative to where the app was started. A
 * directory of its own, so a session's worth of reports is one place to clear.
 */
const REPORTS_DIRECTORY = 'reports'

/**
 * How many names are tried before giving up. Two reports written in the same
 * millisecond is the case this covers; needing more than a handful of tries
 * means something other than this app is making the files.
 */
const NAME_ATTEMPTS = 10

/**
 * Writes the rasterized report to the developer's disk and says where it went.
 *
 * The only server-side thing this app does: a browser page cannot write to an
 * arbitrary local path, and a path is the whole point here — it is what the
 * text block beside the image names, so one paste carries both.
 */
export const writeReportImage = createServerFn({ method: 'POST' })
  .validator((data: FormData) => data)
  .handler(async ({ data }) => {
    const image = data.get('image')
    if (!(image instanceof Blob)) {
      throw new Error('No report image was sent to write')
    }

    // Absolute, because the coding agent reading the text block is not
    // necessarily working from the directory the app was started in.
    const directory = resolve(process.cwd(), REPORTS_DIRECTORY)
    await mkdir(directory, { recursive: true })

    const path = await writeWithoutOverwriting(
      directory,
      await image.arrayBuffer(),
    )

    return { path }
  })

/**
 * Writes the image under a name nothing else is using. Every report written
 * gets its own file: a text block already pasted into a coding agent names the
 * image it was written beside, and that image has to still be the one it
 * describes.
 */
async function writeWithoutOverwriting(
  directory: string,
  bytes: ArrayBuffer,
): Promise<string> {
  // Named for when it was written, so the reports in the directory read in the
  // order they were made — and so two of them rarely reach for the same name.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')

  for (let attempt = 1; attempt <= NAME_ATTEMPTS; attempt++) {
    const path = join(
      directory,
      attempt === 1 ? `report-${stamp}.png` : `report-${stamp}-${attempt}.png`,
    )
    try {
      // `wx` fails rather than truncating, so a report that is already there is
      // never written over by one made in the same millisecond.
      await writeFile(path, new Uint8Array(bytes), { flag: 'wx' })
      return path
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }

  throw new Error(`Could not find a free name for the report in ${directory}`)
}
