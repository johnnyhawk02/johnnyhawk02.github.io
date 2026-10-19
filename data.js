// Everything on the page comes from here. Add a plugin, site or release by adding a line.

export const work = [
  {
    kind: "Plugin",
    title: "EpHeM",
    year: 2026,
    blurb: "Ephemeral stereo FM synth: three operators with left/right spreads, slow wandering LFOs, and a cube you roll for new sounds.",
    image: "img/ephem.jpg",
    link: "https://johnnyhawk02.github.io/ephem/",
    cta: "Play it in your browser",
    featured: true,
  },
  {
    kind: "Website",
    title: "Active Sefton",
    year: 2026,
    blurb: "A fast rebuild of Sefton's leisure centres site: six centres, every class in one timetable, booking in a couple of taps.",
    image: "img/sefton.jpg",
    link: "https://activeseftonfitness.netlify.app/",
    cta: "Visit the site",
  },
];

export const links = {
  bandcamp: "https://global-goon.bandcamp.com/",
  discogs: "https://www.discogs.com/artist/1081-Global-Goon",
};

// Global Goon releases, oldest first. Sources: Wikipedia and Bandcamp.
// `link` goes to Bandcamp where the release is there (otherwise a Discogs search); `cover` is in img/covers.
const bc = (host, slug) => `https://${host}.bandcamp.com/album/${slug}`;
export const releases = [
  { title: "Goon", year: 1996, label: "Rephlex", type: "Album" },
  { title: "Afterlife", year: 1997, label: "Rephlex", type: "EP" },
  { title: "Cradle of History", year: 1998, label: "Rephlex", type: "Album" },
  { title: "Vatican Nitez", year: 2002, label: "Rephlex", type: "Album" },
  { title: "Family Glue", year: 2004, label: "Audio Dregs / J-HOK", type: "Album", cover: "family-glue", link: bc("audiodregs", "family-glue") },
  { title: "Junior Glue", year: 2004, label: "J-HOK", type: "Album" },
  { title: "Bessemer Cocktail", year: 2005, label: "WéMè", type: "Album" },
  { title: "Pure Rock", year: 2005, label: "J-HOK", type: "Album" },
  { title: "Saint Aime", year: 2008, label: "WéMè", type: "Album" },
  { title: "Chimay", year: 2008, label: "WéMè", type: "EP" },
  { title: "Earwhig", year: 2010, label: "Myuzyk", type: "Album" },
  { title: "Quones", year: 2011, label: "J-HOK", type: "Album" },
  { title: "Everything Is Connected", year: 2011, label: "J-HOK", type: "Album" },
  { title: "Carbon", year: 2011, label: "UpItUp", type: "Album" },
  { title: "Quonesha", year: 2011, label: "J-HOK", type: "EP" },
  { title: "Journeys", year: 2012, label: "J-HOK", type: "Album" },
  { title: "Horizon", year: 2012, label: "J-HOK", type: "Album" },
  { title: "Plastic Orchestra", year: 2012, label: "030303", type: "Album", cover: "plastic-orchestra", link: bc("030303", "plastic-orchestra") },
  { title: "-Quonk", year: 2012, label: "J-HOK", type: "Album" },
  { title: "-K-Wal", year: 2013, label: "J-HOK", type: "Album" },
  { title: "Destroy the Mirror", year: 2014, label: "Balkan Vinyl", type: "Album", cover: "destroy-the-mirror", link: bc("global-goon", "destroy-the-mirror") },
  { title: "Sweet Box", year: 2015, label: "J-HOK", type: "Album" },
  { title: "Rivers", year: 2015, label: "J-HOK", type: "EP" },
  { title: "Shazbot", year: 2015, label: "J-HOK", type: "EP" },
  { title: "Great Heck", year: 2015, label: "J-HOK", type: "EP" },
  { title: "NUSH!", year: 2015, label: "J-HOK", type: "EP" },
  { title: "ILA006", year: 2015, label: "Self-released", type: "EP", cover: "ila006", link: bc("global-goon", "ila006-digital") },
  { title: "Give It 2 Ya", year: 2020, label: "Self-released", type: "EP", cover: "give-it-2-ya", link: bc("global-goon", "give-it-2-ya") },
  { title: "Euro Jack", year: 2022, label: "Self-released", type: "Album", cover: "euro-jack", link: bc("global-goon", "euro-jack") },
  { title: "Painting With Acid Vol 1", year: 2023, label: "Acid Waxa", type: "EP", cover: "painting-with-acid-1", link: bc("acidwaxa", "painting-with-acid-vol-1") },
  { title: "Painting With Acid Vol 2", year: 2023, label: "Acid Waxa", type: "EP", cover: "painting-with-acid-2", link: bc("acidwaxa", "painting-with-acid-vol-2-2") },
  { title: "Bruit Électrique", year: 2023, label: "Waxing Crescent · with Ossa", type: "Album", cover: "bruit-electrique", link: bc("waxingcrescentrecords", "bruit-lectrique") },
  { title: "Ambient Rave Music", year: 2023, label: "Schematic · with Ossa", type: "Album", cover: "ambient-rave-music", link: bc("schematicmusiccompany", "ambient-rave-music") },
  { title: "The Acid Arcana", year: 2023, label: "Adepta Editions", type: "EP", cover: "the-acid-arcana", link: bc("adepta", "the-acid-arcana") },
  { title: "Painting With Acid Vol 3", year: 2023, label: "Acid Waxa", type: "Album", cover: "painting-with-acid-3", link: bc("acidwaxa", "painting-with-acid-vol-3") },
  { title: "Nanoclusters", year: 2023, label: "CPU", type: "EP", link: "https://shop.cpurecords.net/album/nanoclusters" },
  { title: "Adopt Me", year: 2024, label: "EVEL", type: "Album", cover: "adopt-me", link: bc("evel", "adopt-me") },
  { title: "vocabulary series_v", year: 2025, label: "EVEL", type: "EP", cover: "vocabulary-v", link: bc("evel", "vocabulary-series-v") },
  { title: "vocabulary series_o", year: 2025, label: "EVEL", type: "EP", cover: "vocabulary-o", link: bc("evel", "vocabulary-series-o") },
  { title: "Grow Your Own Goon Garden", year: 2025, label: "Virtual Urban", type: "Album", cover: "goon-garden", link: bc("virtualurbanrecords", "grow-your-own-goon-garden") },
  { title: "vocabulary series_C", year: 2025, label: "EVEL", type: "EP", cover: "vocabulary-c", link: bc("evel", "vocabulary-series-c") },
  { title: "vocabulary series_A", year: 2026, label: "EVEL", type: "EP", cover: "vocabulary-a", link: bc("evel", "vocabulary-series-a") },
];
