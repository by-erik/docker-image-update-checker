export interface OciImageIndex {
  schemaVersion: number
  mediaType: string
  manifests: {
    mediaType: string
    digest: string
    size: number
    platform: {
      architecture: string
      os: string
      variant?: string
    }
  }[]
}

export function isOciImageIndex(obj: any): obj is OciImageIndex {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj.mediaType === 'application/vnd.oci.image.index.v1+json' ||
      obj.mediaType === 'application/vnd.docker.distribution.manifest.list.v2+json')
  )
}

export interface OciImageManifest {
  schemaVersion: number
  mediaType: string
  config: {
    mediaType: string
    size: number
    digest: string
  }
  layers: {
    mediaType: string
    size: number
    digest: string
  }[]
}

export function isOciImageManifest(obj: any): obj is OciImageManifest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj.mediaType === 'application/vnd.oci.image.manifest.v1+json' ||
      obj.mediaType === 'application/vnd.docker.distribution.manifest.v2+json')
  )
}
