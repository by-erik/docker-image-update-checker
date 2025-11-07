import {isOciImageIndex, isOciImageManifest, OciImageIndex, OciImageManifest} from '../src/oci-image-spec'

describe('Type guard functions', () => {
  it('should identify valid OciImageIndex', () => {
    const obj: OciImageIndex = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.index.v1+json',
      manifests: [
        {
          mediaType: 'application/vnd.oci.image.manifest.v1+json',
          digest: 'sha256:abc123',
          size: 12345,
          platform: {
            architecture: 'amd64',
            os: 'linux',
          },
        },
      ],
    }
    expect(isOciImageIndex(obj)).toBe(true)
  })

  it('should not identify invalid OciImageIndex', () => {
    const obj = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      manifests: [],
    }
    expect(isOciImageIndex(obj)).toBe(false)
  })

  it('should identify valid OciImageManifest', () => {
    const obj: OciImageManifest = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.manifest.v1+json',
      config: {
        mediaType: 'application/vnd.oci.image.config.v1+json',
        size: 345,
        digest: 'sha256:config123',
      },
      layers: [
        {
          mediaType: 'application/vnd.oci.image.layer.v1.tar',
          size: 12345,
          digest: 'sha256:layerabc',
        },
      ],
    }
    expect(isOciImageManifest(obj)).toBe(true)
  })

  it('should not identify invalid OciImageManifest', () => {
    const obj = {
      schemaVersion: 2,
      mediaType: 'application/vnd.oci.image.index.v1+json',
      layers: [],
    }
    expect(isOciImageManifest(obj)).toBe(false)
  })
})
