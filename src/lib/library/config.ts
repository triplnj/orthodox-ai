export const libraryEnabled = () => process.env.PATRISTIC_LIBRARY_ENABLED === "true";
export const libraryAdminIds = () => (process.env.BLOG_ADMIN_USER_IDS ?? "")
  .split(",").map(id => id.trim()).filter(Boolean);
export const LIBRARY_ROLES = ["AUTHOR","EDITOR","COMPILER","TRANSLATOR","ADAPTOR","COMMENTATOR","SOURCE_AUTHOR","UNKNOWN"] as const;
export const LIBRARY_AUTHENTICITY = ["AUTHENTIC","PROBABLY_AUTHENTIC","DISPUTED","PSEUDEPIGRAPHIC","MISATTRIBUTED","UNDETERMINED"] as const;
export const LIBRARY_TEXT_STATUS = ["FULL_TEXT","PARTIAL_TEXT","FRAGMENTS","METADATA_ONLY","LOST_WORK"] as const;
export const LIBRARY_RIGHTS = ["PUBLIC_DOMAIN","LICENSED","LINK_ONLY","UNKNOWN"] as const;
export const LIBRARY_SURVIVAL = ["COMPLETE","PARTIAL","FRAGMENTS","LOST","UNKNOWN"] as const;
export function librarySlug(value: string) {
 const slug=value.trim().toLowerCase().normalize("NFKD")
  .replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,90);
 if(!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Slug requires Latin letters or digits.");
 return slug;
}
export function libraryUrl(value: unknown): string | null {
 if (value === null || value === undefined || value === "") return null;
 if(typeof value !== "string" || value.length > 2048) throw new Error("Invalid reference URL.");
 const url=new URL(value);
 if(url.protocol!=="https:" || url.username || url.password || url.port) throw new Error("HTTPS reference required.");
 return url.toString();
}
export function libraryString(value: unknown, length=300): string {
 if(typeof value!=="string" || !value.trim() || value.length>length) throw new Error("Invalid text field.");
 return value.trim();
}
export function libraryOptional(value: unknown, length=500): string | null {
 if(value===undefined || value===null || value==="") return null;
 return libraryString(value,length);
}
export function libraryChoice(value: unknown, options: readonly string[], fallback: string) {
 if(value===undefined || value===null || value==="") return fallback;
 if(typeof value!=="string" || !options.includes(value)) throw new Error("Invalid enum value.");
 return value;
}
export function libraryInt(value: unknown, min=0, max=1000000):number|null {
 if(value===undefined||value===null||value==="")return null;
 if(typeof value!=="number"||!Number.isInteger(value)||value<min||value>max)throw new Error("Invalid integer.");
 return value;
}
