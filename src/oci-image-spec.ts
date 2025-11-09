export interface OciImageIndex {
  schemaVersion: number
  mediaType: string
  manifests: OciManifestDescriptor[]
}

export interface OciManifestDescriptor {
  mediaType: string
  digest: string
  size: number
  platform: {
    architecture: string
    os: string
    variant?: string
  }
}

export function isOciImageIndex(obj: unknown): obj is OciImageIndex {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ((obj as OciImageIndex).mediaType === 'application/vnd.oci.image.index.v1+json' ||
      (obj as OciImageIndex).mediaType === 'application/vnd.docker.distribution.manifest.list.v2+json')
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

export function isOciImageManifest(obj: unknown): obj is OciImageManifest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ((obj as OciImageIndex).mediaType === 'application/vnd.oci.image.manifest.v1+json' ||
      (obj as OciImageIndex).mediaType === 'application/vnd.docker.distribution.manifest.v2+json')
  )
}

export interface OciImageConfig {
  architecture: string
  variant?: string
  os: string
  rootfs: {
    diff_ids: string[]
  }
}

export function isOciImageConfig(obj: unknown): obj is OciImageConfig {
  if (typeof obj !== 'object' || obj === null) return false

  const partialObj = obj as Partial<OciImageConfig>

  const hasArchitecture = typeof partialObj.architecture === 'string'
  const hasOs = typeof partialObj.os === 'string'
  const hasRootfs =
    typeof partialObj.rootfs === 'object' &&
    partialObj.rootfs !== null &&
    Array.isArray((partialObj.rootfs as {diff_ids?: unknown}).diff_ids) &&
    ((partialObj.rootfs as {diff_ids?: unknown}).diff_ids as unknown[]).every((id): id is string => typeof id === 'string')

  return hasArchitecture && hasOs && hasRootfs
}
