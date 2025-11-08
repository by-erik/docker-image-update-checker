import axios, {AxiosError} from 'axios'
import * as core from '@actions/core'
import {DockerAuth} from './auth.js'
import {isOciImageConfig, isOciImageIndex, isOciImageManifest, OciImageConfig, OciImageIndex, OciImageManifest} from './oci-image-spec.js'

export interface Image {
  repository: string
  tag: string
}

interface FetchResult {
  headers: Record<string, string>
  data: unknown
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

  private dockerContentDigest: string = ''

  protected abstract getToken(repository: string): Promise<string>

  protected abstract getCredentials(): DockerAuth | undefined

  protected async fetchBlobs(image: Image, digest: string, headers?: Record<string, string>): Promise<OciImageManifest | OciImageConfig> {
    const url = `https://${this.baseUrl}${image.repository}/blobs/${digest}`
    const fetchResult = await this.fetch(url, {
      ...headers,
      Accept: 'application/vnd.docker.container.image.v1+json,application/vnd.oci.image.config.v1+json',
    })
    if (isOciImageManifest(fetchResult.data) || isOciImageConfig(fetchResult.data)) {
      return fetchResult.data
    } else {
      const contentType = fetchResult.headers['content-type']
      throw new Error(`Unsupported content type: ${contentType}`)
    }
  }

  protected async fetchManifestByDigest(image: Image, digest: string, headers?: Record<string, string>): Promise<OciImageManifest> {
    const url = `https://${this.baseUrl}${image.repository}/manifests/${digest}`
    const fetchResult = await this.fetch(url, {
      ...headers,
      Accept: 'application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json',
    })
    this.dockerContentDigest = fetchResult.headers['docker-content-digest']
    if (isOciImageManifest(fetchResult.data)) {
      return fetchResult.data
    } else {
      const contentType = fetchResult.headers['content-type']
      throw new Error(`Unsupported content type: ${contentType}`)
    }
  }

  protected async fetchManifest(image: Image, headers?: Record<string, string>): Promise<OciImageIndex | OciImageManifest> {
    const url = `https://${this.baseUrl}${image.repository}/manifests/${image.tag}`
    const fetchResult = await this.fetch(url, headers)
    this.dockerContentDigest = fetchResult.headers['docker-content-digest']
    if (isOciImageIndex(fetchResult.data) || isOciImageManifest(fetchResult.data)) {
      return fetchResult.data
    } else {
      const contentType = fetchResult.headers['content-type']
      throw new Error(`Unsupported content type: ${contentType}`)
    }
  }

  protected async fetch(url: string, headers?: Record<string, string>): Promise<FetchResult> {
    try {
      const response = await axios.get<unknown>(url, {headers})
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

    core.debug(`Fetching manifest for image: ${image.repository}:${image.tag}`)
    const manifestResult = await this.fetchManifest(image, headers)

    core.debug(`Docker content digest: ${this.dockerContentDigest}`)

    if (isOciImageIndex(manifestResult)) {
      const imagesInfo = new Map<string, ImageInfo>()
      core.debug(`Initial imagesInfo: ${JSON.stringify(Array.from(imagesInfo.values()), null, 2)}`)
      for (const manifest of manifestResult.manifests) {
        core.debug(`Processing manifest: ${JSON.stringify(manifest, null, 2)}`)
        if (manifest.platform.architecture === 'unknown') {
          continue
        }

        const imageManifest = await this.fetchManifestByDigest(image, manifest.digest, headers)

        const imageInfo = {
          architecture: manifest.platform.architecture,
          digest: manifest.digest,
          os: manifest.platform?.os,
          variant: manifest.platform?.variant ? manifest.platform.variant : manifest.platform.architecture === 'arm64' ? 'v8' : undefined,
          layers: imageManifest.layers.map((layer) => layer.digest),
        }
        core.debug(`Generated imageInfo: ${JSON.stringify(imageInfo, null, 2)}`)
        imagesInfo.set(generateKey(imageInfo), imageInfo)
      }
      core.debug(`Found ${imagesInfo.size} images in manifest list for ${image.repository}:${image.tag}`)
      core.debug(`Images: ${JSON.stringify(Array.from(imagesInfo.values()), null, 2)}`)
      return imagesInfo
    } else if (isOciImageManifest(manifestResult)) {
      core.debug(`Processing single manifest for image: ${image.repository}:${image.tag}`)

      const blogResult = await this.fetchBlobs(image, manifestResult.config.digest, headers)
      if (!isOciImageConfig(blogResult)) {
        throw Error('Not a OciImageConfig response')
      }
      const config = blogResult

      core.debug(`Config for ${image.repository}:${image.tag}: ${JSON.stringify(config, null, 2)}`)

      const imageInfo = {
        architecture: config.architecture,
        digest: this.dockerContentDigest,
        os: config.os,
        variant: config.variant ? config.variant : config.architecture === 'arm64' ? 'v8' : undefined,
        layers: manifestResult.layers.map((layer) => layer.digest),
      }
      core.debug(`Found image for ${image.repository}:${image.tag}: ${JSON.stringify(imageInfo)}`)

      return new Map([[generateKey(imageInfo), imageInfo]])
    } else {
      throw new Error('Unsupported content type')
    }
  }
}
