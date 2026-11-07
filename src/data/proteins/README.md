# Experimental protein teaching library

20 distinct named proteins, sourced from RCSB PDB on 2026-09-21. Each catalog
entry links to its exact structure and records the source organism, experiment,
author chain ID, modeled residue count, and whether the view is a domain/subunit.
The cards' miniature projections and the interactive model use the same C-alpha coordinates.

Regenerate with `scripts/build-protein-library.py` from the corresponding public
PDB files (`https://files.rcsb.org/download/{ID}.pdb`). The script does not invent
folds. It selects the first model, one named chain, standard amino acids with
resolved N/CA/C/O backbone atoms, heavy atoms only, and blank/A alternate locations.
Missing atoms/residues, ligands, ions, other chains, and modified residues are not
rebuilt. This is not a rendering of the complete biological assembly.

Peptide connectivity uses resolved C–N distances below 1.9 Å rather than residue
number adjacency; PDB numbering can contain insertion codes or gaps. Disulfides
use chain-local SSBOND records plus Cys SG–SG distances of 1.8–2.3 Å. Other local
bonds use covalent-radius distance cutoffs, without bond-order assignments.
Terminal oxygen added during teaching hydrolysis is approximate and labeled.
The spread/unfold animation is schematic, not a molecular-dynamics simulation.
Counts describe the modeled structure only. Existing crambin.json is retained
for compatibility with the original explorer's regression fixtures.

## Source imagery

`origins.json` maps all 20 entries to educational source images in
`public/protein-origins/`. The captions distinguish photographs, micrographs,
cultures and illustrations. Streptococcus and Streptomyces images illustrate
the genus, not the exact strain. Shared source organisms reuse an image.
These images show an organism/cell/location, not the protein molecule itself.

Each record retains its Wikimedia Commons description page, original URL,
author and license. Image credits and license links appear in the selected
protein's source panel. Downloaded thumbnails are otherwise unmodified;
CSS crops the display frame. Retrieved 2026-09-21.
