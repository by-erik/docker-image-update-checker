export interface OciImageIndex {
    schemaVersion: number;
    mediaType: string;
    manifests: {
        mediaType: string;
        digest: string;
        size: number;
        platform: {
            architecture: string;
            os: string;
            variant?: string;
        };
    }[];
}
export declare function isOciImageIndex(obj: any): obj is OciImageIndex;
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
export declare function isOciImageManifest(obj: any): obj is OciImageManifest;
//# sourceMappingURL=oci-image-spec.d.ts.map