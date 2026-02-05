export interface ImageMetadata {
id?: string; // optional if you later persist in DB
name: string;
url: string; // e.g. "/api/images/<file>"
size: number; // bytes
uploadedAt: string; // ISO string
description?: string;
category?: string;
subcategory?: string;
tags?: string[];
}
