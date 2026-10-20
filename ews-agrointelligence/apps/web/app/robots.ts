export default function robots(){return {rules:{userAgent:'*',allow:'/',disallow:['/app/','/api/','/reset']},sitemap:(process.env.APP_ORIGIN||'http://localhost:3000')+'/sitemap.xml'};}
