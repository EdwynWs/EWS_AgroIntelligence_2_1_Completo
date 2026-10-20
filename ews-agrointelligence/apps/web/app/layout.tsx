import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:{default:'EWS AgroIntelligence | Inteligência para sua granja',template:'%s | EWS AgroIntelligence'},description:'Monitoramento, manutenção, energia e produção em uma plataforma para granjas de postura.',robots:{index:true,follow:true}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>;}
