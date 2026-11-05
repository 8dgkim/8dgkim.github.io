# 8dgkim.github.io

My personal site, live at https://8dgkim.github.io. Plain HTML, CSS and JavaScript, with no framework. The posts are written in Markdown and turned into pages by one Python script.

## Writing a post

1. Copy `posts/_template/` to `posts/<yyyy-mm-dd>/`: the `when` date for operations, the `published` date for everything else. For a second post on the same date, use `<yyyy-mm-dd>-2`.
2. Put the images and videos in `figures/`.
3. Edit `index.md`. Its properties at the top:
   - `title_en` / `title_ko`: at least one is required.
   - `section`: required; the home page list it goes in: `notes`, `operations`, or `research`.
   - `published`: required; the day it went on the site.
   - `updated`: the day it last changed, if it did.
   - `when`: for operations; the date of the work.
     - The page shows `when` under the title, and published and updated at the end. Without `when`, published goes under the title.
     - The home page lists and sorts by `when`, else by published.
   - Optional: `subtitle_en` / `subtitle_ko`, `description_en` / `description_ko` (link previews only), `image`, `lang`.
   - `link: <url>`: the list entry points to that URL and no page is built.
   - `draft: true`: keeps the post off the site.
   - The full list is at the top of `tools/build.py`.
4. The body is Obsidian-flavored Markdown:
   - `![[figures/x.jpg|caption]]` embeds an image or video. Options go after `|`: a caption, `wide`, or a crop like `4:3` or `3:4`.
   - Several embeds on one line make a row.
   - Also supported: `$math$` and `$$math$$`, footnotes, tables, `> [!note]` callouts, `==highlight==`, `%% comment %%`, and `[[folder name]]` or `[[title]]` links to other posts.
5. If a property value contains `: ` or starts with a special character, put it in quotes. Otherwise the build skips the post and says why.

A video's poster image is `figures/<name>.poster.jpg`, kept next to the video.

Each home page list is a `<section data-list="...">` in `index.html` with a `<!-- build:... -->` block inside; a section shows once it has a post. A new list is a new section there, with no change to the build.

## Preview locally

Run these from this folder.

```zsh
pip install markdown-it-py mdit-py-plugins pyyaml # if these packages don't exist
python tools/build.py
python -m http.server 8000
```

Then open http://localhost:8000. 

## Publish

Before running git commands, bump the "last updated" date in the footer of the main page, in all languages.

```
git add -A && git commit -m "..." && git push origin main
```

GitHub Actions runs `tools/build.py` and publishes the site. The repo's **Actions** tab shows each run; a green check means the site is live, usually within about a minute.

For this to work, **Settings → Pages → Source** must stay on **GitHub Actions**.

## Look and behavior

- **Themes:** Singularity (default), Starlight, Deep Field, Death Star, Cold Steel.
  - Defined in `js/theme.js` and `css/themes.css`.
  - Use the theme button or the `T` key to cycle through them; hold `Shift` to go backward.
- **Banner scenes:** Galaxy Collision, Black Hole Merger, Cosmic Web.
  - Defined in `js/scenes/`. 
  - Use the scene button or the `S` key to cycle through them; hold `Shift` to go backward.
- **Language:** English and 한국어 on the home page only. 
  - Use the language button or the `L` key to switch. (`Shift` works too.)
- **Links:** only links to other sites open in a new tab (`js/site.js`).

## Related

- Geometry of Spacetime: https://8dgkim.github.io/geometry-of-spacetime/. It's a separate repo, `8dgkim/geometry-of-spacetime`.
