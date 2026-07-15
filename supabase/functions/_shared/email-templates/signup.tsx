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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme seu e-mail para acessar o {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>Confirme seu e-mail</Heading>
          <Text style={text}>
            Obrigado por se cadastrar no{' '}
            <Link href={siteUrl} style={link}>
              <strong>{siteName}</strong>
            </Link>
            !
          </Text>
          <Text style={text}>
            Para ativar sua conta ({recipient}), clique no botão abaixo:
          </Text>
          <Button style={button} href={confirmationUrl}>
            Confirmar e-mail
          </Button>
          <Text style={footer}>
            Se você não criou uma conta, pode ignorar este e-mail com segurança.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
