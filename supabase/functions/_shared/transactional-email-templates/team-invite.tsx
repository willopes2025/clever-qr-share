import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface TeamInviteProps {
  organizationName?: string
  inviterName?: string
  roleLabel?: string
  recipientEmail?: string
  appUrl?: string
}

const TeamInviteEmail = ({
  organizationName = 'a equipe',
  inviterName = 'Um administrador',
  roleLabel = 'Membro',
  recipientEmail = '',
  appUrl = 'https://zap.wideic.com',
}: TeamInviteProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Você foi convidado para {organizationName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>Você foi convidado!</Heading>
        </Section>
        <Section style={card}>
          <Text style={text}>Olá! 👋</Text>
          <Text style={text}>
            <strong>{inviterName}</strong> convidou você para fazer parte da equipe{' '}
            <strong>{organizationName}</strong> como <strong>{roleLabel}</strong>.
          </Text>
          <Section style={steps}>
            <Text style={stepsTitle}>Para aceitar o convite:</Text>
            <Text style={stepItem}>
              1. Crie uma conta com este email{recipientEmail ? ` (${recipientEmail})` : ''}
            </Text>
            <Text style={stepItem}>2. Faça login na plataforma</Text>
            <Text style={stepItem}>3. Você terá acesso automático à equipe</Text>
          </Section>
          <Section style={{ textAlign: 'center', marginTop: '24px' }}>
            <Button href={`${appUrl}/login`} style={button}>
              Acessar Plataforma
            </Button>
          </Section>
          <Text style={footerText}>
            Se você não esperava este convite, pode ignorar este email.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TeamInviteEmail,
  subject: (data: Record<string, any>) =>
    `Você foi convidado para ${data?.organizationName ?? 'uma equipe'}`,
  displayName: 'Convite de equipe',
  previewData: {
    organizationName: 'Wideic',
    inviterName: 'William',
    roleLabel: 'Administrador',
    recipientEmail: 'novo@exemplo.com',
    appUrl: 'https://zap.wideic.com',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }
const container = { maxWidth: '600px', margin: '0 auto', padding: '20px' }
const header = { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '30px', borderRadius: '10px 10px 0 0', textAlign: 'center' as const }
const h1 = { color: '#ffffff', margin: 0, fontSize: '24px' }
const card = { background: '#f9fafb', padding: '30px', borderRadius: '0 0 10px 10px', border: '1px solid #e5e7eb', borderTop: 'none' }
const text = { fontSize: '16px', color: '#333333', lineHeight: 1.6, margin: '0 0 16px' }
const steps = { background: '#ffffff', padding: '20px', borderRadius: '8px', border: '1px solid #e5e7eb', margin: '20px 0' }
const stepsTitle = { margin: 0, fontSize: '14px', color: '#6b7280' }
const stepItem = { margin: '8px 0 0', fontSize: '14px', color: '#374151' }
const button = { background: '#667eea', color: '#ffffff', textDecoration: 'none', padding: '12px 30px', borderRadius: '6px', fontWeight: 600, fontSize: '16px' }
const footerText = { fontSize: '14px', color: '#6b7280', marginTop: '24px', textAlign: 'center' as const }
