export function getArchivePageImageUrl(
  archiveIdentifier: string,
  scanPage: number,
) {
  return [
    `https://archive.org/download/${archiveIdentifier}`,
    `/page/n${scanPage}_medium.jpg`,
  ].join("");
}