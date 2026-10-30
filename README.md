# Akshay Kumar Sharma – Website
Static site (no install needed). Open folder in VS Code → Live Server → index.html.
After editing js/content.js, run `node build.js` (optional) to regenerate the full HTML pages.
EDIT: js/content.js (email, formEndpoint, portrait, bio, research, projects, book, achievements).
CONTACT FORM: set `formEndpoint` (Formspree / Web3Forms) or `email`; otherwise nothing is sent.
DEPLOY: upload folder to Netlify / Vercel / GitHub Pages (HTTPS). Replace YOUR-DOMAIN.com in *.html, sitemap.xml, robots.txt, content.js; add assets/og.png; submit sitemap in Google Search Console.
