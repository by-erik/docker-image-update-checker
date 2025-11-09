export interface OciImageIndex {
    schemaVersion: number;
    mediaType: string;
    manifests: OciManifestDescriptor[];
}
export interface OciManifestDescriptor {
    mediaType: string;
    digest: string;
    size: number;
    platform: {
        architecture: string;
        os: string;
        variant?: string;
    };
}
export declare function isOciImageIndex(obj: unknown): obj is OciImageIndex;
export interface OciImageManifest {
    schemaVersion: number;
    mediaType: string;
    config: {
        mediaType: string;
        size: number;
        digest: string;
    };
    layers: {
        mediaType: string;
        size: number;
        digest: string;
    }[];
}
export declare function isOciImageManifest(obj: unknown): obj is OciImageManifest;
export interface OciImageConfig {
    architecture: string;
    variant?: string;
    os: string;
    rootfs: {
        diff_ids: string[];
    };
}
export declare function isOciImageConfig(obj: unknown): obj is OciImageConfig;
//# sourceMappingURL=oci-image-spec.d.ts.map