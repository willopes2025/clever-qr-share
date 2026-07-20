
INSERT INTO public.meta_templates
  (user_id, waba_id, name, language, category, status, body_text, body_examples, footer_text, header_type, buttons, submitted_at)
SELECT * FROM (VALUES
  ('b3e1967e-cd4c-4835-8b3c-df65740a4fb9'::uuid, '4370320239880831', 'ps_pre_venda_reserva', 'pt_BR', 'UTILITY', 'pending',
   E'*INFORMAÇÕES SOBRE OS SEUS ÓCULOS*\n\nOlá, {{1}}! Como você está? 😊 Aqui é do Programa Seven.\n\nVi que você realizou uma reserva de óculos com a gente e quero te passar as informações que ficaram definidas no seu atendimento:\n\n- Valor da compra: {{2}}\n- Valor da entrada: {{3}}\n- Data de pagamento da entrada: {{4}}\n- Forma de pagamento: {{5}}\n\nQualquer dúvida, estou por aqui.\n\nAbraços,\nEquipe Seven 💜',
   '["Maria","R$ 890,00","R$ 200,00","10/08/2026","PIX"]'::jsonb,
   'www.programaseven.com.br', 'NONE', '[]'::jsonb, now()),
  ('b3e1967e-cd4c-4835-8b3c-df65740a4fb9'::uuid, '4370320239880831', 'ps_dia_do_pagamento_lembrete', 'pt_BR', 'UTILITY', 'pending',
   E'Oi, tudo bem? 😊\nAqui é do Programa Seven.\n\nPassando pra te lembrar que o vencimento do pagamento do seu óculos está programado para o dia {{1}}.\n\nSe preferir, você pode realizar o pagamento via Pix:\nChave Pix: 32685931000167\nNome: SEVEN OCULOS COMÉRCIO E SERVIÇOS LTDA\n\n*Valor da Entrada: {{2}}*\n\nCaso queira outra forma de pagamento ou precise de ajuda, é só me responder por aqui que a gente resolve juntos, combinado?\n\nEstamos à disposição 🤝',
   '["10/08/2026","R$ 200,00"]'::jsonb,
   'Programa Seven', 'NONE', '[]'::jsonb, now()),
  ('b3e1967e-cd4c-4835-8b3c-df65740a4fb9'::uuid, '4370320239880831', 'ps_renegociado_nova_data', 'pt_BR', 'UTILITY', 'pending',
   E'Combinado, {{1}}! Ficou definida uma nova data para o pagamento da entrada dos seus óculos. Contamos com você para mantermos sua reserva ativa até lá. Qualquer dúvida, estamos à disposição!',
   '["Maria"]'::jsonb,
   'Programa Seven', 'NONE', '[]'::jsonb, now()),
  ('b3e1967e-cd4c-4835-8b3c-df65740a4fb9'::uuid, '4370320239880831', 'ps_atraso_entrada', 'pt_BR', 'UTILITY', 'pending',
   E'Olá, {{1}}! Notamos que o pagamento da entrada dos seus óculos no Programa Seven ainda está em aberto. Para mantermos sua reserva e darmos continuidade à confecção, pedimos que regularize o quanto antes. Qualquer dúvida ou dificuldade, estamos à disposição para ajudar!',
   '["Maria"]'::jsonb,
   'Programa Seven', 'NONE', '[]'::jsonb, now())
) AS v(user_id, waba_id, name, language, category, status, body_text, body_examples, footer_text, header_type, buttons, submitted_at)
WHERE NOT EXISTS (
  SELECT 1 FROM public.meta_templates mt
  WHERE mt.waba_id = v.waba_id AND mt.name = v.name AND mt.language = v.language
);
