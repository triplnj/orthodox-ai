export function expandCuratedSearchTerms(
  query: string,
  generatedTerms: string[],
) {
  const normalized =
    query
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const terms = [
    ...generatedTerms,
  ];

  if (
    /икон|ikona|icon|image|eikon|εικον|bild/.test(
      normalized,
    )
  ) {
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
      "worship",
      "adoration",
      "incarnation",
      "visible",
      "invisible",
      "matter",
      "material",
      "εἰκών",
      "εἰκόνα",
      "εἰκόνος",
      "προσκύνησις",
      "τιμή",
      "ὕλη",
      "σάρξ",
    );
  }

  if (
    /душ|dusa|duša|soul|seele/.test(
      normalized,
    )
  ) {
    terms.push(
      "soul",
      "mind",
      "intellect",
      "heart",
      "inner man",
      "spiritual",
    );
  }

  return [
    ...new Set(
      terms
        .map(
          (term) =>
            term
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
