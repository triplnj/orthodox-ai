type ResearchLanguage =
  | "sr"
  | "en";


export type PatristicResearchLink = {
  title: string;
  corpus:
    | "SCRIPTURE"
    | "PATROLOGIA_GRAECA"
    | "PHILOKALIA";

  url: string;

  searchTerms: string[];
};


type TopicVocabulary = {
  test: RegExp;

  terms: string[];
};


const TOPIC_VOCABULARY:
  TopicVocabulary[] = [
    {
      test:
        /\b(душа|душе|души|soul|souls|ψυχ[ήηῆῇῆς])\b/iu,

      terms: [
        "душа",
        "soul",
        "ψυχή",
      ],
    },

    {
      test:
        /\b(молитва|молитви|молитве|моли|молити|prayer|pray|προσευχ[ήηῆῇῆς])\b/iu,

      terms: [
        "молитва",
        "prayer",
        "προσευχή",
      ],
    },

    {
      test:
        /\b(смрт|смрти|death|dying|θάνατος|θαν[άα]του)\b/iu,

      terms: [
        "смрт",
        "death",
        "θάνατος",
      ],
    },

    {
      test:
        /\b(васкрсење|васкрсења|resurrection|ἀνάστασις|ανάσταση)\b/iu,

      terms: [
        "васкрсење",
        "resurrection",
        "ἀνάστασις",
      ],
    },

    {
      test:
        /\b(ум|ума|уму|intellect|mind|νοῦς|νους)\b/iu,

      terms: [
        "ум",
        "intellect",
        "νοῦς",
      ],
    },

    {
      test:
        /\b(срце|срца|heart|καρδία|καρδια)\b/iu,

      terms: [
        "срце",
        "heart",
        "καρδία",
      ],
    },

    {
      test:
        /\b(страст|страсти|passion|passions|πάθος|πάθη)\b/iu,

      terms: [
        "страсти",
        "passions",
        "πάθη",
      ],
    },

    {
      test:
        /\b(покајање|покајања|repentance|μετάνοια|μετανοια)\b/iu,

      terms: [
        "покајање",
        "repentance",
        "μετάνοια",
      ],
    },

    {
      test:
        /\b(љубав|љубави|love|ἀγάπη|αγαπη)\b/iu,

      terms: [
        "љубав",
        "love",
        "ἀγάπη",
      ],
    },

    {
      test:
        /\b(благодат|благодати|grace|χάρις|χαρις)\b/iu,

      terms: [
        "благодат",
        "grace",
        "χάρις",
      ],
    },
  ];


function unique(
  values: string[],
) {
  return [
    ...new Set(
      values
        .map(
          (value) =>
            value.trim(),
        )
        .filter(Boolean),
    ),
  ];
}


function detectTerms(
  query: string,
) {
  const terms: string[] = [];

  for (
    const vocabulary of
    TOPIC_VOCABULARY
  ) {
    if (
      vocabulary.test.test(
        query,
      )
    ) {
      terms.push(
        ...vocabulary.terms,
      );
    }
  }

  /*
   * Ако немамо познат тематски термин,
   * користимо сам упит као помоћни
   * search term, али га НЕ третирамо
   * као цитат или доказ.
   */
  if (
    terms.length === 0
  ) {
    terms.push(
      query.trim(),
    );
  }

  return unique(terms);
}


function detectAuthor(
  query: string,
) {
  const patterns = [
    /(?:Свети|Св\.?|Свeти)\s+([А-ЯA-ZЂЈЉЊЋЏ][^?!,.;]{2,60})/u,

    /(?:Saint|St\.?)\s+([A-Z][^?!,.;]{2,60})/u,
  ];


  for (
    const pattern of
    patterns
  ) {
    const match =
      query.match(pattern);

    if (match?.[1]) {
      return match[1]
        .replace(
          /\s+(пише|учи|говори|каже|о)\b.*$/iu,
          "",
        )
        .replace(
          /\s+(writes|teaches|says|on|about)\b.*$/iu,
          "",
        )
        .trim();
    }
  }


  return "";
}


function googleSiteSearchUrl(
  domain: string,
  query: string,
) {
  const search =
    `site:${domain} ${query}`;

  return (
    "https://www.google.com/search?q=" +
    encodeURIComponent(
      search,
    )
  );
}


function pgSearchUrl(
  author: string,
  terms: string[],
) {
  /*
   * Patrologia Graeca има 161 том.
   * Индекс аутора је практичнија
   * почетна тачка од насумичног
   * претраживања сајтова.
   */
  const query = unique([
    author,
    ...terms,
    "Patrologia Graeca",
    "PG",
  ])
    .join(" ");


  return googleSiteSearchUrl(
    "patrologiagraeca.org",
    query,
  );
}


function philokaliaSearchUrl(
  author: string,
  terms: string[],
) {
  const query = unique([
    author,
    ...terms,
  ])
    .join(" ");


  return googleSiteSearchUrl(
    "philokalia.com",
    query,
  );
}


function scriptureSearchUrl(
  terms: string[],
) {
  const query =
    terms.join(" ");


  return (
    "https://www.biblegateway.com/quicksearch/?quicksearch=" +
    encodeURIComponent(
      query,
    )
  );
}


export function buildPatristicResearchLinks(
  query: string,
): PatristicResearchLink[] {
  const author =
    detectAuthor(query);

  const terms =
    detectTerms(query);


  const links:
    PatristicResearchLink[] =
      [];


  /*
   * Свето Писмо није доказ да је
   * конкретни Свети Отац нешто
   * изговорио, али је примарни
   * корпус православног богословља.
   */
  links.push({
    title:
      "Holy Scripture",

    corpus:
      "SCRIPTURE",

    url:
      scriptureSearchUrl(
        terms,
      ),

    searchTerms:
      terms,
  });


  /*
   * За грчке Оце PG је главни
   * патристички корпус.
   */
  if (author) {
    links.push({
      title:
        author
          ? `Patrologia Graeca — ${author}`
          : "Patrologia Graeca",

      corpus:
        "PATROLOGIA_GRAECA",

      url:
        pgSearchUrl(
          author,
          terms,
        ),

      searchTerms:
        terms,
    });
  } else {
    links.push({
      title:
        "Patrologia Graeca",

      corpus:
        "PATROLOGIA_GRAECA",

      url:
        "https://onlinebooks.library.upenn.edu/webbin/book/lookupid?key=olbp89086",

      searchTerms:
        terms,
    });
  }


  /*
   * Не тврдимо да је сваки аутор
   * заступљен у Филокалији.
   * Ово је research link, не
   * доказ ауторства.
   */
  links.push({
    title:
      author
        ? `Philokalia — search for ${author}`
        : "Philokalia",

    corpus:
      "PHILOKALIA",

    url:
      philokaliaSearchUrl(
        author,
        terms,
      ),

    searchTerms:
      terms,
  });


  return links;
}


export function formatPatristicResearchLinks(
  query: string,
  language: ResearchLanguage,
) {
  const links =
    buildPatristicResearchLinks(
      query,
    );


  if (
    language === "sr"
  ) {
    const lines = [
      "Док траје провера, можете и сами да погледате примарне корпусе:",
      "",
    ];


    for (
      const link of links
    ) {
      lines.push(
        `${link.title}`,
      );

      lines.push(
        `Појмови за претрагу: ${link.searchTerms.join(
          ", ",
        )}`,
      );

      lines.push(
        link.url,
      );

      lines.push("");
    }


    lines.push(
      "Напомена: ови линкови су пут до литературе. Текст се неће приказати као цитат Светог Оца док не буде проверен у Светом Писму, Patrologia Graeca или Филокалији.",
    );


    return lines.join("\n");
  }


  const lines = [
    "While verification is running, you can also consult the primary corpora directly:",
    "",
  ];


  for (
    const link of links
  ) {
    lines.push(
      `${link.title}`,
    );

    lines.push(
      `Search terms: ${link.searchTerms.join(
        ", ",
      )}`,
    );

    lines.push(
      link.url,
    );

    lines.push("");
  }


  lines.push(
    "Note: these links are research paths, not verified quotations. OrthodoxAI will not present a passage as a Church Father quotation until it has been verified against Holy Scripture, Patrologia Graeca, or the Philokalia.",
  );


  return lines.join("\n");
}