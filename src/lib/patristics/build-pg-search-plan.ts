import {
  findPatristicAuthor,
  findRelevantWorks,
  type PatristicAuthorIndex,
  type PatristicWorkIndex,
} from "./corpus-index";


export type PgSearchPlanWork = {
  titleSr: string;

  titleEn: string;

  titleOriginal?: string;

  pgVolume: number;

  pgColumns?: string;

  topics: string[];
};


export type PgSearchPlan = {
  query: string;

  author:
    | PatristicAuthorIndex
    | null;

  authorName:
    | string
    | null;

  pgVolumes: number[];

  works: PgSearchPlanWork[];

  hasSpecificAuthor: boolean;

  hasSpecificWorks: boolean;
};


function uniqueNumbers(
  values: number[],
) {
  return [
    ...new Set(
      values,
    ),
  ];
}


function hasPgVolume(
  work: PatristicWorkIndex,
): work is PatristicWorkIndex & {
  pgVolume: number;
} {
  return (
    typeof work.pgVolume ===
    "number"
  );
}


function mapWork(
  work:
    PatristicWorkIndex & {
      pgVolume: number;
    },
): PgSearchPlanWork {
  return {
    titleSr:
      work.titleSr,

    titleEn:
      work.titleEn,

    titleOriginal:
      work.titleOriginal,

    pgVolume:
      work.pgVolume,

    pgColumns:
      work.pgColumns,

    topics:
      work.topics,
  };
}


export function buildPgSearchPlan(
  query: string,
): PgSearchPlan {
  const normalizedQuery =
    query.trim();


  const author =
    findPatristicAuthor(
      normalizedQuery,
    );


  /*
   * Autor nije prepoznat.
   *
   * Za sada ne otvaramo
   * nasumično ceo PG korpus.
   */
  if (!author) {
    return {
      query:
        normalizedQuery,

      author: null,

      authorName: null,

      pgVolumes: [],

      works: [],

      hasSpecificAuthor:
        false,

      hasSpecificWorks:
        false,
    };
  }


  const relevantWorks =
    findRelevantWorks(
      normalizedQuery,
      author,
    ).filter(
      hasPgVolume,
    );


  /*
   * Ako pitanje upućuje na
   * određena poznata dela,
   * pretražujemo njihove tomove.
   */
  if (
    relevantWorks.length >
    0
  ) {
    const works =
      relevantWorks.map(
        mapWork,
      );


    return {
      query:
        normalizedQuery,

      author,

      authorName:
        author.canonicalName,

      pgVolumes:
        uniqueNumbers(
          works.map(
            (work) =>
              work.pgVolume,
          ),
        ),

      works,

      hasSpecificAuthor:
        true,

      hasSpecificWorks:
        true,
    };
  }


  /*
   * Autor jeste poznat,
   * ali konkretno delo nije.
   *
   * Pretražujemo sve PG tomove
   * koje indeks za njega poznaje.
   */
  return {
    query:
      normalizedQuery,

    author,

    authorName:
      author.canonicalName,

    pgVolumes:
      uniqueNumbers(
        author.pgVolumes ??
          [],
      ),

    works: [],

    hasSpecificAuthor:
      true,

    hasSpecificWorks:
      false,
  };
}