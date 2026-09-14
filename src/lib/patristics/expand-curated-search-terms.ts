function normalizeQuery(
  value: string,
) {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase();
}


function addDirectLatinTerms(
  normalized: string,
  terms: string[],
) {
  const stopwords =
    new Set([
      "what",
      "does",
      "say",
      "says",
      "teach",
      "teaches",
      "about",
      "saint",
      "sveti",
      "svetog",
      "svetom",
      "heiliger",
      "heilige",
      "über",
      "uber",
      "the",
      "and",
      "from",
      "with",
      "this",
      "that",
    ]);

  const tokens =
    normalized
      .replace(
        /[^a-z0-9\s-]/g,
        " ",
      )
      .split(/\s+/)
      .filter(
        (token) =>
          token.length >= 4 &&
          !stopwords.has(
            token,
          ),
      );

  terms.push(
    ...tokens,
  );
}


export function expandCuratedSearchTerms(
  query: string,
  seedTerms: string[] = [],
  targetLanguage = "English",
) {
  const normalized =
    normalizeQuery(
      query,
    );

  const terms = [
    ...seedTerms,
  ];

  /*
   * Keep useful source-language words from an
   * English/German/Latin-script question without
   * invoking a model.
   */
  if (
    targetLanguage !==
      "Greek"
  ) {
    addDirectLatinTerms(
      normalized,
      terms,
    );
  }

  if (
    /икон|ikona|icon|image|eikon|εικον|bild/.test(
      normalized,
    )
  ) {
    if (
      targetLanguage ===
      "Greek"
    ) {
      terms.push(
        "εἰκών",
        "εἰκόνα",
        "εἰκόνος",
        "εἰκόνων",
        "προσκύνησις",
        "προσκυνεῖν",
        "τιμή",
        "ὕλη",
        "σάρξ",
        "ὁρατός",
        "ἀόρατος",
      );
    } else {
      terms.push(
        "image",
        "images",
        "icon",
        "icons",
        "holy images",
        "divine images",
        "representation",
        "prototype",
        "honour",
        "honor",
        "veneration",
        "worship",
        "adoration",
        "incarnation",
        "visible",
        "invisible",
        "matter",
        "material",
      );
    }
  }

  if (
    /душ|dusa|duša|soul|seele|ψυχ/.test(
      normalized,
    )
  ) {
    if (
      targetLanguage ===
      "Greek"
    ) {
      terms.push(
        "ψυχή",
        "ψυχῆς",
        "νοῦς",
        "νοερός",
        "καρδία",
      );
    } else {
      terms.push(
        "soul",
        "mind",
        "intellect",
        "heart",
        "inner man",
        "spiritual",
      );
    }
  }

  if (
    /спас|spasen|salvation|heil|σωτηρ/.test(
      normalized,
    )
  ) {
    if (
      targetLanguage ===
      "Greek"
    ) {
      terms.push(
        "σωτηρία",
        "σωτηρίας",
        "μετάνοια",
        "χάρις",
        "θέωσις",
      );
    } else {
      terms.push(
        "salvation",
        "saved",
        "repentance",
        "grace",
        "mercy",
        "purification",
        "perfection",
        "deification",
      );
    }
  }

  if (
    /молит|molit|prayer|gebet|προσευχ/.test(
      normalized,
    )
  ) {
    if (
      targetLanguage ===
      "Greek"
    ) {
      terms.push(
        "προσευχή",
        "προσευχῆς",
        "νοῦς",
        "καρδία",
      );
    } else {
      terms.push(
        "prayer",
        "pray",
        "mind",
        "heart",
        "stillness",
        "watchfulness",
      );
    }
  }

  if (
    /покај|pokaj|repent|buß|buss|μετανοι/.test(
      normalized,
    )
  ) {
    if (
      targetLanguage ===
      "Greek"
    ) {
      terms.push(
        "μετάνοια",
        "μετανοίας",
      );
    } else {
      terms.push(
        "repentance",
        "repent",
        "contrition",
      );
    }
  }

  if (
    /смир|smir|humil|demut|ταπειν/.test(
      normalized,
    )
  ) {
    if (
      targetLanguage ===
      "Greek"
    ) {
      terms.push(
        "ταπείνωσις",
        "ταπεινοφροσύνη",
      );
    } else {
      terms.push(
        "humility",
        "humble",
        "lowliness",
      );
    }
  }

  /*
   * Bibliographic questions need vocabulary that
   * actually occurs on edition/catalog pages.
   */
  if (
    /када|настал|напис|век|где|when|written|wrote|century|where|wann|jahrhundert|wo/.test(
      normalized,
    )
  ) {
    terms.push(
      "century",
      "written",
      "composed",
      "date",
      "bishop",
      "monk",
      "Nineveh",
      "edition",
    );
  }

  return [
    ...new Set(
      terms
        .map(
          (term) =>
            term
              .normalize("NFC")
              .toLowerCase()
              .trim(),
        )
        .filter(
          (term) =>
            term.length >= 3,
        ),
    ),
  ];
}
