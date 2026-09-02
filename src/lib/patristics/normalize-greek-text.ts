export function normalizeGreekForComparison(
  text: string,
) {
  return text
    .normalize("NFD")

    // уклањамо дијакритике само за машинско поређење
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )

    .toLowerCase()

    // финално сигма -> обично сигма
    .replace(
      /ς/g,
      "σ",
    )

    // различити апострофи
    .replace(
      /[’‘`´´]/g,
      "'",
    )

    // уклањамо интерпункцију
    .replace(
      /[.,;··:!?«»“”"()[\]{}]/g,
      " ",
    )

    // спајамо речи поломљене OCR преломом реда
    .replace(
      /-\s+/g,
      "",
    )

    // више размака -> један
    .replace(
      /\s+/g,
      " ",
    )

    .trim();
}


export function greekWords(
  text: string,
) {
  return normalizeGreekForComparison(
    text,
  )
    .split(" ")
    .filter(Boolean);
}