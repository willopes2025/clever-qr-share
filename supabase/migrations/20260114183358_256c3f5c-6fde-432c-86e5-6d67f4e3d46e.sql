-- Criar política que permite usuários autenticados deletarem conteúdos padrão de aquecimento
CREATE POLICY "Authenticated users can delete default warming content"
ON warming_content
FOR DELETE
TO authenticated
USING (user_id = '00000000-0000-0000-0000-000000000000');