import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  objectiveName?: string
  organizationName?: string
  leadsCount?: number
  pdfUrl?: string
  lookbackDays?: number
}

const Email = ({
  objectiveName = 'Leads quentes',
  organizationName = '',
  leadsCount = 0,
  pdfUrl = '#',
  lookbackDays = 7,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{leadsCount} lead(s) quente(s) para "{objectiveName}" hoje</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🔥 Leads quentes do dia</Heading>
          <Text style={subtitle}>{objectiveName}</Text>
        </Section>
        <Section style={card}>
          <Text style={text}>Bom dia! ☀️</Text>
          <Text style={text}>
            A análise de IA dos últimos <strong>{lookbackDays} dias</strong>
            {organizationName ? <> em <strong>{organizationName}</strong></> : null} identificou{' '}
            <strong>{leadsCount} lead(s)</strong> com alta probabilidade de compra para o objetivo
            "<strong>{objectiveName}</strong>".
          </Text>
          <Text style={text}>
            O PDF anexado contém: ranking por etapa do funil, resumo da última conversa, sinais de
            compra detectados e a próxima ação recomendada para cada lead.
          </Text>
          <Section style={{ textAlign: 'center', marginTop: '24px' }}>
            <Button href={pdfUrl} style={button}>📄 Baixar relatório completo (PDF)</Button>
          </Section>
          <Text style={footerText}>
            Link de download expira em 7 dias. Configure este relatório em Análise → Relatórios Diários.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `🔥 ${d?.leadsCount ?? 0} leads quentes — ${d?.objectiveName ?? 'Relatório'}`,
  displayName: 'Relatório diário de leads quentes',
  previewData: {
    objectiveName: 'Comprador VIP',
    organizationName: 'Wideic',
    leadsCount: 12,
    pdfUrl: 'https://example.com/report.pdf',
    lookbackDays: 7,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }
const container = { maxWidth: '600px', margin: '0 auto', padding: '20px' }
const header = { background: 'linear-gradient(135deg, #0f172a 0%, #1e40af 100%)', padding: '30px', borderRadius: '10px 10px 0 0', textAlign: 'center' as const }
const h1 = { color: '#ffffff', margin: 0, fontSize: '24px' }
const subtitle = { color: '#cbd5e1', margin: '8px 0 0', fontSize: '14px' }
const card = { background: '#f9fafb', padding: '30px', borderRadius: '0 0 10px 10px', border: '1px solid #e5e7eb', borderTop: 'none' }
const text = { fontSize: '16px', color: '#333333', lineHeight: 1.6, margin: '0 0 16px' }
const button = { background: '#1e40af', color: '#ffffff', textDecoration: 'none', padding: '14px 32px', borderRadius: '6px', fontWeight: 600, fontSize: '16px' }
const footerText = { fontSize: '13px', color: '#6b7280', marginTop: '24px', textAlign: 'center' as const }
