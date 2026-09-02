export type CorpusKind =
  | "PG"
  | "PHILOKALIA";


export type PatristicWorkIndex = {
  titleSr: string;
  titleEn: string;
  titleOriginal?: string;

  pgVolume?: number;
  pgColumns?: string;

  topics: string[];

  directUrl?: string;
};


export type PatristicAuthorIndex = {
  canonicalName: string;

  aliases: string[];

  pgVolumes?: number[];

  philokalia: boolean;

  works: PatristicWorkIndex[];
};


function pgVolumeUrl(
  volume: number,
) {
  return (
    "https://commons.wikimedia.org/wiki/" +
    `File:Patrologia_Graeca_Vol._${volume}.djvu`
  );
}


export const PATRISTIC_CORPUS_INDEX:
  PatristicAuthorIndex[] = [
    {
      canonicalName:
        "Свети Григорије Ниски",

      aliases: [
        "григорије ниски",
        "свети григорије ниски",
        "св. григорије ниски",
        "gregory of nyssa",
        "st gregory of nyssa",
        "st. gregory of nyssa",
        "gregorius nyssenus",
        "γρηγόριος νύσσης",
        "γρηγοριος νυσσης",
      ],

      pgVolumes: [
        44,
        45,
        46,
      ],

      philokalia:
        false,

      works: [
        {
          titleSr:
            "О души и васкрсењу",

          titleEn:
            "On the Soul and the Resurrection",

          titleOriginal:
            "De anima et resurrectione",

          pgVolume:
            46,

          pgColumns:
            "11–160",

          topics: [
            "душа",
            "души",
            "душе",
            "soul",
            "ψυχή",
            "смрт",
            "смрти",
            "death",
            "θάνατος",
            "васкрсење",
            "resurrection",
            "ἀνάστασις",
            "загробни живот",
            "after death",
          ],

          directUrl:
            pgVolumeUrl(46),
        },

        {
          titleSr:
            "О умрлима",

          titleEn:
            "On the Dead",

          titleOriginal:
            "De mortuis",

          pgVolume:
            46,

          topics: [
            "смрт",
            "смрти",
            "death",
            "мртви",
            "умрли",
            "dead",
            "душа",
            "soul",
          ],

          directUrl:
            pgVolumeUrl(46),
        },
      ],
    },


    {
      canonicalName:
        "Свети Јован Златоусти",

      aliases: [
        "јован златоусти",
        "свети јован златоусти",
        "св. јован златоусти",
        "john chrysostom",
        "st john chrysostom",
        "st. john chrysostom",
        "ioannes chrysostomus",
        "ἰωάννης χρυσόστομος",
        "ιωαννης χρυσοστομος",
      ],

      pgVolumes: Array.from(
        {
          length: 18,
        },
        (_, index) =>
          47 + index,
      ),

      philokalia:
        false,

      works: [],
    },


    {
      canonicalName:
        "Свети Максим Исповедник",

      aliases: [
        "максим исповедник",
        "свети максим исповедник",
        "св. максим исповедник",
        "maximus the confessor",
        "st maximus the confessor",
        "st. maximus the confessor",
        "maximus confessor",
        "μάξιμος ὁ ὁμολογητής",
        "μαξιμος ο ομολογητης",
      ],

      pgVolumes: [
        90,
        91,
      ],

      philokalia:
        true,

      works: [
        {
          titleSr:
            "Четири стотине глава о љубави",

          titleEn:
            "Four Hundred Texts on Love",

          titleOriginal:
            "Capita de caritate",

          pgVolume:
            90,

          topics: [
            "љубав",
            "љубави",
            "love",
            "ἀγάπη",
            "страсти",
            "passions",
            "πάθη",
            "ум",
            "mind",
            "νοῦς",
            "молитва",
            "prayer",
          ],

          directUrl:
            pgVolumeUrl(90),
        },

        {
          titleSr:
            "Амбигве",

          titleEn:
            "Ambigua",

          titleOriginal:
            "Ambigua",

          pgVolume:
            91,

          topics: [
            "стварање",
            "creation",
            "човек",
            "human",
            "логос",
            "logos",
            "природа",
            "nature",
            "воља",
            "will",
            "обожење",
            "deification",
            "theosis",
          ],

          directUrl:
            pgVolumeUrl(91),
        },

        {
          titleSr:
            "Мистагогија",

          titleEn:
            "Mystagogia",

          titleOriginal:
            "Mystagogia",

          pgVolume:
            91,

          topics: [
            "црква",
            "church",
            "литургија",
            "liturgy",
            "свет",
            "world",
            "човек",
            "human",
            "космос",
            "cosmos",
          ],

          directUrl:
            pgVolumeUrl(91),
        },
      ],
    },


    {
      canonicalName:
        "Свети Василије Велики",

      aliases: [
        "василије велики",
        "свети василије велики",
        "св. василије велики",
        "basil the great",
        "st basil the great",
        "st. basil the great",
        "basilius magnus",
        "βασίλειος ὁ μέγας",
        "βασιλειος ο μεγας",
      ],

      pgVolumes: [
        29,
        30,
        31,
        32,
      ],

      philokalia:
        false,

      works: [
        {
          titleSr:
            "Шестоднев",

          titleEn:
            "Hexaemeron",

          titleOriginal:
            "Hexaemeron",

          pgVolume:
            29,

          topics: [
            "стварање",
            "creation",
            "свет",
            "world",
            "космос",
            "cosmos",
            "постање",
            "genesis",
          ],

          directUrl:
            pgVolumeUrl(29),
        },
      ],
    },


    {
      canonicalName:
        "Свети Григорије Богослов",

      aliases: [
        "григорије богослов",
        "свети григорије богослов",
        "св. григорије богослов",
        "gregory nazianzen",
        "gregory of nazianzus",
        "st gregory nazianzen",
        "gregorius nazianzenus",
        "γρηγόριος ναζιανζηνός",
        "γρηγοριος ναζιανζηνος",
      ],

      pgVolumes: [
        35,
        36,
        37,
        38,
      ],

      philokalia:
        false,

      works: [],
    },


    {
      canonicalName:
        "Свети Атанасије Велики",

      aliases: [
        "атанасије велики",
        "свети атанасије велики",
        "св. атанасије велики",
        "athanasius",
        "athanasius the great",
        "st athanasius",
        "athanasius of alexandria",
        "ἀθανάσιος",
        "αθανασιος",
      ],

      pgVolumes: [
        25,
        26,
        27,
        28,
      ],

      philokalia:
        false,

      works: [],
    },


    {
      canonicalName:
        "Свети Кирило Александријски",

      aliases: [
        "кирил александријски",
        "кирилo александријски",
        "свети кирил александријски",
        "cyril of alexandria",
        "st cyril of alexandria",
        "cyrillus alexandrinus",
        "κύριλλος ἀλεξανδρείας",
        "κυριλλος αλεξανδρειας",
      ],

      pgVolumes: [
        68,
        69,
        70,
        71,
        72,
        73,
        74,
        75,
        76,
        77,
      ],

      philokalia:
        false,

      works: [],
    },


    {
      canonicalName:
        "Свети Јован Лествичник",

      aliases: [
        "јован лествичник",
        "свети јован лествичник",
        "св. јован лествичник",
        "john climacus",
        "st john climacus",
        "john of sinai",
        "ioannes climacus",
        "ἰωάννης τῆς κλίμακος",
        "ιωαννης της κλιμακος",
      ],

      pgVolumes: [
        88,
      ],

      philokalia:
        false,

      works: [
        {
          titleSr:
            "Лествица",

          titleEn:
            "The Ladder of Divine Ascent",

          titleOriginal:
            "Scala Paradisi",

          pgVolume:
            88,

          topics: [
            "молитва",
            "prayer",
            "страсти",
            "passions",
            "покајање",
            "repentance",
            "смирење",
            "humility",
            "послушање",
            "obedience",
          ],

          directUrl:
            pgVolumeUrl(88),
        },
      ],
    },


    {
      canonicalName:
        "Свети Јован Дамаскин",

      aliases: [
        "јован дамаскин",
        "свети јован дамаскин",
        "св. јован дамаскин",
        "john of damascus",
        "john damascene",
        "st john of damascus",
        "ioannes damascenus",
        "ἰωάννης δαμασκηνός",
        "ιωαννης δαμασκηνος",
      ],

      pgVolumes: [
        94,
        95,
        96,
      ],

      philokalia:
        false,

      works: [
        {
          titleSr:
            "Тачно изложење православне вере",

          titleEn:
            "Exact Exposition of the Orthodox Faith",

          titleOriginal:
            "De fide orthodoxa",

          pgVolume:
            94,

          topics: [
            "душа",
            "soul",
            "човек",
            "human",
            "тело",
            "body",
            "васкрсење",
            "resurrection",
            "стварање",
            "creation",
          ],

          directUrl:
            pgVolumeUrl(94),
        },
      ],
    },
  ];


function normalize(
  value: string,
) {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[.,;:!?()[\]{}"'’`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


export function findPatristicAuthor(
  query: string,
) {
  const normalizedQuery =
    normalize(query);

  return (
    PATRISTIC_CORPUS_INDEX.find(
      (author) =>
        author.aliases.some(
          (alias) =>
            normalizedQuery.includes(
              normalize(alias),
            ),
        ),
    ) ?? null
  );
}


export function findRelevantWorks(
  query: string,
  author:
    PatristicAuthorIndex,
) {
  const normalizedQuery =
    normalize(query);

  const scored =
    author.works.map(
      (work) => {
        let score = 0;

        for (
          const topic of
          work.topics
        ) {
          if (
            normalizedQuery.includes(
              normalize(topic),
            )
          ) {
            score += 1;
          }
        }

        return {
          work,
          score,
        };
      },
    );

  const relevant =
    scored
      .filter(
        (item) =>
          item.score > 0,
      )
      .sort(
        (a, b) =>
          b.score - a.score,
      )
      .map(
        (item) =>
          item.work,
      );

  return relevant;
}


export function getPgVolumeLinks(
  author:
    PatristicAuthorIndex,
) {
  return (
    author.pgVolumes ?? []
  ).map(
    (volume) => ({
      volume,

      url:
        pgVolumeUrl(
          volume,
        ),
    }),
  );
}