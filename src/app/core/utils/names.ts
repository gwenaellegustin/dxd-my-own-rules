/** Worksheets refer to clients and vehicles by name: compared without case nor outer spaces */
export const sameName = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Key of a name in a map (same rule as `sameName`) */
export const nameKey = (name: string): string => name.trim().toLowerCase();

/** Last word of a name ("Mr Morard" → Morard): the client list is ordered by it */
export const familyName = (name: string): string => name.trim().split(/\s+/).at(-1) ?? '';
