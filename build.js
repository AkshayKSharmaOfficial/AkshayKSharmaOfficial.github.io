// Pre-renders every page into complete static HTML (run: node build.js). Edit js/content.js, then run again.
const fs=require("fs"),vm=require("vm");
const content=fs.readFileSync("js/content.js","utf8"),app=fs.readFileSync("js/app.js","utf8");
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");
function render(page,slug="",lang="en"){
 const st={},tm=[],g=k=>st[k]||(st[k]={value:"",classList:{toggle(){}},setAttribute(){}});
 const c={document:{body:{dataset:{page,slug,lang}},title:"",querySelector:g},location:{search:"",href:""},setTimeout:f=>tm.push(f),console,encodeURIComponent,URLSearchParams,JSON,Object,String};
 c.window=c;vm.createContext(c);vm.runInContext(content,c);vm.runInContext(app,c);tm.forEach(f=>f());
 let m=st["#app"].innerHTML;const e="<div id=g class=grid aria-live=polite></div>";
 if(st["#g"])m=m.replace(e,e.replace("></div>",">"+st["#g"].innerHTML+"</div>"));
 return{h:st["#hdr"].innerHTML,m,f:st["#ftr"].innerHTML,S:c.SITE}}
const nice=h=>h.replace(/(<\/(?:section|div|h1|h2|h3|p|ul|ol|li|article|header|footer|nav|form|label)>)(?=<)/g,"$1\n").replace(/(<(?:section|div|article|ul|ol|header|footer|nav|form)\b[^>]*>)(?=<)/g,"$1\n");
const D="Akshay Kumar Sharma";
const pages=[
["index","index",D+" | Cyber Security Educator & Researcher","Cyber Security Educator, Awareness Trainer and Researcher making cybersecurity accessible for everyone in India."],
["about","about","About "+D+" | Cyber Security Educator","Biography, mission and research interests of "+D+"."],
["research","research","Research & Publications | "+D,"Cybersecurity research by "+D+"."],
["research-article","research-article","Research Article | "+D,"Research article details."],
["projects","projects","Cybersecurity Projects | "+D,"Portfolio of cybersecurity and awareness projects."],
["awareness","awareness","Cyber Awareness Hub | "+D,"Practical cyber safety guides in Hindi and English with official Indian reporting links."],
["awareness-hi","awareness","साइबर जागरूकता | "+D,"हिन्दी में साइबर सुरक्षा गाइड।","","hi"],
["book","book","My Book | "+D,"Cyber Security and Ethical Hacking book by "+D+"."],
["blog","blog","Blog | "+D,"Cyber safety articles by "+D+"."],
["achievements","achievements","Achievements & Certifications | "+D,"Verified achievements and certifications."],
["collaborate","collaborate","Speaking & Collaboration | "+D,"Invite "+D+" for cyber awareness sessions and collaboration."],
["contact","contact","Contact | "+D,"Contact "+D+" for sessions, research or collaboration."],
["privacy","privacy","Privacy Policy | "+D,"Privacy policy."],
["404","404","Page Not Found | "+D,"Page not found."]];
const S=render("index").S;
S.projects.forEach(p=>pages.push(["project-"+p.slug,"project-details",p.name+" | "+D,p.description,p.slug]));
S.blog.forEach(b=>pages.push(["blog-"+b.slug,"blog-article",b.title+" | "+D,"Proposed article topic by "+D+".",b.slug]));
S.awareness.forEach(a=>{pages.push(["awareness-"+a.slug,"awareness-article",a.en.t+" | "+D,a.en.s,a.slug]);pages.push(["awareness-"+a.slug+"-hi","awareness-article",a.hi.t+" | "+D,a.hi.s,a.slug,"hi"])});
const LD='<script type="application/ld+json">{"@context":"https://schema.org","@type":"Person","name":"'+D+'","jobTitle":"Cyber Security Educator","sameAs":'+JSON.stringify(Object.values(S.social).slice(0,2))+'}</script>';
for(const[file,page,title,desc,slug="",lang="en"]of pages){const r=render(page,slug,lang),u=S.baseUrl+"/"+file+".html";
fs.writeFileSync(file+".html",`<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${u}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${u}">
<meta property="og:image" content="${S.baseUrl}/assets/og.png">
<meta name="theme-color" content="#071426">
<link rel="stylesheet" href="css/style.css">
${file=="index"?LD+"\n":""}</head>
<body data-page="${page}"${slug?` data-slug="${slug}"`:""} data-lang="${lang}">
<a class="skip" href="#app">Skip to content</a>
<div id="hdr">
${nice(r.h)}
</div>
<main id="app">
${nice(r.m)}
</main>
<div id="ftr">
${nice(r.f)}
</div>
<script src="js/content.js"></script>
<script src="js/app.js"></script>
</body>
</html>
`)}
fs.writeFileSync("sitemap.xml",'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+pages.filter(p=>!["404","research-article"].includes(p[0])).map(p=>`<url><loc>${S.baseUrl}/${p[0]}.html</loc></url>`).join("\n")+"\n</urlset>\n");
console.log(pages.length+" pages built");
