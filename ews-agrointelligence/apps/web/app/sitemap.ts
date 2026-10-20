export default function sitemap(){return [{url:process.env.APP_ORIGIN||'http://localhost:3000',changeFrequency:'monthly' as const,priority:1}];}
