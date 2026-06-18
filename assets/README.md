# assets/

Put your brand images here.

## og-image.jpg  (recommended, 1200×630)
The image shown when someone shares a Jivani Gems link on social media / chat.
Referenced by the `og:image` meta tags on every page. Until you add it, links
still work — they just won't show a preview image.

## hero-360/  (only needed if you use the photo 360° hero)
For a REAL product spin on the homepage hero:
1. Photograph the ring on a turntable — ~36 shots, one every 10°.
2. Name them `frame-01.jpg` … `frame-36.jpg`.
3. Place them in this `hero-360/` folder.
4. In `js/config.js` set `HERO_MODE: 'photo'`.

To launch a new ring later, just replace these 36 images (same filenames) —
no code changes needed. See SETUP-GUIDE.md → "Swapping the 360° hero ring".

(The default `HERO_MODE: 'svg'` needs NO images — it draws an on-brand vector
ring that spins, so the site looks complete out of the box.)
