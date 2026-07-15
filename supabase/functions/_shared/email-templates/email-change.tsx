/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme a alteração de e-mail no {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Confirme a alteração de e-mail</Heading>
          <Text style={text}>
            Você solicitou a alteração do seu endereço de e-mail no {siteName} de{' '}
            <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link>{' '}
            para{' '}
            <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
          </Text>
          <Text style={text}>
            Clique no botão abaixo para confirmar a alteração:
          </Text>
          <Button style={button} href={confirmationUrl}>
            Confirmar alteração
          </Button>
          <Text style={footer}>
            Se você não solicitou esta alteração, proteja sua conta imediatamente.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const card = {
  padding: '32px',
  borderRadius: '16px',
  border: '1px solid #d9e5e3',
  backgroundColor: '#ffffff',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#215C54',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: '#3d6f68',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const link = { color: '#35897E', textDecoration: 'underline' }
const button = {
  backgroundColor: '#35897E',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#8aa5a1', margin: '32px 0 0' }
