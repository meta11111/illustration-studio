/** Keep an imported palette selectable when another palette becomes active. */
export function paletteOptions(scene, builtInPalettes) {
  return scene.customPalette ? [...builtInPalettes, scene.customPalette] : [...builtInPalettes];
}

/** A file-supplied id must never shadow a built-in palette or an earlier import. */
export function identifyImportedPalette(validatedPalette, makeId) {
  return {...validatedPalette, id:'custom-' + makeId()};
}
