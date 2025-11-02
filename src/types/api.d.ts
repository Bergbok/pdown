export interface ShareInfoAPIResponse {
	Token: {
		Token: string;
		LinkType: number;
		LinkID: string;
		SharePasswordSalt: string;
		SharePassphrase: string;
		ShareKey: string;
		NodePassphrase: string;
		NodeKey: string;
		Name: string;
		ContentKeyPacket: string;
		MIMEType: string;
		Permissions: number;
		Size: number;
		ThumbnailURLInfo: {
			URL: string;
			BareURL: string;
			Token: string;
		};
		NodeHashKey: string | null;
		SignatureEmail: string | null;
		NodePassphraseSignature: string | null;
	};
	Code: number;
}

export interface FolderInfoAPIResponse {
	Code: number;
	AllowSorting: boolean;
	Links: Array<{
		LinkID: string;
		ParentLinkID: string;
		VolumeID: string;
		Type: number;
		Name: string;
		Hash: string;
		State: number;
		Size: number;
		TotalSize: number;
		MIMEType: string;
		Attributes: number;
		NodeKey: string;
		NodePassphrase: string;
		Permissions: number;
		FileProperties?: {
			ContentKeyPacket: string;
			ContentKeyPacketSignature: string;
			ActiveRevision: {
				ID: string;
				CreateTime: number;
				Size: number;
				State: number;
				Thumbnails: any[];
				Thumbnail: number;
				ThumbnailDownloadUrl: string | null;
				ThumbnailURLInfo: {
					BareURL: string | null;
					Token: string | null;
				};
				Photo: any | null;
			};
		} | null;
		FolderProperties?: any | null;
		AlbumProperties?: any | null;
		DocumentProperties?: any | null;
		PhotoProperties?: any | null;
		XAttr: string;
	}>;
}
