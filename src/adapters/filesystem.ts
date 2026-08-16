import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { createServerFn } from '@tanstack/react-start'

/**
 * Where written reports land, inside the project they are about. A directory
 * of its own, so a session's worth of reports is one place to clear.
 */
const REPORTS_DIRECTORY = 'reports'

/**
 * Where to look for the project when the app is not being run from inside it.
 */
const PROJECT_DIRECTORY_VARIABLE = 'UI_DIVERGENCE_PROJECT_DIR'

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

    // Inside the project, and absolute. Inside, because a coding agent working
    // in that project can read a file under it without being asked for
    // permission to reach outside its own directory — and a report it cannot
    // open is a report that was never handed over. Absolute, because the text
    // block naming it is read somewhere that may be working from anywhere.
    const project = projectDirectory()
    const directory = resolve(project, REPORTS_DIRECTORY)
    await mkdir(directory, { recursive: true })

    const path = await writeWithoutOverwriting(
      directory,
      await image.arrayBuffer(),
    )

    return { path, projectDirectory: project }
  })

/**
 * The project a report is about: where its image is written, and where a
 * session opened from it starts.
 *
 * Where the app was started, unless told otherwise — run the tool from the
 * project you are marking up and that is already right. The environment
 * variable is for when it isn't: the tool running from its own checkout while
 * the code with the divergence in it is somewhere else.
 */
function projectDirectory(): string {
  return resolve(process.env[PROJECT_DIRECTORY_VARIABLE] || process.cwd())
}

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
