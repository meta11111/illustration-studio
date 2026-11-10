# Independent acceptance checklist

This checklist follows the supplied Figma test assignment. A checkbox is marked only after an observed passing check. Review owner: independent QA agent.

## Source library

- [x] Ten supplied subject families have complete S/L and main/background variants.
- [x] Original vector path geometry, masks, proportions and source group relationships are preserved.
- [x] Every SVG has source node provenance and a non-empty local file.
- [x] No source asset or exported composition contains raster image fallbacks.
- [x] S/L is a real variant change, with at least one demonstrated geometry difference.

## Editing and composition

- [x] Multiple named objects are found in one request; unknown and excluded names are handled visibly.
- [x] Metaphor mode describes its actual local-dictionary scope and avoids arbitrary output on unknown prompts.
- [x] Square, landscape and portrait layouts are deterministic per seed and use a shared object scale.
- [ ] Add/select/move/rotate/duplicate/delete and layer reordering work.
- [ ] Main/background role changes preserve object identity and placement.
- [x] Relative object dimensions follow the source library instead of equalized thumbnails.
- [ ] Empty input, empty scenes and malformed scene/palette imports fail clearly without losing the current scene.

## Color and export

- [x] Three exact source color schemes are available.
- [ ] Uploaded palette fields are validated and the palette updates the entire scene.
- [x] Object-only accents never become background colors.
- [x] Export is standalone SVG, preserving separate editable groups and transforms.
- [x] Duplicated source assets have unique IDs and resolved mask/gradient/clipPath/href references.
- [x] Export omits temporary Figma URLs, bitmap payloads and external asset dependencies.
- [ ] Exported SVG reopens in a browser and imports in Figma as vector objects.

## Delivery

- [ ] Project starts according to README from a clean checkout.
- [x] Tests actually run and any unavailable UI/import check is reported explicitly.
- [ ] Repository/source archive, architecture summary and actual AI tool disclosure are present.
- [ ] Two or three example SVG compositions and a short working demonstration are provided.
- [ ] Published link and access scope are verified; no API credentials are committed.

