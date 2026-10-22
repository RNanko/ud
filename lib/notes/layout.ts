export const NOTE_GRID = { gap: 16, row: 8, minimumHeight: 180 } as const;

export const noteRowSpan = (height: number) => Math.ceil((height + NOTE_GRID.gap) / NOTE_GRID.row);
