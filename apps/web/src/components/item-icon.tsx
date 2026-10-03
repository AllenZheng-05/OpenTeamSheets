// An item's icon from Pokémon Showdown's item sprite sheet: 24×24 icons,
// 16 to a row, found by the item's position in the sheet.
const SHEET = "https://play.pokemonshowdown.com/sprites/itemicons-sheet.png";
const ICON = 24;
const PER_ROW = 16;

export function ItemIcon({ spriteNum }: { spriteNum: number }) {
  const x = (spriteNum % PER_ROW) * ICON;
  const y = Math.floor(spriteNum / PER_ROW) * ICON;
  return (
    <span
      aria-hidden
      className="inline-block shrink-0"
      style={{
        width: ICON,
        height: ICON,
        backgroundImage: `url(${SHEET})`,
        backgroundPosition: `-${x}px -${y}px`,
        imageRendering: "pixelated",
      }}
    />
  );
}
