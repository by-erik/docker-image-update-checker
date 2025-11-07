import axios, {AxiosError} from 'axios'
import * as core from '@actions/core'
import {DockerAuth} from './auth.js'

export interface Image {
  repository: string
  tag: string
}

interface Manifest {
  schemaVersion: number
  mediaType: string
  config: {
    mediaType: string
    size: number
    digest: string
  }
  layers?: {
    mediaType: string
    size: number
    digest: string
  }[]
  mainfests?: {
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

interface OciImageIndex {
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

interface OciImageManifest {
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

interface OciImageConfig {
  architecture: string
  os: string
  variant: string
  rootfs: {
    diff_ids: string[]
  }
}

interface FetchResult {
  headers: Record<string, string>
  data: Manifest
}

export interface ImageInfo {
  os: string
  architecture: string
  variant?: string
  digest: string
  layers: string[]
}

export type ImageMap = Map<string, ImageInfo>

function generateKey(obj: ImageInfo): string {
  return [obj.os, obj.architecture, obj.variant || ''].join('|')
}

function convertHeaders(headers: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      result[key] = value
    }
  }
  return result
}

export abstract class ContainerRegistry {
  constructor(protected baseUrl: string) {}

  private dockerContentDigest: string = ""

  protected abstract getToken(repository: string): Promise<string>

  protected abstract getCredentials(): DockerAuth | undefined

  protected async getLayers(digest: string, repo: string, token: string): Promise<string[]> {
    const url = `https://${this.baseUrl}${repo}/manifests/${digest}`
    const headers = {
      Accept: 'application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json',
      Authorization: `Bearer ${token}`,
    }

    const fetchResult = await this.fetch(url, headers)

    const layers = fetchResult.data.layers as unknown as {digest: string}[]

    return layers.map((layer) => layer.digest)
  }

  protected async fetchManifest(baseUrl: string, image: Image, headers?: Record<string, string>): Promise<OciImageIndex|OciImageManifest> {
    const url = `https://${baseUrl}${image.repository}/manifests/${image.tag}`
    const fetchResult = await this.fetch(url, headers)

    core.debug(`Fetching manifest for image: ${image.repository}:${image.tag}`)
    const contentType = fetchResult.headers['content-type']
    this.dockerContentDigest = fetchResult.headers['docker-content-digest']
    core.debug(`Content type: ${contentType}`)
    core.debug(`Docker content digest: ${this.dockerContentDigest}`)

    if (contentType === 'application/vnd.oci.image.index.v1+json') {
      return fetchResult.data as unknown as OciImageIndex
    } else if (contentType === 'application/vnd.oci.image.manifest.v1+json') {
      return fetchResult.data as unknown as OciImageManifest
    } else {
      throw Error(`Unknown contentType: ${contentType}`)
    }
  }

  protected isOciImageIndex(
    data: OciImageIndex | OciImageManifest
  ): data is OciImageIndex {
    return data.mediaType === "application/vnd.oci.image.index.v1+json";
  }

  protected isOciImageManifest(
    data: OciImageIndex | OciImageManifest | OciImageConfig
  ): data is OciImageManifest {
    const obj = data as OciImageManifest
    return typeof obj.mediaType === "string" && obj.mediaType === "application/vnd.oci.image.manifest.v1+json";
  }

  protected isOciImageConfig(
    data: OciImageManifest | OciImageConfig
  ): data is OciImageConfig {
    if (typeof data !== "object" || data === null) return false;

    const obj = data as Partial<OciImageConfig>;

    const hasArchitecture = typeof obj.architecture === "string";
    const hasOs = typeof obj.os === "string";
    const hasVariant = typeof obj.variant === "string";

    const hasRootfs =
      typeof obj.rootfs === "object" &&
      obj.rootfs !== null &&
      Array.isArray((obj.rootfs as any).diff_ids) &&
      (obj.rootfs as any).diff_ids.every((id: any) => typeof id === "string");

    return hasArchitecture && hasOs && hasVariant && hasRootfs;
  }

  protected async fetchBlobs(digest: string, repo: string, token: string): Promise<OciImageConfig|OciImageManifest> {
    const url = `https://${this.baseUrl}${repo}/blobs/${digest}`
    const headers = {
        Accept: 'application/vnd.docker.container.image.v1+json,application/vnd.oci.image.config.v1+json',
        Authorization: `Bearer ${token}`,
      }
    const fetchResult = await this.fetch(url, headers)

    const manifest = fetchResult.data as unknown as OciImageConfig

    return manifest;
  }

  protected async fetch(url: string, headers?: Record<string, string>): Promise<FetchResult> {
    try {
      const response = await axios.get<Manifest>(url, {headers})
      if (core.isDebug()) {
        core.startGroup('Fetch response')
        core.info(`Fetching ${url}`)
        core.info(`Response status: ${response.status}`)
        core.info(`Response headers: ${JSON.stringify(response.headers, null, 2)}`)
        core.info(`Response data: ${JSON.stringify(response.data, null, 2)}`)
        core.endGroup()
      }
      return {
        headers: convertHeaders(response.headers),
        data: response.data,
      }
    } catch (error) {
      if (error instanceof Error) {
        const axiosError = error as AxiosError
        if (axiosError.response) {
          throw new Error(`Failed to fetch ${url}: ${axiosError.response.status} ${axiosError.response.statusText}`)
        }
        throw error
      }
      throw new Error('Unknown error occurred during fetch')
    }
  }

  async getImageInfo(image: Image): Promise<ImageMap> {
    core.debug(`Fetching token for repository: ${image.repository}`)
    const token = await this.getToken(image.repository)
    const headers = {
      Accept:
        'application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json',
      Authorization: `Bearer ${token}`,
    }

    const manifestResult = await this.fetchManifest(this.baseUrl, image, headers);
    
    if (this.isOciImageIndex(manifestResult)) {
      core.debug(`Processing manifest list for image: ${image.repository}:${image.tag}`)
      const manifestList = manifestResult

      const imagesInfo = new Map<string, ImageInfo>()
      core.debug(`Initial imagesInfo: ${JSON.stringify(Array.from(imagesInfo.values()), null, 2)}`)
      for (const manifest of manifestList.manifests) {
        core.debug(`Processing manifest: ${JSON.stringify(manifest, null, 2)}`)
        if (manifest.platform.architecture === 'unknown') {
          continue
        }
        if (manifest.platform.architecture !== 'amd64') {
          continue
        }
        const digest = manifest.digest
        const imageManifest = await this.fetchBlobs(digest, image.repository, token)
        if (!this.isOciImageManifest(imageManifest)) {
          throw Error("Unexpected")
        }

        const imageConfig = await this.fetchBlobs(imageManifest.config.digest, image.repository, token)
        if (!this.isOciImageConfig(imageConfig)) {
          throw Error("Unexpected config")
        }

        core.debug(`Generated imageInfo: ${JSON.stringify(imageConfig, null, 2)}`)

        const imageInfo = this.toImageInfo(imageConfig);
        core.debug(`Generated imageInfo: ${JSON.stringify(imageInfo, null, 2)}`)
        imagesInfo.set(generateKey(imageInfo), imageInfo)
      }
      core.debug(`Found ${imagesInfo.size} images in manifest list for ${image.repository}:${image.tag}`)
      core.debug(`Images: ${JSON.stringify(Array.from(imagesInfo.values()), null, 2)}`)
      return imagesInfo

    } else if (this.isOciImageManifest(manifestResult)) {
      core.debug(`Processing single manifest for image: ${image.repository}:${image.tag}`)
      const imageManifest = manifestResult

      const imageConfig = await this.fetchBlobs(imageManifest.config.digest, image.repository, token);
      if (!this.isOciImageConfig(imageConfig)) {
        throw Error("Unexpected")
      }
      core.debug(`Blob for ${image.repository}:${image.tag}: ${JSON.stringify(imageConfig, null, 2)}`)

      const imageInfo = this.toImageInfo(imageConfig);
      core.debug(`Found image for ${image.repository}:${image.tag}: ${JSON.stringify(imageInfo)}`)

      return new Map([[generateKey(imageInfo), imageInfo]])
    } else {
      throw new Error('Unsupported content type')
    }
  }

  async handleImageManifest(imageManifest: OciImageManifest, image: Image, token: string): Promise<ImageInfo> {
    const imageConfig = await this.fetchBlobs(imageManifest.config.digest, image.repository, token);
    if (!this.isOciImageConfig(imageConfig)) {
      throw Error("Unexpected")
    }
    const imageInfo = this.toImageInfo(imageConfig);
    core.debug(`Found image for ${image.repository}:${image.tag}: ${JSON.stringify(imageInfo)}`)
    return imageInfo;

  }

  toImageInfo(imageConfig: OciImageConfig): ImageInfo {
    const imageInfo: ImageInfo = {
        architecture: imageConfig.architecture,
        digest: this.dockerContentDigest,
        os: imageConfig.os,
        variant: imageConfig.variant ? imageConfig.variant : imageConfig.architecture === 'arm64' ? 'v8' : undefined,
        layers: imageConfig.rootfs.diff_ids
    }
    return imageInfo;
  }

}
