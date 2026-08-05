/**
 * The form field naming scheme.
 *
 * This editor has no save button of its own — it renders inputs into the host's
 * form and the host posts them. These names are therefore a wire contract with
 * the server, and changing one silently drops that field on save.
 *
 * Every field is a plain `name[]` array. The server pairs them up by position,
 * so **DOM order is the source of truth**: the five arrays are read together,
 * index for index, to reassemble each band. Nothing embeds a row index, which
 * is what makes the constant re-sorting cheap — after a re-sort the rows are
 * moved into their new order and the arrays follow automatically.
 *
 * The one trap here is the mastery flag. An unchecked checkbox posts **nothing
 * at all**, which would shorten that one array and silently shift every
 * following band's flag onto the wrong band. So the checkbox is unnamed and
 * carries no wire meaning; a hidden input alongside it posts `1` or `0` for
 * every band, always. See `dom/BandRow.ts`.
 */

export interface BandFieldNames {
    id: string;
    color: string;
    minValue: string;
    label: string;
    masteryFlag: string;
}

export function bandFields(prefix: string): BandFieldNames {
    return {
        id: `${prefix}_id[]`,
        color: `${prefix}_color[]`,
        minValue: `${prefix}_min_value[]`,
        label: `${prefix}_label[]`,
        masteryFlag: `${prefix}_mastery_flg[]`
    };
}
