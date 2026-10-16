# Tooth chart fix + Treatments column

## 1. Canine teeth (position 3) drawn with two canals
In the tooth diagram, every tooth numbered 13, 23, 33, 43 currently shows a single root.
Redraw the canine shape with two root canals (twin-root look) so it matches clinical reality,
keeping the same 3D enamel/dentin shading as the other teeth.

## 2. Diagnosis list becomes a 3-column table
Replace the current bullet list under the chart with a table, in English, matching the
reference layout:

```text
Tooth      | Issues                    | Treatments                | [actions]
[13 v]     | Describe the issue...     | Describe the treatment... |  trash
+ Add tooth
```

- **Tooth**: dropdown listing all FDI numbers (as today); clicking a tooth on the chart still
  adds a row automatically.
- **Issues**: free text input (as today).
- **Treatments**: new free-text column beside it.
- Row delete button and "Add tooth" stay; header row is bold and printable.

## Technical notes
- `src/components/ToothChart.tsx`: change the `canine` entry in the `roots` array to two paths.
- `src/routes/index.tsx`: extend `toothNotes` items from `{ n, s }` to `{ n, s, t }`
  (t = treatment), update the chart `onToggle` add, the undo/redo snapshot restore, and
  rewrite the list block as a 3-column grid.
