import {GitHubContainerRegistry} from '../src/github.js'

describe('GitHub and Docker', () => {
  const gitHubRegistry = new GitHubContainerRegistry()

  test('getImageInfo', async () => {
    const repository = 'ghcr.io/by-erik/nextcloud-ffmpeg'
    const tag = 'latest'
    await gitHubRegistry.getImageInfo({repository, tag})
  })
})
