import { DockerAuth } from './auth.js';
import { OciImageConfig, OciImageIndex, OciImageManifest, OciManifestDescriptor } from './oci-image-spec.js';
export interface Image {
    repository: string;
    tag: string;
}
export interface ImageInfo {
    os: string;
    architecture: string;
    variant?: string;
    digest: string;
    layers: string[];
}
export type ImageMap = Map<string, ImageInfo>;
export declare abstract class ContainerRegistry {
    protected baseUrl: string;
    constructor(baseUrl: string);
    private dockerContentDigest;
    private headers;
    protected abstract getToken(repository: string): Promise<string>;
    protected abstract getCredentials(): DockerAuth | undefined;
    getImageInfo(image: Image): Promise<ImageMap>;
    private handleImageIndex;
    private handleImageManifest;
    protected toImageInfoFromManifestDescriptor(manifestDescriptor: OciManifestDescriptor): Omit<ImageInfo, 'layers'>;
    protected fetchManifestByImage(image: Image): Promise<OciImageIndex | OciImageManifest>;
    protected fetchManifestByDigest(image: Image, digest: string): Promise<OciImageManifest>;
    protected fetchBlob(image: Image, digest: string): Promise<OciImageManifest | OciImageConfig>;
    private fetch;
}
//# sourceMappingURL=registry.d.ts.map