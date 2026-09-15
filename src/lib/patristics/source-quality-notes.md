# Patristic source quality policy

The live patristic web-research provider is author-agnostic: it must work for Fathers who are not present in the local corpus.

Research is two-stage:

1. Prefer stable primary-text, library, patristic-repository, and academic domains.
2. Broaden to the public web only if the preferred-domain pass yields no usable evidence.

Low-provenance document mirrors and content aggregators may be useful for discovery, but they must not become downstream evidence or source cards.

Source URLs are normalized before deduplication, tracking parameters are removed, trailing punctuation is stripped, and blocked domains are excluded.
