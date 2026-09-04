## REMOVED Requirements

### Requirement: The farm's state is not presented as saved

**Reason**: The requirement was written as the honest form of shipping without
persistence — "until persistence is specified, nothing SHALL claim the farm is saved,
offer to save, restore or reset it". This change specifies persistence, so the
requirement's condition has been met and its prohibitions now contradict what the farm
does: progress is kept, and starting a new farm is deliberately offered.

**Migration**: `game-save` carries what this requirement was protecting. Its *Progress is
kept in the browser and restored on return* replaces the session-only guarantee; its *A
farm that cannot be stored is still playable and says so* keeps the honesty rule for the
one case where the claim would be false; and its *A farm is one seed drawn once, and
starting again draws another* specifies the reset this requirement forbade, with the
confirmation it needs. Nothing in `game-economy` itself changes: the money, the year and
the ledger remain values that module computes, and it neither reads nor writes storage.
