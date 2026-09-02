import {
  findPatristicAuthor,
  findRelevantWorks,
  getPgVolumeLinks,
} from "./corpus-index";


type ResearchLanguage =
  | "sr"
  | "en";


export function formatPatristicResearchLinks(
  query: string,
  language: ResearchLanguage,
) {
  const author =
    findPatristicAuthor(
      query,
    );


  if (!author) {
    if (
      language === "sr"
    ) {
      return [
        "Нисам још поуздано препознао конкретног аутора у локалном индексу корпуса.",
        "",
        "Можете прегледати званични индекс Patrologia Graeca:",
        "https://patrologiagraeca.org/patrologia/en/patrologia-graeca/list-of-authors-of-pg.html",
      ].join("\n");
    }


    return [
      "I could not yet reliably identify the requested author in the local corpus index.",
      "",
      "You can consult the Patrologia Graeca author index:",
      "https://patrologiagraeca.org/patrologia/en/patrologia-graeca/list-of-authors-of-pg.html",
    ].join("\n");
  }


  const works =
    findRelevantWorks(
      query,
      author,
    );


  if (
    language === "sr"
  ) {
    const lines: string[] = [
      "Релевантна примарна литература:",
      "",
      author.canonicalName,
    ];


    if (
      works.length > 0
    ) {
      for (
        const work of works
      ) {
        lines.push("");
        lines.push(
          work.titleSr,
        );

        if (
          work.titleOriginal
        ) {
          lines.push(
            `Оригинални/латински наслов: ${work.titleOriginal}`,
          );
        }

        if (
          work.pgVolume
        ) {
          const reference =
            work.pgColumns
              ? `PG ${work.pgVolume}, кол. ${work.pgColumns}`
              : `PG ${work.pgVolume}`;

          lines.push(
            reference,
          );
        }

        if (
          work.directUrl
        ) {
          lines.push(
            `Отвори извор: ${work.directUrl}`,
          );
        }
      }
    } else {
      const pgLinks =
        getPgVolumeLinks(
          author,
        );

      if (
        pgLinks.length > 0
      ) {
        lines.push("");
        lines.push(
          `Patrologia Graeca: PG ${pgLinks
            .map(
              (item) =>
                item.volume,
            )
            .join(", ")}`,
        );

        /*
         * Не приказујемо кориснику
         * двадесет линкова.
         * За аутора са великим бројем
         * томова дајемо индекс корпуса.
         */
        if (
          pgLinks.length <= 4
        ) {
          for (
            const item of
            pgLinks
          ) {
            lines.push(
              `PG ${item.volume}: ${item.url}`,
            );
          }
        } else {
          lines.push(
            "Индекс PG аутора:",
          );

          lines.push(
            "https://patrologiagraeca.org/patrologia/en/patrologia-graeca/list-of-authors-of-pg.html",
          );
        }
      }
    }


    if (
      author.philokalia
    ) {
      lines.push("");
      lines.push(
        "Овај аутор је такође заступљен у Филокалији.",
      );
    }


    lines.push("");
    lines.push(
      "Позадинска провера тачних одломака и цитата је у току.",
    );


    return lines.join("\n");
  }


  const lines: string[] = [
    "Relevant primary literature:",
    "",
    author.canonicalName,
  ];


  if (
    works.length > 0
  ) {
    for (
      const work of works
    ) {
      lines.push("");
      lines.push(
        work.titleEn,
      );

      if (
        work.titleOriginal
      ) {
        lines.push(
          `Original/Latin title: ${work.titleOriginal}`,
        );
      }

      if (
        work.pgVolume
      ) {
        const reference =
          work.pgColumns
            ? `PG ${work.pgVolume}, cols. ${work.pgColumns}`
            : `PG ${work.pgVolume}`;

        lines.push(
          reference,
        );
      }

      if (
        work.directUrl
      ) {
        lines.push(
          `Open source: ${work.directUrl}`,
        );
      }
    }
  } else {
    const pgLinks =
      getPgVolumeLinks(
        author,
      );

    if (
      pgLinks.length > 0
    ) {
      lines.push("");

      lines.push(
        `Patrologia Graeca: PG ${pgLinks
          .map(
            (item) =>
              item.volume,
          )
          .join(", ")}`,
      );

      if (
        pgLinks.length <= 4
      ) {
        for (
          const item of
          pgLinks
        ) {
          lines.push(
            `PG ${item.volume}: ${item.url}`,
          );
        }
      } else {
        lines.push(
          "PG author index:",
        );

        lines.push(
          "https://patrologiagraeca.org/patrologia/en/patrologia-graeca/list-of-authors-of-pg.html",
        );
      }
    }
  }


  if (
    author.philokalia
  ) {
    lines.push("");
    lines.push(
      "This author is also represented in the Philokalia.",
    );
  }


  lines.push("");
  lines.push(
    "Exact passages and quotations are being verified in the background.",
  );


  return lines.join("\n");
}