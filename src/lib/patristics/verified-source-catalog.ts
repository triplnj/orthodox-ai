/**
 * Maintained provenance catalog, reviewed 2026-11-03.
 * "Verified" means provenance/ownership was checked against an official
 * jurisdiction directory, the source's own publication, or a university guide.
 * It does NOT mean every document on a host is Orthodox, authentic, licensed,
 * or usable as a primary patristic quotation. Review content per document.
 * No crawling is implied by permitting a vetted hostname.
 */
export type OrthodoxSourceCategory =
  | "official_church"
  | "orthodox_library"
  | "orthodox_academic"
  | "academic_bibliography"
  | "patristic_text_archive";

export type VerifiedOrthodoxSource = {
  host: string;
  name: string;
  category: OrthodoxSourceCategory;
  language: string;
  verificationUrl: string;
  fetchable: boolean;
};

export const VERIFIED_ORTHODOX_SOURCE_CATALOG: readonly VerifiedOrthodoxSource[] = [
  { host: "oca.org", name: "Orthodox Church in America", category: "official_church", language: "en", verificationUrl: "https://www.oca.org/orthodoxy/the-orthodox-faith/church-history/eighteenth-century/the-greek-church", fetchable: true },
  { host: "goarch.org", name: "Greek Orthodox Archdiocese of America", category: "official_church", language: "en", verificationUrl: "https://www.goarch.org/ourfaith", fetchable: true },
  { host: "spc.rs", name: "Serbian Orthodox Church", category: "official_church", language: "sr", verificationUrl: "https://www.spc.rs", fetchable: true },
  { host: "patriarhia.ro", name: "Romanian Orthodox Patriarchate", category: "official_church", language: "ro", verificationUrl: "https://patriarhia.ro/en/organization-of-the-romanian-orthodox-church/patriarch-of-romania/", fetchable: true },
  { host: "orthodoxalbania.org", name: "Orthodox Autocephalous Church of Albania", category: "official_church", language: "sq", verificationUrl: "https://orthodoxalbania.org/2026/en/our-church/", fetchable: true },
  { host: "antiochian.org", name: "Antiochian Orthodox Archdiocese of North America", category: "official_church", language: "en", verificationUrl: "https://www.assemblyofbishops.org/directories/jurisdictions", fetchable: true },
  { host: "ec-patr.org", name: "Ecumenical Patriarchate", category: "official_church", language: "el", verificationUrl: "https://arhiva.patriarhia.ro/biserici-ortodoxe-surori-159.html", fetchable: true },
  { host: "antiochpatriarchate.org", name: "Patriarchate of Antioch", category: "official_church", language: "en", verificationUrl: "https://antiochpatriarchate.org/en/home/", fetchable: true },
  { host: "patriarchateofalexandria.com", name: "Patriarchate of Alexandria", category: "official_church", language: "el", verificationUrl: "https://arhiva.patriarhia.ro/biserici-ortodoxe-surori-159.html", fetchable: true },
  { host: "jerusalem-patriarchate.info", name: "Patriarchate of Jerusalem", category: "official_church", language: "el", verificationUrl: "https://arhiva.patriarhia.ro/biserici-ortodoxe-surori-159.html", fetchable: true },
  { host: "patriarchia.ru", name: "Moscow Patriarchate", category: "official_church", language: "ru", verificationUrl: "https://arhiva.patriarhia.ro/biserici-ortodoxe-surori-159.html", fetchable: true },
  { host: "bg-patriarshia.bg", name: "Bulgarian Orthodox Patriarchate", category: "official_church", language: "bg", verificationUrl: "https://arhiva.patriarhia.ro/biserici-ortodoxe-surori-159.html", fetchable: true },
  { host: "patriarchate.ge", name: "Georgian Orthodox Patriarchate", category: "official_church", language: "ka", verificationUrl: "https://arhiva.patriarhia.ro/biserici-ortodoxe-surori-159.html", fetchable: true },
  { host: "churchofcyprus.org.cy", name: "Church of Cyprus", category: "official_church", language: "el", verificationUrl: "https://www.holycouncil.org/churches", fetchable: true },
  { host: "ecclesiagreece.gr", name: "Church of Greece", category: "official_church", language: "el", verificationUrl: "https://arhiva.patriarhia.ro/biserici-ortodoxe-surori-159.html", fetchable: true },
  { host: "orthodox.pl", name: "Polish Autocephalous Orthodox Church", category: "official_church", language: "pl", verificationUrl: "https://www.holycouncil.org/churches", fetchable: true },
  { host: "acrod.org", name: "American Carpatho-Russian Orthodox Diocese", category: "official_church", language: "en", verificationUrl: "https://www.assemblyofbishops.org/directories/jurisdictions", fetchable: true },
  { host: "uocofusa.org", name: "Ukrainian Orthodox Church of USA", category: "official_church", language: "en", verificationUrl: "https://www.assemblyofbishops.org/directories/jurisdictions", fetchable: true },
  { host: "svetosavlje.org", name: "Svetosavlje Serbian patristic library", category: "orthodox_library", language: "sr", verificationUrl: "https://svetosavlje.org/biblioteka-index/", fetchable: true },
  { host: "myriobiblos.gr", name: "Myriobiblos Church of Greece text library", category: "orthodox_library", language: "el", verificationUrl: "https://www.myriobiblos.gr/texts/index_gen_en.html", fetchable: true },
  { host: "apostoliki-diakonia.gr", name: "Apostoliki Diakonia Church of Greece", category: "orthodox_library", language: "el", verificationUrl: "https://apostoliki-diakonia.gr/en/links-en/", fetchable: true },
  { host: "pravoslavie.ru", name: "Pravoslavie.ru Orthodox educational resources", category: "orthodox_library", language: "ru", verificationUrl: "https://pravoslavie.ru", fetchable: true },
  { host: "azbyka.ru", name: "Azbyka Orthodox text library", category: "orthodox_library", language: "ru", verificationUrl: "https://azbyka.ru", fetchable: true },
  { host: "svots.edu", name: "St Vladimir Orthodox Theological Seminary library", category: "orthodox_academic", language: "en", verificationUrl: "https://www.svots.edu/academics/library", fetchable: true },
  { host: "peterlang.com", name: "Peter Lang scholarly publication metadata", category: "academic_bibliography", language: "en", verificationUrl: "https://www.peterlang.com/document/1100560", fetchable: true },
  { host: "newadvent.org", name: "New Advent patristic translations (non-Orthodox host)", category: "patristic_text_archive", language: "en", verificationUrl: "https://www.newadvent.org/fathers/230309.htm", fetchable: true },
  { host: "ccel.org", name: "Christian Classics Ethereal Library (ecumenical host)", category: "patristic_text_archive", language: "en", verificationUrl: "https://ccel.org/fathers", fetchable: true },
  { host: "tertullian.org", name: "Tertullian Project patristic documents", category: "patristic_text_archive", language: "en", verificationUrl: "https://oekumene.uni-graz.at/en/research/sources-for-the-church-fathers/", fetchable: true },
  { host: "archive.org", name: "Internet Archive digitized editions", category: "patristic_text_archive", language: "multi", verificationUrl: "https://oekumene.uni-graz.at/en/research/sources-for-the-church-fathers/", fetchable: true },
  { host: "documentacatholicaomnia.eu", name: "Documenta Catholica Omnia old patristic texts", category: "patristic_text_archive", language: "multi", verificationUrl: "https://oekumene.uni-graz.at/en/research/sources-for-the-church-fathers/", fetchable: true },
  { host: "vlioras.gr", name: "Greek primary text archive", category: "patristic_text_archive", language: "el", verificationUrl: "https://www.vlioras.gr/Philologia/History/Byzantine/Texts/Damaskinos_Peri_Eikonon.htm", fetchable: true },
  { host: "gutenberg.org", name: "Project Gutenberg public domain editions", category: "patristic_text_archive", language: "multi", verificationUrl: "https://www.gutenberg.org/cache/epub/49917/pg49917-images.html", fetchable: true },
];

// Only the exact reviewed hosts are accepted: do not allow arbitrary subdomains.
export const VERIFIED_SOURCE_HOSTS = new Set(
  VERIFIED_ORTHODOX_SOURCE_CATALOG.filter(entry => entry.fetchable)
    .flatMap(entry => [entry.host, `www.${entry.host}`]),
);
